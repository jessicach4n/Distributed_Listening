// The phone (player) page: join, then play whatever piece the conductor loads.
import { Socket } from "../network/Socket.js";
import { AudioPlayer } from "../audio/AudioPlayer.js";
import { WS_URL, PIECES_URL } from "../../config/url.js";

const startBtn = document.getElementById("start-btn");
const landingScreen = document.getElementById("landing-screen");
const waitingScreen = document.getElementById("waiting-screen");
const deviceIdScreen = document.getElementById("device-id-screen");
const canvasScreen = document.getElementById("canvas-screen");
const connectionStatus = document.getElementById("connection-status");
const statusText = document.getElementById("status");
const groupInfo = document.getElementById("group-info");
const groupId = document.getElementById("group-id");
const menuGroupId = document.getElementById("menu-group-id");
const deviceIdText = document.getElementById("device-id");
const menuDeviceId = document.getElementById("menu-device-id");
const infoBtn = document.getElementById("info-btn");
const infoMenu = document.getElementById("info-menu");
const helpBtn = document.getElementById("help-btn");
const helpDialog = document.getElementById("help-dialog");
const quitBtn = document.getElementById("quit-btn");

const audioPlayer = new AudioPlayer();
let latestPiece = null; // the last "piece" message, so a replaced load doesn't update the page
let hasReachedCanvas = false;
let isJoinedAsParticipant = false;
let groupScreenTimer;
let deviceIdTimer;

function showStatus(text) {
  statusText.textContent = text;
}

function showScreen(screen) {
  for (const candidate of [landingScreen, waitingScreen, deviceIdScreen, canvasScreen]) {
    candidate.hidden = candidate !== screen;
  }
}

function setDeviceId(id) {
  deviceIdText.textContent = id;
  menuDeviceId.textContent = id;
}

const socket = new Socket(WS_URL, {
  onOpen() {
    startBtn.hidden = false;
    startBtn.disabled = false;
    connectionStatus.textContent = "Connection ready. Tap Start to take part.";
  },

  onClose() {
    startBtn.disabled = true;
    connectionStatus.textContent = "Lost connection to the server. Reload the page to rejoin.";
    if (!hasReachedCanvas && landingScreen.hidden) {
      showStatus("Lost connection to the server. Reload the page to rejoin.");
    }
  },

  onMessage(message) {
    if (!isJoinedAsParticipant) return;

    switch (message.type) {
      case "waiting":
        if (message.deviceId !== undefined) setDeviceId(message.deviceId);
        latestPiece = null;
        hasReachedCanvas = false;
        window.clearTimeout(groupScreenTimer);
        window.clearTimeout(deviceIdTimer);
        audioPlayer.reset();
        groupInfo.hidden = true;
        groupId.textContent = "";
        menuGroupId.textContent = "";
        showScreen(waitingScreen);
        showStatus("Waiting for the conductor to choose a piece…");
        break;

      case "piece": {
        if (message.deviceId !== undefined) setDeviceId(message.deviceId);
        // Sound file names in the score are relative to the piece's own folder.
        const soundsUrl = new URL(`${message.piece.id}/`, PIECES_URL);
        latestPiece = message;
        window.clearTimeout(groupScreenTimer);
        window.clearTimeout(deviceIdTimer);
        groupInfo.hidden = false;
        const currentGroup = message.score.groups[message.group]?.name || `Group ${message.groupNumber}`;
        groupId.textContent = currentGroup;
        menuGroupId.textContent = currentGroup;
        showStatus(`Loading “${message.piece.title}”…`);
        if (!hasReachedCanvas) showScreen(waitingScreen);
        audioPlayer.initialize(message.score, message.group, message.startAt, soundsUrl)
          .then(() => {
            if (latestPiece !== message) return;
            if (!hasReachedCanvas) {
              groupScreenTimer = window.setTimeout(() => {
                if (latestPiece !== message || hasReachedCanvas) return;
                showScreen(deviceIdScreen);
                deviceIdTimer = window.setTimeout(() => {
                  if (latestPiece !== message) return;
                  hasReachedCanvas = true;
                  showScreen(canvasScreen);
                }, 2500);
              }, 1500);
            }
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

startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;

  try {
    // Tone.start() must run inside a user gesture to unlock audio.
    await Promise.all([audioPlayer.resume(), audioPlayer.syncClock(socket)]);
    isJoinedAsParticipant = true;
    socket.send({ type: "ready" });
    showScreen(waitingScreen);
    showStatus("Waiting for the conductor to choose a piece…");
  } catch (error) {
    isJoinedAsParticipant = false;
    console.error("Could not initialize audio:", error);
    connectionStatus.textContent = "Could not start audio. Please try again.";
    startBtn.disabled = false;
  }
});

infoBtn.addEventListener("click", () => {
  infoMenu.hidden = !infoMenu.hidden;
  infoBtn.setAttribute("aria-expanded", String(!infoMenu.hidden));
});

helpBtn.addEventListener("click", () => {
  infoMenu.hidden = true;
  infoBtn.setAttribute("aria-expanded", "false");
  helpDialog.showModal();
});

quitBtn.addEventListener("click", () => {
  window.clearTimeout(groupScreenTimer);
  window.clearTimeout(deviceIdTimer);
  latestPiece = null;
  hasReachedCanvas = false;
  audioPlayer.reset();
  groupInfo.hidden = true;
  groupId.textContent = "";
  menuGroupId.textContent = "";
  infoMenu.hidden = true;
  infoBtn.setAttribute("aria-expanded", "false");

  if (isJoinedAsParticipant && socket.socket.readyState === WebSocket.OPEN) {
    socket.send({ type: "leave" });
  }
  isJoinedAsParticipant = false;
  startBtn.disabled = socket.socket.readyState !== WebSocket.OPEN;
  showScreen(landingScreen);
});