// The conductor page: choose which piece (folder in docs/performances) every
// phone plays, then start and stop it for everyone.
import { Socket } from "../network/Socket.js";
import { WS_URL } from "../../config/url.js";

const connection = document.getElementById("connection");
const loadingScreen = document.getElementById("loading-screen");
const piecesList = document.getElementById("pieces-list");
const previousPiecesBtn = document.getElementById("pieces-previous");
const nextPiecesBtn = document.getElementById("pieces-next");
const refreshBtn = document.getElementById("refresh-btn");
const errorText = document.getElementById("error");
const pieceInfo = document.getElementById("piece-info");
const phoneInfo = document.getElementById("phone-info");
const playerQrCode = document.getElementById("player-qr-code");
const groupList = document.getElementById("group-list");
const deselectBtn = document.getElementById("deselect-btn");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");

const loadingStartedAt = Date.now();
const minimumLoadingDuration = 2500;
let loadingTimer;
let status = null; // last "status" from the server

const playerPageUrl = new URL("../player/player.html", window.location.href).href;
if (window.QRCode) {
  new window.QRCode(playerQrCode, {
    text: playerPageUrl,
    width: 128,
    height: 128,
    correctLevel: window.QRCode.CorrectLevel.M,
  });
} else {
  console.error("Could not load QR code generator.");
  playerQrCode.textContent = "QR code unavailable. Use the player page link below.";
}

function updatePieceScrollControls() {
  const canScroll = piecesList.scrollWidth > piecesList.clientWidth + 1;
  previousPiecesBtn.disabled = piecesList.scrollLeft <= 0;
  nextPiecesBtn.disabled = piecesList.scrollLeft + piecesList.clientWidth >= piecesList.scrollWidth - 1;
  previousPiecesBtn.hidden = !canScroll || previousPiecesBtn.disabled;
  nextPiecesBtn.hidden = !canScroll || nextPiecesBtn.disabled;
}

function showPieces(pieces) {
  piecesList.replaceChildren();
  for (const piece of pieces) {
    const card = document.createElement("div");
    card.className = "piece-card";
    card.dataset.pieceId = piece.id;

    const title = document.createElement("h3");
    title.textContent = `${piece.id}: ${piece.title}`;
    card.append(title);

    if (piece.error) {
      const problem = document.createElement("p");
      problem.className = "piece-error";
      problem.textContent = piece.error;
      card.append(problem);
    }

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "Load piece";
    loadButton.addEventListener("click", () => {
      errorText.textContent = "";
      socket.send({ type: "load-piece", piece: piece.id });
    });
    card.append(loadButton);
    piecesList.append(card);
  }
  if (!pieces.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "No pieces found in performances.";
    piecesList.append(emptyMessage);
  }
  updateSelectedPiece();
  updatePieceScrollControls();
  refreshBtn.disabled = false;
}

function updateSelectedPiece() {
  for (const card of piecesList.querySelectorAll(".piece-card")) {
    const isLoaded = card.dataset.pieceId === status?.piece?.id;
    card.classList.toggle("is-loaded", isLoaded);
    card.setAttribute("aria-current", isLoaded ? "true" : "false");
  }
}

function showStatus() {
  const { piece, playing, phones, perGroup } = status;
  pieceInfo.textContent = piece
    ? `Loaded: ${piece.id}: ${piece.title}${playing ? " (playing)" : ""}`
    : "No piece loaded.";
  phoneInfo.textContent = `${phones} phone${phones === 1 ? "" : "s"} joined the room.`;

  groupList.replaceChildren();
  if (piece) {
    piece.groupNames.forEach((name, i) => {
      const item = document.createElement("li");
      item.textContent = `${name}: ${perGroup[i]} phone${perGroup[i] === 1 ? "" : "s"}`;
      groupList.append(item);
    });
  }
  deselectBtn.disabled = !piece;
  playBtn.disabled = !piece;
  stopBtn.disabled = !piece || !playing;
  updateSelectedPiece();
}

const socket = new Socket(WS_URL, {
  onOpen() {
    const remainingLoadingTime = minimumLoadingDuration - (Date.now() - loadingStartedAt);
    if (remainingLoadingTime > 0) {
      loadingTimer = window.setTimeout(
        () => loadingScreen.classList.add("is-hidden"),
        remainingLoadingTime,
      );
    } else {
      loadingScreen.classList.add("is-hidden");
    }
    socket.send({ type: "conductor" });
  },

  onClose() {
    window.clearTimeout(loadingTimer);
    connection.textContent = "Lost connection to the server. Reload the page to reconnect.";
    loadingScreen.classList.remove("is-connecting", "is-hidden");
    refreshBtn.disabled = true;
    for (const loadButton of piecesList.querySelectorAll("button")) loadButton.disabled = true;
    for (const control of [deselectBtn, playBtn, stopBtn]) control.disabled = true;
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
        break;
    }
  },
});

piecesList.addEventListener("scroll", updatePieceScrollControls);
window.addEventListener("resize", updatePieceScrollControls);
previousPiecesBtn.addEventListener("click", () => {
  piecesList.scrollBy({ left: -piecesList.clientWidth, behavior: "smooth" });
});
nextPiecesBtn.addEventListener("click", () => {
  piecesList.scrollBy({ left: piecesList.clientWidth, behavior: "smooth" });
});

refreshBtn.addEventListener("click", () => {
  refreshBtn.disabled = true;
  errorText.textContent = "";
  socket.send({ type: "list-pieces" });
});

playBtn.addEventListener("click", () => socket.send({ type: "play" }));
stopBtn.addEventListener("click", () => socket.send({ type: "stop" }));
deselectBtn.addEventListener("click", () => socket.send({ type: "deselect-piece" }));
