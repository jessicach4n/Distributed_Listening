const WebSocket = require("ws");

// Starts at 0 and resets whenever the server restarts.
let nextId = 0;

class Phone {
  constructor(socket, numGroups) {
    this.socket = socket;
    this.id = nextId++;
    this.assignedGroup = this.id % numGroups;
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
