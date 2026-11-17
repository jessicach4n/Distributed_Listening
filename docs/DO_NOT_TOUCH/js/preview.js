// The form's preview: plays the ticked groups, exactly as the form would
// download them (same buildJson(), same audio engine as the phones), using the
// audio files chosen in the form. Changes apply the next time Play is pressed.
// Above it, the score's timeline (timeline.js), redrawn as the form changes.
import { AudioPlayer } from "./audio/AudioPlayer.js";
import { getAudioEntries } from "./form.js";
import { buildJson } from "./generateJson.js";
import { layoutTimeline, drawTimeline, LANE_HEIGHT, AXIS_HEIGHT } from "./timeline.js";

const timelineCanvas = document.getElementById("previewTimeline");
const startInput = document.getElementById("previewStart");
const playBtn = document.getElementById("previewPlay");
const stopBtn = document.getElementById("previewStop");
const timeText = document.getElementById("previewTime");
const statusText = document.getElementById("previewStatus");
const warningList = document.getElementById("previewWarnings");

// An event later than this is almost certainly a typo (e.g. "10:30" typed into
// a number box becomes 1030).
const SUSPICIOUS_TIME = 600;

const audioPlayer = new AudioPlayer();
const decoded = new WeakMap(); // File -> Promise<AudioBuffer>, so each file is decoded once
let ticker = null;

function showStatus(text) {
    statusText.textContent = text;
}

// "1:30", "90" or "90.5" -> seconds; "" -> 0; anything else -> NaN.
function parseTime(text) {
    text = text.trim();
    if (!text) return 0;
    const match = text.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    if (!match) return NaN;
    return Number(match[1] ?? 0) * 60 + Number(match[2]);
}

function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function decode(file) {
    if (!decoded.has(file)) {
        const promise = file.arrayBuffer().then((data) => Tone.getContext().decodeAudioData(data));
        promise.catch(() => decoded.delete(file)); // let a later Play retry
        decoded.set(file, promise);
    }
    return decoded.get(file);
}

const groupLabel = (key) => `Group ${Number(key) + 1}`;

function showWarnings(warnings) {
    warningList.replaceChildren();
    for (const { group, message } of warnings) {
        const item = document.createElement("li");
        item.textContent = group === undefined ? message : `${groupLabel(group)}: ${message}`;
        warningList.append(item);
    }
}

// Events the player keeps but you'd never hear: absurdly late, or after every
// sound in the group has finished. Needs the decoded files, so runs after loading.
function timingWarnings(groups) {
    const warnings = [];
    for (const group of groups) {
        // When this group's last sound ends (a looping sound never does).
        let end = 0;
        for (const event of group.events) {
            if (event.play === undefined) continue;
            const player = group.players[event.play];
            end = Math.max(end, player.loop ? Infinity : event.at + player.buffer.duration);
        }
        for (const event of group.events) {
            if (event.at > SUSPICIOUS_TIME) {
                warnings.push({ group: group.key, message: `An event is at ${event.at}s (${formatTime(event.at)}). Is that a typo?` });
            } else if (event.play === undefined && end > 0 && event.at >= end) {
                warnings.push({
                    group: group.key,
                    message: `An event at ${event.at}s comes after all this group's sounds have finished (${formatTime(end)}), so you won't hear it.`,
                });
            }
        }
    }
    return warnings;
}

// ── Timeline ──────────────────────────────────────────────────────────────────
// File lengths, read from each file's header (much quicker than decoding it)
const durations = new WeakMap(); // File -> seconds, or null while reading
let layout = layoutTimeline({ groups: {} });

function fileDuration(file) {
    if (durations.has(file)) return durations.get(file);
    durations.set(file, null);
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    const done = (seconds) => {
        URL.revokeObjectURL(url);
        durations.set(file, Number.isFinite(seconds) ? seconds : null);
        scheduleTimeline();
    };
    audio.addEventListener("loadedmetadata", () => done(audio.duration), { once: true });
    audio.addEventListener("error", () => done(null), { once: true });
    audio.preload = "metadata";
    audio.src = url;
    return null;
}

// Groups not ticked "Include in preview", drawn grey
function mutedGroups() {
    return [...document.querySelectorAll(".groupCard")]
        .map((card, index) => (card.querySelector(".previewGroup")?.checked === false ? String(index) : null))
        .filter((key) => key !== null);
}

function playing() {
    return ticker !== null && Tone.getTransport().state === "started";
}

function drawNow() {
    // One lane per group, each tall enough to read
    const height = `${AXIS_HEIGHT + Math.max(1, layout.lanes.length) * LANE_HEIGHT}px`;
    if (timelineCanvas.style.height !== height) timelineCanvas.style.height = height;
    const head = playing() ? Tone.getTransport().seconds : parseTime(startInput.value);
    drawTimeline(timelineCanvas, layout, { head: Number.isNaN(head) ? null : head, muted: mutedGroups() });
}

// Rebuilds the timeline from the form as it is now (at most once a frame)
let timelineQueued = false;
function scheduleTimeline() {
    if (timelineQueued) return;
    timelineQueued = true;
    requestAnimationFrame(() => {
        timelineQueued = false;
        try {
            const fileByName = new Map(getAudioEntries().filter((e) => e.file).map((e) => [e.name, e.file]));
            layout = layoutTimeline(buildJson(), (name) => (fileByName.has(name) ? fileDuration(fileByName.get(name)) : null));
        } catch (error) {
            // The form can be half-built for a moment (rows being added); try again next change
            console.debug("Timeline not updated:", error);
        }
        drawNow();
    });
}

function startTicker() {
    stopTicker();
    const tick = () => {
        const transport = Tone.getTransport();
        if (transport.state === "started") {
            timeText.textContent = layout.endless ? formatTime(transport.seconds)
                : `${formatTime(transport.seconds)} / ${formatTime(layout.end)}`;
            // Past the end of the piece (and its tails): stop by itself. Not
            // when a sound loops forever: that plays until Stop is pressed.
            if (!layout.endless && transport.seconds > layout.end + 2) {
                stop();
                showStatus("Finished.");
                return;
            }
        }
        drawNow();
        ticker = requestAnimationFrame(tick);
    };
    ticker = requestAnimationFrame(tick);
}

function stopTicker() {
    if (ticker !== null) cancelAnimationFrame(ticker);
    ticker = null;
}

async function play() {
    const startFrom = parseTime(startInput.value);
    if (Number.isNaN(startFrom)) {
        showStatus('Start time should look like "1:30" or "90".');
        return;
    }

    const cards = [...document.querySelectorAll(".groupCard")];
    const selected = cards
        .map((card, index) => (card.querySelector(".previewGroup")?.checked ? String(index) : null))
        .filter((key) => key !== null);
    if (!cards.length) {
        showStatus("Add a group first.");
        return;
    }
    if (!selected.length) {
        showStatus('Tick "Include in preview" on at least one group.');
        return;
    }

    playBtn.disabled = true;
    stop();
    try {
        // Tone.start() must run inside a user gesture (this click) to unlock audio.
        await Tone.start();
        const score = buildJson();

        // Decode the audio files the ticked groups use.
        showStatus("Loading audio…");
        const fileByPath = new Map(getAudioEntries().filter((e) => e.file).map((e) => [e.path, e.file]));
        const used = new Set(selected.flatMap((key) =>
            score.groups[key].events.map((event) => event.play ?? event.stop).filter(Boolean)));
        const buffers = new Map();
        const warnings = [];
        for (const name of used) {
            const path = score.sounds[name];
            const file = fileByPath.get(path);
            if (!file) continue; // the player reports it as missing
            try {
                buffers.set(path, await decode(file));
            } catch (error) {
                warnings.push({ message: `Could not read the audio file for "${name}" (${file.name}): ${error.message}` });
            }
        }

        await audioPlayer.initialize(score, selected, null, (path) => buffers.get(path) ?? null);
        warnings.push(...audioPlayer.warnings, ...timingWarnings(audioPlayer.part.groups));
        showWarnings(warnings);

        // No server here: the "server clock" is just this computer's, and
        // starting `startFrom` seconds ago makes the timeline begin there.
        audioPlayer.clockOffset = 0;
        audioPlayer.play(Date.now() - startFrom * 1000);
        startTicker();
        stopBtn.disabled = false;
        const names = selected.map(groupLabel).join(", ");
        showStatus(`Playing ${names}${startFrom ? ` from ${formatTime(startFrom)}` : ""}.`);
    } catch (error) {
        console.error("Preview failed:", error);
        showStatus(`Could not play the preview: ${error.message}`);
    } finally {
        playBtn.disabled = false;
    }
}

function stop() {
    audioPlayer.stop();
    stopTicker();
    stopBtn.disabled = true;
    drawNow();
}

playBtn.addEventListener("click", play);
stopBtn.addEventListener("click", () => {
    stop();
    showStatus("Stopped.");
});

// Click the timeline (when stopped) to choose where the preview starts
timelineCanvas.addEventListener("click", (event) => {
    if (playing() || !timelineCanvas._x2t) return;
    const box = timelineCanvas.getBoundingClientRect();
    startInput.value = formatTime(Math.round(timelineCanvas._x2t(event.clientX - box.left)));
    drawNow();
});

// Hover a sound or an effect change to see what it is
timelineCanvas.addEventListener("mousemove", (event) => {
    if (!timelineCanvas._hitTest) return;
    const box = timelineCanvas.getBoundingClientRect();
    const text = timelineCanvas._hitTest(event.clientX - box.left, event.clientY - box.top);
    if (timelineCanvas.title !== text) timelineCanvas.title = text;
});

// Typing a start time moves the marker
startInput.addEventListener("input", () => { if (!playing()) drawNow(); });

// Redraw whenever the form changes: typing, choosing files, and rows being
// added or removed (which fire no input events, so watch the sections that
// hold rows; not the whole form, whose preview status changes every frame)
const form = document.getElementById("jsonForm");
form.addEventListener("input", scheduleTimeline);
form.addEventListener("change", scheduleTimeline);
const rowsChanged = new MutationObserver(scheduleTimeline);
for (const id of ["audio_section", "groupeSection"]) {
    rowsChanged.observe(document.getElementById(id), { childList: true, subtree: true });
}
window.addEventListener("resize", drawNow);
scheduleTimeline();
