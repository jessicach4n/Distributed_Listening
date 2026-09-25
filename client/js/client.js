const WS_URL = "ws://localhost:8080";
const socket = new WebSocket(WS_URL);

const startBtn = document.getElementById("start-btn");
const controls = document.getElementById("controls");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");

const audio = new Audio(new URL("../audio/test.wav", import.meta.url));
audio.preload = "auto";

socket.addEventListener("open", () => {
  console.log("Connected to WebSocket server");

  startBtn.addEventListener("click", () => {
    socket.send(JSON.stringify({ type: "ready" }));
  });

  playBtn.addEventListener("click", () => {
    socket.send(JSON.stringify({ type: "play" }));
  });

  stopBtn.addEventListener("click", () => {
    socket.send(JSON.stringify({ type: "stop" }));
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "ready") {
        controls.style.display = "block";
        startBtn.style.display = "none";
    }

    if (message.type === "play") {
      audio.currentTime = 0;
      audio.play().catch((error) => {
        console.error("Could not play audio:", error);
      });
    }

    else if (message.type === "stop") {
      audio.pause();
      audio.currentTime = 0;
    }
  });
});
