const WebSocket = require("ws");

const ALLOWED_ORIGINS = [
  "https://jessicach4n.github.io",
  "http://localhost:5500",
];

const PORT = process.env.PORT || 8080;

const clients = new Set();

const wss = new WebSocket.Server({
  port: PORT,
  verifyClient: ({ origin }) => {
    if (!origin) return false;
    return ALLOWED_ORIGINS.includes(origin);
  },
});

wss.on("connection", (socket) => {
  console.log("Client connected");
  
  socket.on("message", (data) => {
    message = JSON.parse(data.toString());

    switch (message.type) {
        case "ready":
            try {
                clients.add(socket);
                socket.send(JSON.stringify({ type: "ready" }));
            }
            catch (error) {
                console.error("Error adding client:", error);
            }
        break;
        case "play":
            for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "play" }));
            }
            }
        break;
        case "stop":
            for (const client of clients) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "stop" }));
            }
            }
        break;
        default:
            console.log("Unknown message type:", message.type);
    }
  });

  socket.on("close", () => {
    console.log("Client disconnected");
  });
});
