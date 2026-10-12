import { Socket } from "./network/Socket.js";
import { AudioPlayer } from "./audio/AudioPlayer.js";
import { WS_URL } from "../config/url.js";

const startBtn = document.getElementById("start-btn");
const controls = document.getElementById("controls");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const groupId = document.getElementById("group-id");

const audioPlayer = new AudioPlayer(
  new URL("../../audio-files/test.wav", import.meta.url),
);

const socket = new Socket(WS_URL, {
  onOpen() {
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;

      try {
        await Promise.all([audioPlayer.resume(), audioPlayer.initialize()]);
        socket.send({ type: "ready" });
      } catch (error) {
        console.error("Could not initialize audio:", error);
      } finally {
        startBtn.disabled = false;
      }
    });

    playBtn.addEventListener("click", () => {
      socket.send({ type: "play" });
    });

    stopBtn.addEventListener("click", () => {
      socket.send({ type: "stop" });
    });
  },

  onMessage(message) {
    switch (message.type) {
      case "ready":
        controls.style.display = "block";
        startBtn.style.display = "none";
        groupId.textContent = `Group ${message.group}`;
        break;

      case "play":
        audioPlayer.play();
        break;

      case "stop":
        audioPlayer.stop();
        break;
    }
  },
});