const WebSocket = require("ws");

// Starts at 0 and resets whenever the server restarts.
let nextId = 0;

class Phone {
  constructor(socket) {
    this.socket = socket;
    this.id = nextId++;
    // Which of the loaded piece's groups this phone plays; null until a piece is loaded.
    this.assignedGroup = null;
    this.isActive = false;
  }

  send(message) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  // startAt is the server-clock time (ms) at which the piece's timeline is at 0.
  play(startAt) {
    this.isActive = true;
    this.send({ type: "play", startAt });
    console.log(`Phone ${this.id} (group ${this.assignedGroup}) playing`);
  }

  stop() {
    this.isActive = false;
    this.send({ type: "stop" });
  }
}

module.exports = Phone;
