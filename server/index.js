const WebSocket = require("ws");
const Phone = require("./components/Phone");
const pieces = require("./components/pieces");

const ALLOWED_ORIGINS = [
  "https://jessicach4n.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

const PORT = process.env.PORT || 8080;

// How far in the future the shared timeline starts after "play" is pressed,
// so every phone receives the cue before time 0 arrives.
const START_LEAD_MS = 1000;

// The piece the conductor has loaded, as { id, title, score, numGroups }, or
// null until one is chosen. Its score is the single source of truth: it says
// how many groups there are, and is sent to each phone.
let piece = null;

// Server-clock time (ms) at which the timeline started, or null when stopped.
// Phones that join mid-piece use this to jump to the right position.
let startAt = null;

const phones = new Set();     // phones that pressed "join", in join order
const conductors = new Set(); // sockets of open conductor pages

const wss = new WebSocket.Server({
  port: PORT,
  verifyClient: ({ origin }) => {
    if (!origin) return false;
    return ALLOWED_ORIGINS.includes(origin);
  },
});

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
  const from = pieces.SOURCE === "pages" ? pieces.PAGES_URL : "docs/performances on disk";
  console.log(`Reading pieces from ${from}`);
});

wss.on("error", (error) => {
  console.error("Server error:", error.message);
});

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

// What every conductor page shows: the loaded piece, whether it's playing,
// and how many phones are in each of its groups.
function broadcastStatus() {
  const perGroup = piece ? Array(piece.numGroups).fill(0) : [];
  for (const phone of phones) {
    if (phone.assignedGroup !== null) perGroup[phone.assignedGroup]++;
  }
  const groupNames = piece
    ? Object.values(piece.score.groups).map((group, i) => group.name || `Group ${i + 1}`)
    : [];
  const status = {
    type: "status",
    piece: piece && { id: piece.id, title: piece.title, groupNames },
    playing: startAt !== null,
    phones: phones.size,
    perGroup,
  };
  for (const socket of conductors) send(socket, status);
}

// Puts a phone in whichever group has the fewest phones, so groups stay
// balanced as people come and go.
function assignGroup(phone) {
  const counts = Array(piece.numGroups).fill(0);
  for (const other of phones) {
    if (other !== phone && other.assignedGroup !== null) counts[other.assignedGroup]++;
  }
  phone.assignedGroup = counts.indexOf(Math.min(...counts));
}

// Tells a phone what to play: the score, its group, and (if the piece is
// already running) startAt so it can join at the current position.
function sendPiece(phone) {
  if (!piece) {
    phone.send({ type: "waiting", deviceId: phone.id });
    return;
  }
  phone.send({
    type: "piece",
    deviceId: phone.id,
    piece: { id: piece.id, title: piece.title },
    group: Object.keys(piece.score.groups)[phone.assignedGroup],
    groupNumber: phone.assignedGroup + 1,
    score: piece.score,
    startAt,
  });
}

function stopAll() {
  startAt = null;
  for (const phone of phones) phone.stop();
}

async function sendPieceList(socket) {
  try {
    send(socket, { type: "pieces", pieces: await pieces.listPieces() });
  } catch (error) {
    send(socket, { type: "error", message: `Could not list pieces: ${error.message}` });
  }
}

wss.on("connection", (socket) => {
  let phone = null;        // set once this socket joins as a phone
  let isConductor = false; // set once this socket says it's a conductor page

  socket.on("message", async (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      console.error("Invalid JSON received:", data.toString());
      return;
    }

    switch (message.type) {
        case "sync":
            // Clock sync: echo the client's timestamp back with ours so the
            // client can estimate the offset between the two clocks.
            send(socket, { type: "sync", clientTime: message.clientTime, serverTime: Date.now() });
        break;

        // --- From phones ---
        case "ready":
            if (!phone) {
                phone = new Phone(socket);
                phones.add(phone);
                if (piece) assignGroup(phone);
                console.log(`Phone ${phone.id} joined (group ${phone.assignedGroup}), ${phones.size} phones`);
            }
            sendPiece(phone);
            broadcastStatus();
        break;

        // --- From the conductor page ---
        case "conductor":
            isConductor = true;
            conductors.add(socket);
            broadcastStatus();
            await sendPieceList(socket);
        break;
        case "list-pieces":
            if (isConductor) await sendPieceList(socket);
        break;
        case "load-piece":
            if (!isConductor) break;
            try {
                const loaded = await pieces.loadPiece(message.piece);
                stopAll();
                piece = loaded;
                // Share the phones out across the new piece's groups, in join order.
                let i = 0;
                for (const p of phones) p.assignedGroup = i++ % piece.numGroups;
                for (const p of phones) sendPiece(p);
                console.log(`Loaded piece ${piece.id} "${piece.title}" with ${piece.numGroups} groups`);
            } catch (error) {
                console.error("Could not load piece:", error.message);
                send(socket, { type: "error", message: error.message });
            }
            broadcastStatus();
        break;
        case "play":
            if (!isConductor || !piece) break;
            startAt = Date.now() + START_LEAD_MS;
            for (const p of phones) p.play(startAt);
            broadcastStatus();
        break;
        case "stop":
            if (!isConductor) break;
            stopAll();
            broadcastStatus();
        break;
        case "deselect-piece":
            if (!isConductor) break;
            stopAll();
            piece = null;
            for (const p of phones) {
              p.assignedGroup = null;
              p.send({ type: "waiting", deviceId: p.id });
            }
            broadcastStatus();
        break;

        default:
            console.log("Unknown message type:", message.type);
    }
  });

  socket.on("close", () => {
    if (phone) {
      phones.delete(phone);
      console.log(`Phone ${phone.id} left, ${phones.size} phones`);
    }
    conductors.delete(socket);
    broadcastStatus();
  });
});
