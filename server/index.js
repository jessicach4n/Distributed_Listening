const WebSocket = require("ws");
const Phone = require("./Phone");

const ALLOWED_ORIGINS = [
  "https://jessicach4n.github.io",
  "http://localhost:5500",
];

const PORT = process.env.PORT || 8080;

var numGroups = 3;

// Each group starts this much later than the one before it:
// group 0 plays immediately, group 1 after 5s, group 2 after 10s.
const GROUP_DELAY_MS = 5000;

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
        case "ready":
            phone.send({ type: "ready" });
        break;
        case "play":
            for (const client of clients) {
                client.play(client.assignedGroup * GROUP_DELAY_MS);
            }
        break;
        case "stop":
            for (const client of clients) {
                client.stop();
            }
        break;
        default:
            console.log("Unknown message type:", message.type);
    }
  });

  socket.on("close", () => {
    phone.cancelPendingPlay();
    clients.delete(phone);
    console.log(`Phone ${phone.id} disconnected, ${clients.size} connected`);
  });
});
