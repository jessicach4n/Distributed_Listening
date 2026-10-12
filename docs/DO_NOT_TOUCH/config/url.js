export const WS_URL = location.hostname === "localhost" || "127.0.0.1"
  ? "ws://localhost:8080"
  : "wss://distributed-listening.onrender.com";
