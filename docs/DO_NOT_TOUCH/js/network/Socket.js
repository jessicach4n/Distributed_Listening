export class Socket {
    constructor(url, handlers = {}) {
        this.socket = new WebSocket(url);
        this.handlers = handlers;

        this.socket.addEventListener("open", () => {
            console.log("Connected to WebSocket server");
            handlers.onOpen?.();
        });

        this.socket.addEventListener("message", (event) => {
            const message = JSON.parse(event.data);
            this.handlers.onMessage?.(message);
        });

        this.socket.addEventListener("close", () => {
            console.log("Disconnected from WebSocket server");
            this.handlers.onClose?.();
        });

        this.socket.addEventListener("error", (error) => {
            console.error("WebSocket error:", error);
            this.handlers.onError?.(error);
        });
    }

    send(message) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            throw new Error("WebSocket is not connected");
        }
        this.socket.send(JSON.stringify(message));
    }

    close() {
        this.socket.close();
    }
}