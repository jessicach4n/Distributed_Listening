const socket = io();
const display = document.getElementById("display");

display.textContent = "Connecting to WebSocket server...";

try {
    socket.on("connect", () => {
        display.textContent = "Connected to WebSocket server.";
    });

    socket.on("audio-info", (data) => {
        display.textContent = `Audio channels: ${data.channels}`;
    });

} catch (error) {
    console.error("WebSocket connection error:", error);
    display.textContent = "Failed to connect to WebSocket server.";
}