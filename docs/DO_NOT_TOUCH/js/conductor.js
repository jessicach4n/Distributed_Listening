// The conductor page: choose which piece (folder in docs/performances) every
// phone plays, then start and stop it for everyone.
import { Socket } from "./network/Socket.js";
import { WS_URL } from "../config/url.js";

const connection = document.getElementById("connection");
const pieceSelect = document.getElementById("piece-select");
const refreshBtn = document.getElementById("refresh-btn");
const loadBtn = document.getElementById("load-btn");
const errorText = document.getElementById("error");
const pieceInfo = document.getElementById("piece-info");
const phoneInfo = document.getElementById("phone-info");
const groupList = document.getElementById("group-list");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");

let status = null; // last "status" from the server

function showPieces(pieces) {
  pieceSelect.replaceChildren();
  for (const piece of pieces) {
    const option = document.createElement("option");
    option.value = piece.id;
    option.textContent = `${piece.id}: ${piece.title}${piece.error ? " (has a problem)" : ""}`;
    option.title = piece.error ?? "";
    pieceSelect.append(option);
  }
  if (!pieces.length) {
    const option = document.createElement("option");
    option.textContent = "No pieces found in performances";
    pieceSelect.append(option);
  }
  // Keep the loaded piece selected after a refresh.
  if (status?.piece && pieces.some((piece) => piece.id === status.piece.id)) {
    pieceSelect.value = status.piece.id;
  }
  pieceSelect.disabled = !pieces.length;
  loadBtn.disabled = !pieces.length;
  refreshBtn.disabled = false;
}

function showStatus() {
  const { piece, playing, phones, perGroup } = status;
  pieceInfo.textContent = piece
    ? `Loaded: ${piece.id}: ${piece.title}${playing ? " (playing)" : ""}`
    : "No piece loaded.";
  phoneInfo.textContent = `${phones} phone${phones === 1 ? "" : "s"} joined.`;

  groupList.replaceChildren();
  if (piece) {
    piece.groupNames.forEach((name, i) => {
      const item = document.createElement("li");
      item.textContent = `${name}: ${perGroup[i]} phone${perGroup[i] === 1 ? "" : "s"}`;
      groupList.append(item);
    });
  }
  playBtn.disabled = !piece;
  stopBtn.disabled = !piece || !playing;
}

const socket = new Socket(WS_URL, {
  onOpen() {
    connection.textContent = "Connected to the server.";
    socket.send({ type: "conductor" });
  },

  onClose() {
    connection.textContent = "Lost connection to the server. Reload the page to reconnect.";
    for (const control of [pieceSelect, refreshBtn, loadBtn, playBtn, stopBtn]) control.disabled = true;
  },

  onMessage(message) {
    switch (message.type) {
      case "pieces":
        showPieces(message.pieces);
        break;

      case "status":
        status = message;
        showStatus();
        break;

      case "error":
        errorText.textContent = message.message;
        loadBtn.disabled = false;
        break;
    }
  },
});

refreshBtn.addEventListener("click", () => {
  refreshBtn.disabled = true;
  errorText.textContent = "";
  socket.send({ type: "list-pieces" });
});

loadBtn.addEventListener("click", () => {
  errorText.textContent = "";
  socket.send({ type: "load-piece", piece: pieceSelect.value });
});

playBtn.addEventListener("click", () => socket.send({ type: "play" }));
stopBtn.addEventListener("click", () => socket.send({ type: "stop" }));
