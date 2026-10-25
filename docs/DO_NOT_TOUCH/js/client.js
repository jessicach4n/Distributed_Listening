// The phone (player) page: join, then play whatever piece the conductor loads.
import { Socket } from "./network/Socket.js";
import { AudioPlayer } from "./audio/AudioPlayer.js";
import { WS_URL, PIECES_URL } from "../config/url.js";

const startBtn = document.getElementById("start-btn");
const statusText = document.getElementById("status");
const groupId = document.getElementById("group-id");

const audioPlayer = new AudioPlayer();
let latestPiece = null; // the last "piece" message, so a replaced load doesn't update the page

function showStatus(text) {
  statusText.textContent = text;
}

const socket = new Socket(WS_URL, {
  onOpen() {
    startBtn.disabled = false;
    showStatus("Tap Join to take part.");

    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;

      try {
        // Tone.start() must run inside a user gesture to unlock audio.
        await Promise.all([audioPlayer.resume(), audioPlayer.syncClock(socket)]);
        socket.send({ type: "ready" });
        startBtn.style.display = "none";
      } catch (error) {
        console.error("Could not initialize audio:", error);
        showStatus("Could not start audio. Please try again.");
        startBtn.disabled = false;
      }
    });
  },

  onClose() {
    showStatus("Lost connection to the server. Reload the page to rejoin.");
  },

  onMessage(message) {
    switch (message.type) {
      case "waiting":
        showStatus("Joined! Waiting for the conductor to choose a piece…");
        break;

      case "piece": {
        // Sound file names in the score are relative to the piece's own folder.
        const soundsUrl = new URL(`${message.piece.id}/`, PIECES_URL);
        latestPiece = message;
        groupId.textContent = "";
        showStatus(`Loading “${message.piece.title}”…`);
        audioPlayer.initialize(message.score, message.group, message.startAt, soundsUrl)
          .then(() => {
            if (latestPiece !== message) return;
            groupId.textContent = `Group ${message.groupNumber}`;
            showStatus(`Ready to play “${message.piece.title}”. Keep this page open.`);
          })
          .catch((error) => {
            if (latestPiece !== message) return;
            console.error("Could not prepare audio:", error);
            showStatus(`Could not load “${message.piece.title}”: ${error.message}`);
          });
        break;
      }

      case "play":
        audioPlayer.play(message.startAt);
        break;

      case "stop":
        audioPlayer.stop();
        break;
    }
  },
});
