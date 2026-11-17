// The form's score timeline: one lane per group, each sound drawn from when it
// starts to when it ends, as tall as the group's volume at that moment, with
// the group's effects at the right end of its lane, its drift speed dashed
// along the bottom, and a mark for every effect change. Ported from the
// timeline in the phase-study ensemble and adapted to this project's score
// format, following the same rules as the audio engine (AudioPlayer.js):
//   - a sound plays once, to the end of its file, unless its "play" event
//     says "loop"; it stops early at a "stop" of that sound, or when it is
//     played again (the engine restarts it)
//   - "volume" (the form writes "gain") scales everything in the group
//   - "drift.rate" sets the playback speed of every sound in the group

// ── Curves: [{ t, v }], sorted by t; two points at one t make a step ────────
function valueAt(pts, t) {
    if (!pts.length) return 0;
    if (t < pts[0].t) return pts[0].v;
    let i = 0;
    while (i + 1 < pts.length && pts[i + 1].t <= t) i++;
    const a = pts[i], b = pts[i + 1];
    if (!b || b.t === a.t) return a.v;
    return a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t);
}

// Replace everything after t with a move from the current value to v over `over`
function rampTo(pts, t, v, over) {
    const kept = pts.filter((p) => p.t <= t);
    kept.push({ t, v: valueAt(pts, t) }, { t: t + Math.max(0, over), v });
    return kept;
}

// The corners of a curve between t0 and t1, so it is drawn exactly
function curvePoints(pts, t0, t1) {
    return [{ t: t0, v: valueAt(pts, t0) }, ...pts.filter((p) => p.t > t0 && p.t < t1), { t: t1, v: valueAt(pts, t1) }];
}

const VOLUME_TARGETS = new Set(["volume", "gain"]);
const groupLabel = (key) => `Group ${Number(key) + 1}`;

// A sound whose file length isn't known (no file chosen, or still reading it)
// is drawn this long, fading out, rather than across the rest of the piece
const UNKNOWN_LENGTH = 4;

// Height of one group's lane on screen (CSS pixels), and of the time axis
export const LANE_HEIGHT = 64;
export const AXIS_HEIGHT = 18;

// ── Layout: score → what to draw ─────────────────────────────────────────────
// `durationOf(soundName)` gives the length of a sound's file in seconds, or
// null if it isn't known (no file chosen yet, or still reading it).
// Returns { end, endless, sounds, lanes: [{ key, label, effects, segments, volume, rate, changes }] }
//   endless: a sound loops and is never stopped, so the piece has no real end
//   segments: [{ sound, start, end, loop, open, cut }]
//             open = file length unknown; cut = ended early by a stop or replay
//   volume:   the group's volume curve; rate: its drift curve (or null)
//   changes:  [{ t, over, target, value }]          every other set/ramp
export function layoutTimeline(score, durationOf = () => null) {
    const keys = Object.keys(score.groups || {}).sort((a, b) => Number(a) - Number(b));
    const lanes = keys.map((key) => {
        const group = score.groups[key] || {};
        const effects = (group.effects || []).map((fx) => fx.id || fx.type).filter(Boolean);
        const drift = (group.effects || []).find((fx) => fx.type === "drift");
        const driftId = drift && (drift.id || "drift");
        // Same order as the engine: by time, and in the written order at equal times
        const events = (group.events || [])
            .map((e, i) => ({ ...e, i, at: Number(e.at) }))
            .filter((e) => Number.isFinite(e.at))
            .sort((a, b) => a.at - b.at || a.i - b.i);

        let volume = [{ t: 0, v: 1 }];
        let rate = drift ? [{ t: 0, v: Number(drift.rate ?? 1) }] : null;
        const changes = [];
        const segments = [];
        const playing = new Map(); // sound → its segment while it plays
        const close = (sound, t) => {
            const seg = playing.get(sound);
            if (seg && t < seg.end) { seg.end = t; seg.cut = true; }
            playing.delete(sound);
        };

        for (const e of events) {
            if (e.play !== undefined) {
                close(e.play, e.at); // playing it again restarts it
                const dur = durationOf(e.play);
                const loop = !!e.loop;
                const open = !loop && !dur;
                const seg = { sound: e.play, start: e.at, end: loop ? Infinity : e.at + (dur || UNKNOWN_LENGTH), loop, open };
                segments.push(seg);
                playing.set(e.play, seg);
            } else if (e.stop !== undefined) {
                close(e.stop, e.at);
            } else {
                const target = e.set ?? e.ramp;
                if (target === undefined) continue;
                const value = Number(e.set !== undefined ? e.value : e.to);
                const over = e.ramp !== undefined ? Math.max(0, Number(e.over) || 0) : 0;
                if (!Number.isFinite(value)) continue;
                if (VOLUME_TARGETS.has(target)) volume = rampTo(volume, e.at, value, over);
                else if (rate && target === `${driftId}.rate`) rate = rampTo(rate, e.at, value, 0); // drift can only be set
                changes.push({ t: e.at, over, target, value });
            }
        }
        return { key, label: groupLabel(key), effects, segments, volume, rate, changes };
    });

    // The piece ends when the last thing in it does (at least 10 s, so a short
    // or empty score still has a readable axis)
    let end = 10;
    for (const lane of lanes) {
        for (const s of lane.segments) end = Math.max(end, Number.isFinite(s.end) ? s.end : s.start);
        for (const c of lane.changes) end = Math.max(end, c.t + c.over);
    }
    // Looping sounds that never stop run to the end (and make the piece endless)
    let endless = false;
    for (const lane of lanes) for (const s of lane.segments) if (!Number.isFinite(s.end)) { s.end = end; endless = true; }

    return { end, endless, sounds: Object.keys(score.sounds || {}), lanes };
}

// ── Drawing ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

// Colour by the sound's place in the score's sound list
const soundHue = (sounds, name) => [200, 20, 95, 285, 335, 45, 170, 245, 0][Math.max(0, sounds.indexOf(name)) % 9];

// What a tooltip says about a sound, and about an effect change
function describeSound(s) {
    const how = s.loop ? "loops" : s.open ? "length unknown until its file is chosen" : s.cut ? "cut short" : "plays once";
    return `${s.sound}: ${formatTime(s.start)} → ${formatTime(s.end)} (${how})`;
}
function describeChange(ch) {
    const value = +ch.value.toFixed(3);
    const target = VOLUME_TARGETS.has(ch.target) ? "volume" : ch.target; // the form shows "volume", writes "gain"
    return ch.over > 0 ? `${formatTime(ch.t)}: ${target} → ${value} over ${ch.over} s` : `${formatTime(ch.t)}: ${target} = ${value}`;
}

// opts: {
//   head   where to draw the playhead (or the "start from" marker), or null
//   muted  group keys drawn grey (not ticked to be heard in the preview)
// }
// Sets canvas._x2t(px) → score time, for click-to-seek, and canvas._hitTest(px, py)
// → a description of what's under the pointer (for a tooltip), or "".
export function drawTimeline(canvas, layout, { head = null, muted = [] } = {}) {
    const dpr = window.devicePixelRatio || 1;
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const c = canvas.getContext("2d");
    c.clearRect(0, 0, W, H);

    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue("--blue-color").trim() || "#43BAFF";
    const GRID = "#d9d9d9", MID = "#777777", FG = "#111111";

    const { end, lanes, sounds } = layout;
    const left = 64 * dpr, right = 8 * dpr, top = AXIS_HEIGHT * dpr;
    const G = Math.max(1, lanes.length), laneH = (H - top) / G;
    const x = (t) => left + (W - left - right) * (t / end);
    const hits = []; // [{ x0, x1, y0, y1, text }] in canvas pixels, last drawn on top
    c.font = `${11 * dpr}px sans-serif`;
    c.textBaseline = "middle";

    // Time grid
    c.strokeStyle = GRID; c.fillStyle = MID; c.lineWidth = 1;
    const step = end > 600 ? 120 : end > 180 ? 60 : end > 60 ? 15 : 5;
    for (let t = 0; t <= end; t += step) {
        c.beginPath(); c.moveTo(x(t), top); c.lineTo(x(t), H); c.stroke();
        const label = formatTime(t);
        if (x(t) + 3 * dpr + c.measureText(label).width <= W) c.fillText(label, x(t) + 3 * dpr, 8 * dpr); // skip one that won't fit
    }

    if (!lanes.length) {
        c.fillStyle = MID;
        c.fillText("Choose how many groups the piece needs to see its timeline.", left, top + 20 * dpr);
    }

    lanes.forEach((lane, gi) => {
        const y0 = top + gi * laneH, y1 = y0 + laneH;
        const off = muted.includes(lane.key);
        const floor = y1 - 3 * dpr, height = laneH - 12 * dpr; // where volume 0 and 1 sit
        c.fillStyle = off ? MID : FG;
        c.fillText(lane.label, 6 * dpr, (y0 + y1) / 2);
        c.strokeStyle = GRID;
        c.beginPath(); c.moveTo(0, y1); c.lineTo(W, y1); c.stroke();

        // Sound names go in rows; one with no free row is left out rather than
        // overlapping another (hover shows every sound)
        const rowH = 13 * dpr, maxRows = Math.max(1, Math.floor((laneH - 8 * dpr) / rowH));
        const rows = [], labels = [];

        // Each sound: its loudness over time (the group's volume) as a filled shape
        for (const s of [...lane.segments].sort((a, b) => a.start - b.start)) {
            const hue = soundHue(sounds, s.sound);
            const x0 = x(s.start), x1 = Math.max(x(s.end), x0 + 2 * dpr);
            let fill = off ? "hsl(0 0% 50% / 0.15)" : `hsl(${hue} 70% 55% / 0.35)`;
            if (s.open) {
                // Length unknown: fade out to the right instead of a hard end
                const g = c.createLinearGradient(x0, 0, x1, 0);
                g.addColorStop(0, fill);
                g.addColorStop(1, off ? "hsl(0 0% 50% / 0)" : `hsl(${hue} 70% 55% / 0)`);
                fill = g;
            }
            c.fillStyle = fill;
            c.strokeStyle = off ? "hsl(0 0% 50% / 0.5)" : `hsl(${hue} 70% 40%)`;
            c.beginPath();
            c.moveTo(x0, floor);
            for (const p of curvePoints(lane.volume, s.start, s.end)) c.lineTo(x(p.t), floor - height * Math.min(1, Math.max(0, p.v)));
            c.lineTo(x1, floor);
            c.closePath(); c.fill();
            if (s.open) c.setLineDash([4 * dpr, 3 * dpr]);
            c.stroke(); c.setLineDash([]);
            hits.push({ x0, x1, y0: y0 + 12 * dpr, y1: y1, text: describeSound(s) });

            const text = s.sound + (s.loop ? " (loop)" : ""), lx = x0 + 3 * dpr;
            const row = rows.findIndex((free) => free <= lx);
            const r = row >= 0 ? row : rows.length < maxRows ? rows.length : -1;
            if (r >= 0) {
                rows[r] = Math.max(lx + c.measureText(text).width + 6 * dpr, x1);
                labels.push({ text, lx, y: y0 + 9 * dpr + r * rowH });
            }
        }

        // Drift: the playback speed, dashed, scaled to the largest drift in the lane
        if (lane.rate) {
            const pts = curvePoints(lane.rate, 0, end);
            const maxD = Math.max(1e-6, ...pts.map((p) => Math.abs(p.v - 1)));
            c.setLineDash([3 * dpr, 3 * dpr]);
            c.strokeStyle = off ? GRID : FG; c.lineWidth = dpr;
            c.beginPath();
            pts.forEach((p, i) => {
                const yy = floor - height * 0.5 * Math.abs(p.v - 1) / maxD;
                i ? c.lineTo(x(p.t), yy) : c.moveTo(x(p.t), yy);
            });
            c.stroke(); c.setLineDash([]); c.lineWidth = 1;
        }

        // Effect changes (volume and drift too): a tick at the top of the lane,
        // with a bar along it for a ramp; hover for what changes
        for (const ch of lane.changes) {
            const cx = x(ch.t);
            c.fillStyle = off ? GRID : accent;
            c.fillRect(cx - dpr, y0 + 1 * dpr, 2 * dpr, 7 * dpr);
            if (ch.over > 0) c.fillRect(cx, y0 + 3 * dpr, Math.max(2, x(ch.t + ch.over) - cx), 2 * dpr);
            hits.push({ x0: cx - 4 * dpr, x1: Math.max(cx + 4 * dpr, x(ch.t + ch.over)), y0, y1: y0 + 11 * dpr, text: describeChange(ch) });
        }

        // Names last, so no shape covers them
        c.fillStyle = off ? MID : FG;
        for (const l of labels) c.fillText(l.text, l.lx, l.y);

        // The group's effect chain, in the lane's bottom-right corner (clear of
        // the change ticks along the top), on a light backing so it stays readable
        if (lane.effects.length) {
            const text = lane.effects.join(" → ");
            const w = c.measureText(text).width, ty = y1 - 9 * dpr;
            c.fillStyle = "rgba(255, 255, 255, 0.85)";
            c.fillRect(W - right - w - 4 * dpr, ty - 7 * dpr, w + 4 * dpr, 13 * dpr);
            c.textAlign = "right"; c.fillStyle = MID;
            c.fillText(text, W - right, ty);
            c.textAlign = "left";
        }
    });

    // Playhead, or the "start from" marker when stopped
    if (head !== null && head >= 0 && head <= end) {
        c.strokeStyle = accent; c.lineWidth = 2 * dpr;
        c.beginPath(); c.moveTo(x(head), top - 6 * dpr); c.lineTo(x(head), H); c.stroke();
        c.lineWidth = 1;
    }
    canvas._x2t = (px) => Math.max(0, Math.min(end, ((px * dpr - left) / (W - left - right)) * end));
    canvas._hitTest = (px, py) => {
        const X = px * dpr, Y = py * dpr;
        for (let i = hits.length - 1; i >= 0; i--) {
            const h = hits[i];
            if (X >= h.x0 && X <= h.x1 && Y >= h.y0 && Y <= h.y1) return h.text;
        }
        return "";
    };
}
