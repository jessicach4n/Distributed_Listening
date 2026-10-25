const fs = require("fs/promises");
const path = require("path");

// A piece is one folder in docs/performances/ (named 1, 2, 3, ...) holding a
// score.json and the audio files it uses. Not to be confused with the phone
// groups inside a score ("groups": { "0": ..., "1": ... }).
//
// Where pieces are read from:
//   "pages": the live GitHub Pages site, the same place phones download the
//            audio from, so a folder pushed to GitHub works without a redeploy.
//   "local": this repo's copy on disk, for running everything on one machine.
// Render sets RENDER=true, so it uses "pages"; PIECES_SOURCE overrides either.
const SOURCE = process.env.PIECES_SOURCE || (process.env.RENDER ? "pages" : "local");
const PAGES_URL = (process.env.PAGES_URL || "https://jessicach4n.github.io/Distributed_Listening")
  .replace(/\/$/, "");
const LOCAL_DIR = path.join(__dirname, "..", "..", "docs", "performances");

// Pages can't list a folder, so "pages" tries 1, 2, 3, ... and stops after
// this many missing numbers in a row (so one deleted folder doesn't hide the rest).
const MAX_GAP = 3;
const MAX_PIECES = 200;

// Folder names are plain numbers; anything else could escape performances/.
function checkId(id) {
  if (!/^\d+$/.test(String(id))) throw new Error(`Invalid piece "${id}": folders are named 1, 2, 3, ...`);
  return String(id);
}

// Returns the parsed score.json of folder `id`, or null if the folder has none.
async function readScore(id) {
  let text;
  if (SOURCE === "pages") {
    // The query string skips Pages' cache, so an edit shows up straight away.
    const response = await fetch(`${PAGES_URL}/performances/${id}/score.json?t=${Date.now()}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Could not fetch folder ${id}'s score.json: HTTP ${response.status}`);
    text = await response.text();
  } else {
    try {
      text = await fs.readFile(path.join(LOCAL_DIR, id, "score.json"), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  let score;
  try {
    score = JSON.parse(text);
  } catch (error) {
    throw new Error(`Folder ${id}'s score.json is not valid JSON: ${error.message}`);
  }
  if (!score?.groups || typeof score.groups !== "object" || !Object.keys(score.groups).length) {
    throw new Error(`Folder ${id}'s score.json has no "groups"`);
  }
  return score;
}

// Every piece available, as [{ id, title }] in folder order. A folder whose
// score can't be read is still listed, with `error` saying why.
async function listPieces() {
  const summarize = async (id) => {
    try {
      const score = await readScore(id);
      return score && { id, title: score.title || `Piece ${id}` };
    } catch (error) {
      return { id, title: `Piece ${id}`, error: error.message };
    }
  };

  if (SOURCE === "local") {
    const entries = await fs.readdir(LOCAL_DIR, { withFileTypes: true }).catch(() => []);
    const ids = entries
      .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a - b);
    return (await Promise.all(ids.map(summarize))).filter(Boolean);
  }

  const pieces = [];
  for (let id = 1, gap = 0; gap < MAX_GAP && id <= MAX_PIECES; id++) {
    const piece = await summarize(String(id));
    if (piece) {
      pieces.push(piece);
      gap = 0;
    } else {
      gap++;
    }
  }
  return pieces;
}

// Loads folder `id` as { id, title, score, numGroups }.
async function loadPiece(id) {
  id = checkId(id);
  const score = await readScore(id);
  if (!score) throw new Error(`Folder ${id} has no score.json`);
  return { id, title: score.title || `Piece ${id}`, score, numGroups: Object.keys(score.groups).length };
}

module.exports = { listPieces, loadPiece, SOURCE, PAGES_URL };
