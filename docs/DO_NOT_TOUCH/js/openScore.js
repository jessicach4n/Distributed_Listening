// Opening a score from somewhere other than a ZIP: a public GitHub repo (by
// its link) or a folder on this computer. Either way the piece is laid out as
//
//   my-piece/
//     score.json
//     audio/rain.wav ...        (paths in score.json are relative to the folder)
//
// Scores written for the phase-study ensemble (lettered groups and one shared
// event list) are converted to this project's format on the way in.
// Ported from the phase-study ensemble's pieces.js and score editor.

// ── Links ────────────────────────────────────────────────────────────────────
// A link to a piece → the URL of its folder (ending in "/"). Accepts
//   https://github.com/user/repo                      (default branch, top folder)
//   https://github.com/user/repo/tree/branch/folder   (a branch and/or subfolder)
//   https://github.com/user/repo/blob/branch/folder/score.json
//   https://raw.githubusercontent.com/user/repo/branch/folder/
//   github.com/user/repo                              (https:// may be left off)
// GitHub links become raw.githubusercontent.com URLs, which any page can fetch
// from (GitHub sends the CORS header). "HEAD" there means the default branch.
export function pieceFolder(link) {
    let s = String(link || "").trim();
    if (!s) throw new Error("Paste a link to the piece first.");
    if (/^(www\.)?(github\.com|raw\.githubusercontent\.com)\//i.test(s)) s = "https://" + s;
    let u;
    try { u = new URL(s); }
    catch (e) { throw new Error("That doesn't look like a link. Paste the address of the GitHub repo, e.g. https://github.com/you/your-piece"); }
    const trail = (p) => p.replace(/\/?score\.json$/i, "").replace(/\/*$/, "/");

    if (u.hostname === "github.com" || u.hostname === "www.github.com") {
        const [owner, repo, kind, ref, ...path] = u.pathname.split("/").filter(Boolean);
        if (!owner || !repo) throw new Error("That GitHub link needs to include the repository, e.g. github.com/you/your-piece");
        const branch = (kind === "tree" || kind === "blob") && ref ? ref : "HEAD";
        const folder = kind === "tree" || kind === "blob" ? path.join("/") : "";
        return trail(`https://raw.githubusercontent.com/${owner}/${repo.replace(/\.git$/, "")}/${branch}/${folder}`);
    }
    u.search = ""; u.hash = "";
    return trail(u.href);
}

function parseScoreText(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error(`score.json is not valid JSON: ${e.message}`); }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("score.json should hold one score: { \"title\": …, \"sounds\": …, \"groups\": … }");
    return data;
}

const fileName = (path) => path.split("/").pop();

// Loads a piece from a GitHub link: its score, and every audio file it lists
// (downloaded, so the preview and the ZIP download work as with chosen files).
// progress(done, total, name) is called as each file arrives.
// Returns { data, audioFiles: { soundName: File }, missing: [soundName] }
export async function openFromGitHub(link, progress = () => {}) {
    const base = pieceFolder(link);
    let response;
    try { response = await fetch(base + "score.json", { cache: "no-cache" }); }
    catch (e) { throw new Error("Could not reach GitHub. Check your connection."); }
    if (response.status === 404) throw new Error("No score.json there. Is the repo public, and is score.json at the top of the folder you linked?");
    if (!response.ok) throw new Error(`Could not load score.json: HTTP ${response.status}`);
    const data = parseScoreText(await response.text());

    const audioFiles = {}, missing = [];
    const sounds = Object.entries(data.sounds || {});
    let done = 0;
    progress(done, sounds.length, "");
    for (const [name, path] of sounds) {
        try {
            const r = await fetch(new URL(path, base));
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const blob = await r.blob();
            audioFiles[name] = new File([blob], fileName(path), { type: blob.type });
        } catch (e) {
            missing.push(name);
        }
        progress(++done, sounds.length, name);
    }
    return { data, audioFiles, missing };
}

// Paths without "./" and with forward slashes
const normPath = (p) => p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/\.\//g, "/");

// Loads a piece from a folder chosen on this computer (an <input webkitdirectory>
// file list): the shallowest score.json in it, and the audio files it lists.
export async function openFromFolder(files) {
    const byPath = new Map([...files].map((f) => [normPath(f.webkitRelativePath || f.name), f]));
    const scorePath = [...byPath.keys()].filter((p) => /(^|\/)score\.json$/i.test(p))
        .sort((a, b) => a.split("/").length - b.split("/").length)[0];
    if (!scorePath) throw new Error("There is no score.json in that folder.");
    const folder = scorePath.slice(0, scorePath.length - "score.json".length);
    const data = parseScoreText(await byPath.get(scorePath).text());

    const audioFiles = {}, missing = [];
    for (const [name, path] of Object.entries(data.sounds || {})) {
        const f = byPath.get(normPath(folder + path));
        if (f) audioFiles[name] = f; else missing.push(name);
    }
    return { data, audioFiles, missing };
}

// ── Phase-study scores → this project's format ───────────────────────────────
// Theirs: "groups": 4 (A, B, C, D), "effects": { "CD": [...] }, and one event
// list where each event names its groups and can fade or set a level.
// Ours: "groups": { "0": { effects, events }, ... }, each with its own events,
// and loudness as the group's "gain".
export function isEnsembleFormat(score) {
    return !!score && (typeof score.groups === "number" || Array.isArray(score.groups) || Array.isArray(score.events));
}

// "2:30" → 150, "0:8" → 8, 90 → 90
function parseTime(x) {
    if (typeof x === "number") return x;
    const parts = String(x ?? "").trim().split(":").map(Number);
    if (!parts.length || parts.some(Number.isNaN)) return NaN;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
}

const FILTERS = ["lowpass", "highpass", "bandpass"];

function convertEffect(fx, notes) {
    const type = fx && fx.type;
    const id = fx.id || type;
    if (FILTERS.includes(type)) {
        const out = { id, type, frequency: fx.frequency, q: fx.q, lfoOn: !!fx.lfo };
        if (fx.lfo) out.lfo = { rate: fx.lfo.rate, min: fx.lfo.min, max: fx.lfo.max };
        return out;
    }
    if (type === "reverb") return { id, type, decay: fx.decay, preDelay: fx.preDelay, mix: fx.mix };
    if (type === "delay") return { id, type, time: fx.time, feedback: fx.feedback, mix: fx.mix };
    if (type === "pan") return { id, type, pan: fx.pan };
    notes.add(`Effect type "${type}" isn't available here, so it was left out.`);
    return null;
}

// Returns { score, notes: [what couldn't be carried over exactly] }
export function fromEnsembleFormat(src) {
    const notes = new Set();
    const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letters = typeof src.groups === "number" ? LETTERS.slice(0, Math.max(1, Math.min(26, Math.floor(src.groups)))).split("")
        : Array.isArray(src.groups) && src.groups.length ? src.groups.map(String)
        : ["A", "B", "C", "D"];
    const groups = letters.map(() => ({ nbOfPhones: null, effects: [], events: [] }));
    const expand = (g) => (g === undefined || g === "all" || g === "*" ? letters
        : (Array.isArray(g) ? g.map(String) : String(g).split(""))).filter((x) => letters.includes(x));

    for (const [key, list] of Object.entries(src.effects || {})) {
        if (!Array.isArray(list)) continue;
        for (const g of expand(key)) {
            for (const fx of list) {
                const out = convertEffect(fx, notes);
                if (out) groups[letters.indexOf(g)].effects.push(JSON.parse(JSON.stringify(out)));
            }
        }
    }

    // One shared list → each group's own events, in time order
    const playing = letters.map(() => new Set()); // what each group has playing
    const events = (src.events || [])
        .map((e, i) => ({ ...e, i, t: parseTime(e.at) }))
        .filter((e) => {
            if (!Number.isFinite(e.t)) { notes.add(`An event with time "${e.at}" was left out (not a time).`); return false; }
            return true;
        })
        .sort((a, b) => a.t - b.t || a.i - b.i);

    for (const e of events) {
        const fade = Math.max(0, Number(e.fade) || 0);
        if (e.spread !== undefined) notes.add('"spread" (groups drifting apart) has no equivalent here, so it was left out.');
        for (const g of expand(e.groups)) {
            const gi = letters.indexOf(g), out = groups[gi].events;
            if (e.play !== undefined) {
                const name = String(e.play);
                if (fade > 0) {
                    out.push({ at: e.t, set: "gain", value: 0 }, { at: e.t, ramp: "gain", to: e.level ?? 1, over: fade });
                    notes.add("Fade-ins and levels became changes to the whole group's volume.");
                } else if (e.level !== undefined) {
                    out.push({ at: e.t, set: "gain", value: Number(e.level) });
                    notes.add("Fade-ins and levels became changes to the whole group's volume.");
                }
                out.push({ at: e.t, play: name });
                playing[gi].add(name);
                if (e.ratio !== undefined && Number(e.ratio) !== 1) notes.add('"ratio" (phones drifting apart inside a group) has no equivalent here, so it was left out.');
            } else if (e.stop !== undefined) {
                const names = e.stop === "all" ? [...playing[gi]] : [String(e.stop)];
                if (fade > 0) {
                    out.push({ at: e.t, ramp: "gain", to: 0, over: fade });
                    notes.add("Fade-outs became a volume ramp to 0, then a stop when the fade ends.");
                }
                for (const n of names) { out.push({ at: e.t + fade, stop: n }); playing[gi].delete(n); }
            } else if (e.level !== undefined) {
                out.push(fade > 0 ? { at: e.t, ramp: "gain", to: Number(e.level), over: fade } : { at: e.t, set: "gain", value: Number(e.level) });
            } else if (e.ratio !== undefined) {
                notes.add('"ratio" (phones drifting apart inside a group) has no equivalent here, so it was left out.');
            }
        }
    }

    const score = { title: src.title || "", sounds: {}, groups: {} };
    for (const [name, path] of Object.entries(src.sounds || {})) score.sounds[String(name)] = path;
    groups.forEach((g, i) => { score.groups[i] = g; });
    return { score, notes: [...notes] };
}
