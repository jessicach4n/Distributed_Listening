const WS_URL = location.hostname === "localhost"
  ? "ws://localhost:8080"
  : "wss://distributed-listening.onrender.com";
const socket = new WebSocket(WS_URL);

const startBtn = document.getElementById("start-btn");
const controls = document.getElementById("controls");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");
const groupId = document.getElementById("group-id");

const audioContext = new AudioContext();
let audioBuffer;
let activeSource;

const audioBufferPromise = fetch(new URL("../audio/test.wav", import.meta.url))
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load audio: ${response.status}`);
    }
    return response.arrayBuffer();
  })
  .then((data) => audioContext.decodeAudioData(data))
  .then((buffer) => {
    audioBuffer = buffer;
  });

function stopAudio() {
  if (activeSource) {
    activeSource.stop();
    activeSource.disconnect();
    activeSource = null;
  }
}

socket.addEventListener("open", () => {
  console.log("Connected to WebSocket server");

  startBtn.addEventListener("click", () => {
    Promise.all([audioContext.resume(), audioBufferPromise])
      .then(() => socket.send(JSON.stringify({ type: "ready" })))
      .catch((error) => {
        console.error("Could not initialize audio:", error);
      });
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
        groupId.textContent = `Group ${message.group}`;
    }

    if (message.type === "play") {
      stopAudio();
      activeSource = audioContext.createBufferSource();
      activeSource.buffer = audioBuffer;
      activeSource.connect(audioContext.destination);
      activeSource.start();
    }

    else if (message.type === "stop") {
      stopAudio();
    }
  });
});
