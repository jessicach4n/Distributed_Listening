const { decodeWav } = require("./utils/wav-decoder.js");

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

/** Decode Wav */

const FILE_PATH = "./audio/2-channels.wav";
const wavBuffer = fs.readFileSync(FILE_PATH);

const arrayBuffer = wavBuffer.buffer.slice(
  wavBuffer.byteOffset,
  wavBuffer.byteOffset + wavBuffer.byteLength
);

const audio = decodeWav(arrayBuffer);

io.on("connection", (socket) => {
  
  console.log("Client connected: " + socket.id);

  socket.emit("audio-info", {
    channels: audio.channels
  });
  
  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Server running on port 8080');
});
