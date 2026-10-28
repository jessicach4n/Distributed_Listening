// The form's preview: plays the ticked groups, exactly as the form would
// download them (same buildJson(), same audio engine as the phones), using the
// audio files chosen in the form. Changes apply the next time Play is pressed.
import { AudioPlayer } from "./audio/AudioPlayer.js";
import { getAudioEntries } from "./form.js";
import { buildJson } from "./generateJson.js";

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

function startTicker() {
    stopTicker();
    const tick = () => {
        const transport = Tone.getTransport();
        if (transport.state === "started") timeText.textContent = formatTime(transport.seconds);
        ticker = requestAnimationFrame(tick);
    };
    tick();
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
}

playBtn.addEventListener("click", play);
stopBtn.addEventListener("click", () => {
    stop();
    showStatus("Stopped.");
});
