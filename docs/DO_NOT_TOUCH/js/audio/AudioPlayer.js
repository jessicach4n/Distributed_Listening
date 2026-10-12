export class AudioPlayer {
    constructor(audioUrl) {
        this.audioContext = new AudioContext();
        this.audioUrl = audioUrl;
        this.audioBuffer = null;
        this.activeSource = null;
    }

    async initialize() {
        if (this.audioBuffer) {
            return;
        }
        const response = await fetch(this.audioUrl);
        if (!response.ok) {
            throw new Error(`Could not load audio: ${response.status}`);
        }
        const data = await response.arrayBuffer();
        this.audioBuffer = await this.audioContext.decodeAudioData(data);
    }

    async resume() {
        if (this.audioContext.state === "suspended") {
            await this.audioContext.resume();
        }
    }

    play() {
        if (!this.audioBuffer) {
            throw new Error(
                "AudioPlayer has not been initialized. Call initialize() first.",
            );
        }
        this.stop();
        this.activeSource = this.audioContext.createBufferSource();
        this.activeSource.buffer = this.audioBuffer;
        this.activeSource.connect(this.audioContext.destination);
        this.activeSource.start();
    }

    stop() {
        if (this.activeSource) {
            this.activeSource.stop();
            this.activeSource.disconnect();
            this.activeSource = null;
        }
    }

    async close() {
        this.stop();

        if (this.audioContext.state !== "closed") {
            await this.audioContext.close();
        }
    }
}