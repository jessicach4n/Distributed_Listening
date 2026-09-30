const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const Phone = require("./Phone");

const ALLOWED_ORIGINS = [
  "https://jessicach4n.github.io",
  "http://localhost:5500",
];

const PORT = process.env.PORT || 8080;

// The score is the single source of truth for the piece. The server reads it
// to know how many groups there are, and sends it to each phone on "ready".
const SCORE_PATH = path.join(__dirname, "..", "docs", "test.json");
const score = JSON.parse(fs.readFileSync(SCORE_PATH, "utf8"));
const numGroups = Object.keys(score.groups).length;

// How far in the future the shared timeline starts after "play" is pressed,
// so every phone receives the cue before time 0 arrives.
const START_LEAD_MS = 1000;

// Server-clock time (ms) at which the timeline started, or null when stopped.
// Phones that join mid-piece use this to jump to the right position.
let startAt = null;

const clients = new Set();

const wss = new WebSocket.Server({
  port: PORT,
  verifyClient: ({ origin }) => {
    if (!origin) return false;
    return ALLOWED_ORIGINS.includes(origin);
  },
});

wss.on("listening", () => {
  console.log(`WebSocket server listening on ws://localhost:${PORT}`);
  console.log(`Loaded score "${SCORE_PATH}" with ${numGroups} groups`);
});

wss.on("error", (error) => {
  console.error("Server error:", error.message);
});

wss.on("connection", (socket) => {
  const phone = new Phone(socket, numGroups);
  clients.add(phone);
  console.log(`Phone ${phone.id} connected (group ${phone.assignedGroup}), ${clients.size} connected`);

  socket.on("message", (data) => {
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
            phone.send({ type: "sync", clientTime: message.clientTime, serverTime: Date.now() });
        break;
        case "ready":
            // Send the phone its group and the score. If the piece is already
            // running, include startAt so it can join at the current position.
            phone.send({ type: "ready", group: phone.assignedGroup, score, startAt });
        break;
        case "play":
            startAt = Date.now() + START_LEAD_MS;
            for (const client of clients) {
                client.play(startAt);
            }
        break;
        case "stop":
            startAt = null;
            for (const client of clients) {
                client.stop();
            }
        break;
        default:
            console.log("Unknown message type:", message.type);
    }
  });

  socket.on("close", () => {
    clients.delete(phone);
    console.log(`Phone ${phone.id} disconnected, ${clients.size} connected`);
  });
});
