// Checks a score (as the form builds it) for things the phones would skip or
// that you'd never hear, so the form can list them live as you edit. Follows
// the audio engine's rules (audio/AudioPlayer.js): which settings each effect
// type has, which of them can only be set (not ramped), and so on.

// An event later than this is almost certainly a typo (e.g. "10:30" typed into
// a number box becomes 1030).
export const SUSPICIOUS_TIME = 600;

const FILTER = (fx) => (fx.lfo && fx.lfoOn !== false ? ["q", "rate"] : ["q", "frequency"]);
const SETTINGS = {
    lowpass: FILTER, highpass: FILTER, bandpass: FILTER,
    reverb: () => ["mix"],
    delay: () => ["time", "feedback", "mix"],
    pitch: () => ["semitones", "mix"],
    pan: () => ["pan"],
    drift: () => ["rate"],
};
const SET_ONLY = { pitch: ["semitones"], drift: ["rate"] }; // no smooth control for these

const groupLabel = (key) => `Group ${Number(key) + 1}`;
const when = (at) => `at ${+Number(at).toFixed(2)}s`;

// score: { sounds, groups: { key: { effects, events } } }
// hasFile(soundName): whether an audio file is chosen for that sound
// layout: the timeline's layout (timeline.js), to know when each group's
//         sounds end; optional
// Returns [{ group?, message }] in the order found
export function checkScore(score, { hasFile = () => true, layout = null } = {}) {
    const problems = [];
    const say = (group, message) => problems.push({ group, message });
    const sounds = score.sounds || {};

    for (const name of Object.keys(sounds)) {
        if (!hasFile(name)) say(undefined, `Sound "${name}" has no audio file: choose one, or it is skipped.`);
    }

    for (const [key, group] of Object.entries(score.groups || {})) {
        // What set/ramp events can change in this group
        const targets = new Map([["volume", false], ["gain", false]]); // name → set only?
        const ids = new Set();
        for (const fx of group.effects || []) {
            const settings = SETTINGS[fx.type];
            if (!settings) { say(key, `Effect type "${fx.type}" doesn't exist, so it is left out.`); continue; }
            const id = fx.id || fx.type;
            if (ids.has(id)) say(key, `Two effects are both called "${id}"; events can only change the last one.`);
            ids.add(id);
            for (const s of settings(fx)) targets.set(`${id}.${s}`, (SET_ONLY[fx.type] || []).includes(s));
        }

        // When this group's last sound ends (if the timeline knows every length)
        const lane = layout && layout.lanes.find((l) => l.key === String(key));
        const known = lane && lane.segments.length && lane.segments.every((s) => !s.open);
        const lastEnd = known ? Math.max(...lane.segments.map((s) => (s.loop && !s.cut ? Infinity : s.end))) : Infinity;

        for (const e of group.events || []) {
            const at = Number(e.at);
            if (!Number.isFinite(at)) { say(key, `An event has no time.`); continue; }
            if (at > SUSPICIOUS_TIME) say(key, `An event is ${when(at)} (${Math.floor(at / 60)}:${String(Math.floor(at % 60)).padStart(2, "0")}). Is that a typo?`);
            const sound = e.play ?? e.stop;
            const target = e.set ?? e.ramp;
            if (sound !== undefined) {
                if (!sound) say(key, `The ${e.play !== undefined ? "play" : "stop"} event ${when(at)} has no sound chosen.`);
                else if (!(sound in sounds)) say(key, `The event ${when(at)} uses sound "${sound}", which isn't in the audio list.`);
            } else if (target !== undefined) {
                const shown = target === "gain" ? "volume" : target;
                if (!target) say(key, `The ${e.set !== undefined ? "set" : "ramp"} event ${when(at)} has no target chosen.`);
                else if (!targets.has(target)) say(key, `The event ${when(at)} changes "${shown}", but no effect in this group has it.`);
                else if (e.ramp !== undefined && targets.get(target)) say(key, `"${shown}" can only be set, not ramped (event ${when(at)}).`);
                else if (at >= lastEnd) say(key, `The event ${when(at)} comes after all this group's sounds have finished, so you won't hear it.`);
            }
        }
    }
    return problems;
}

export const describeProblem = ({ group, message }) => (group === undefined ? message : `${groupLabel(group)}: ${message}`);
