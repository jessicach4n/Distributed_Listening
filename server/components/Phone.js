const WebSocket = require("ws");

// Starts at 0 and resets whenever the server restarts.
let nextId = 0;

class Phone {
  constructor(socket, numGroups) {
    this.socket = socket;
    this.id = nextId++;
    this.assignedGroup = this.id % numGroups;
    this.isActive = false;
    this.pendingPlay = null; // timer for a delayed play that hasn't fired yet
  }

  send(message) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  play(delayMs = 0) {
    this.cancelPendingPlay();
    this.pendingPlay = setTimeout(() => {
      this.pendingPlay = null;
      this.isActive = true;
      this.send({ type: "play" });
      console.log(`Phone ${this.id} (group ${this.assignedGroup}) playing`);
    }, delayMs);
  }

  stop() {
    this.cancelPendingPlay();
    this.isActive = false;
    this.send({ type: "stop" });
  }

  cancelPendingPlay() {
    if (this.pendingPlay) {
      clearTimeout(this.pendingPlay);
      this.pendingPlay = null;
    }
  }
}

module.exports = Phone;
