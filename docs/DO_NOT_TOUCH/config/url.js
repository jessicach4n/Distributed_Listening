export const WS_URL = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "0.0.0.0"
  ? "ws://localhost:8080"
  : "wss://distributed-listening.onrender.com";

// docs/performances/: one folder per piece (1, 2, ...), holding its score.json
// and audio. Worked out from this file's location, so it's right from any page.
export const PIECES_URL = new URL("../../performances/", import.meta.url);
