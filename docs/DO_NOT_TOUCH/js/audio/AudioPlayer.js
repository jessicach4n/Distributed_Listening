export class AudioPlayer {
    constructor() {
        this.clockOffset = 0; // serverTime - localTime, in ms
        this.startAt = null;
        this.part = null;
    }

    async initialize(score, group, startAt = null) {
        if (!score?.groups?.[group]) {
            throw new Error(`Score does not contain group "${group}".`);
        }
        if (startAt !== null && startAt !== undefined) {
            this.startAt = startAt;
        }
        if (this.part) {
            return;
        }

        const groupPart = score.groups[group];
        const gain = new Tone.Gain(1).toDestination();
        const params = { gain: { param: gain.gain, initial: 1 } };
        const effectNodes = [];

        for (const effect of groupPart.effects) {
            let node;
            switch (effect.type) {
                case "lowpass":
                case "highpass":
                case "bandpass":
                    node = new Tone.Filter(effect.frequency, effect.type);
                    break;
                default:
                    console.warn("Unknown effect type, skipping:", effect.type);
                    continue;
            }

            effectNodes.push(node);
            if (effect.id && node.frequency) {
                params[`${effect.id}.frequency`] = {
                    param: node.frequency,
                    initial: effect.frequency,
                };
            }
        }

        Tone.connectSeries(...effectNodes, gain);
        const input = effectNodes[0] ?? gain;
        const players = {};
        const events = [];
        for (const event of groupPart.events) {
            const sound = event.play ?? event.stop;
            const target = event.set ?? event.ramp;
            if (sound !== undefined) {
                const soundPath = score.sounds?.[sound];
                if (!soundPath) {
                    console.warn("Unknown sound, skipping event:", event);
                    continue;
                }
                players[sound] ??= new Tone.Player(
                    new URL(soundPath, document.baseURI).href,
                ).connect(input);
            } else if (target !== undefined && !params[target]) {
                console.warn("Unknown target, skipping event:", event);
                continue;
            }
            events.push(event);
        }

        events.sort((a, b) => a.at - b.at);
        await Tone.loaded();
        this.part = { players, params, events, nodes: [...effectNodes, gain] };
        if (this.startAt !== null) {
            this.startTimeline();
        }
    }

    async resume() {
        await Tone.start();
    }

    async syncClock(socket, samples = 5) {
        const webSocket = socket?.socket ?? socket;
        if (
            !webSocket ||
            typeof webSocket.send !== "function" ||
            typeof webSocket.addEventListener !== "function"
        ) {
            throw new TypeError("A connected WebSocket is required to sync the clock.");
        }
        if (!Number.isInteger(samples) || samples < 1) {
            throw new RangeError("Clock sync samples must be a positive integer.");
        }

        return new Promise((resolve, reject) => {
            const results = [];
            let pendingClientTime;

            const cleanup = () => {
                webSocket.removeEventListener("message", onMessage);
                webSocket.removeEventListener("close", onClose);
            };
            const fail = (error) => {
                cleanup();
                reject(error);
            };
            const ping = () => {
                if (webSocket.readyState !== WebSocket.OPEN) {
                    fail(new Error("WebSocket disconnected during clock sync."));
                    return;
                }
                pendingClientTime = Date.now();
                try {
                    const message = { type: "sync", clientTime: pendingClientTime };
                    if (typeof socket.send === "function" && socket.socket) {
                        socket.send(message);
                    } else {
                        webSocket.send(JSON.stringify(message));
                    }
                } catch (error) {
                    fail(error);
                }
            };
            const onClose = () => {
                fail(new Error("WebSocket disconnected during clock sync."));
            };
            const onMessage = (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (error) {
                    fail(error);
                    return;
                }
                if (
                    message.type !== "sync" ||
                    message.clientTime !== pendingClientTime
                ) {
                    return;
                }

                const rtt = Date.now() - message.clientTime;
                results.push({
                    rtt,
                    offset: message.serverTime - (message.clientTime + rtt / 2),
                });

                if (results.length < samples) {
                    ping();
                    return;
                }

                cleanup();
                this.clockOffset = results.reduce(
                    (best, result) => result.rtt < best.rtt ? result : best,
                ).offset;
                console.log(`Clock offset ${this.clockOffset}ms`);
                resolve(this.clockOffset);
            };

            webSocket.addEventListener("message", onMessage);
            webSocket.addEventListener("close", onClose);
            ping();
        });
    }

    applyEvent(event, time) {
        if (event.play !== undefined) {
            this.part.players[event.play].start(time);
        } else if (event.stop !== undefined) {
            this.part.players[event.stop].stop(time);
        } else if (event.set !== undefined) {
            this.part.params[event.set].param.setValueAtTime(event.value, time);
        } else if (event.ramp !== undefined) {
            this.part.params[event.ramp].param.rampTo(event.to, event.over, time);
        }
    }

    catchUp(position, startTime) {
        const values = {};
        const ramps = {};
        const playing = {};
        for (const [name, { initial }] of Object.entries(this.part.params)) {
            values[name] = initial;
        }

        for (const event of this.part.events) {
            if (event.at >= position) break;
            if (event.play !== undefined) {
                playing[event.play] = event.at;
            } else if (event.stop !== undefined) {
                delete playing[event.stop];
            } else if (event.set !== undefined) {
                values[event.set] = event.value;
                delete ramps[event.set];
            } else if (event.ramp !== undefined) {
                const name = event.ramp;
                const done = (position - event.at) / event.over;
                if (done >= 1) {
                    values[name] = event.to;
                    delete ramps[name];
                } else {
                    values[name] += (event.to - values[name]) * done;
                    ramps[name] = {
                        to: event.to,
                        over: event.over * (1 - done),
                    };
                }
            }
        }

        for (const [name, { param }] of Object.entries(this.part.params)) {
            param.cancelScheduledValues(0);
            param.setValueAtTime(values[name], Tone.now());
            if (ramps[name]) {
                param.rampTo(ramps[name].to, ramps[name].over, startTime);
            }
        }
        for (const [sound, at] of Object.entries(playing)) {
            const player = this.part.players[sound];
            const offset = position - at;
            if (offset < player.buffer.duration) {
                player.start(startTime, offset);
            }
        }
    }

    play(startAt) {
        this.startAt = startAt;
        if (this.part) {
            this.startTimeline();
        }
    }

    startTimeline() {
        if (!this.part || this.startAt === null) return;

        this.stopTimeline();
        const transport = Tone.getTransport();
        const delay = (this.startAt - this.clockOffset - Date.now()) / 1000;
        const position = Math.max(0, -delay);
        const startTime = Tone.now() + Math.max(0, delay);

        this.catchUp(position, startTime);
        for (const event of this.part.events) {
            if (event.at >= position) {
                transport.schedule((time) => this.applyEvent(event, time), event.at);
            }
        }
        transport.start(startTime, position);
        console.log(`Timeline starting at position ${position.toFixed(2)}s`);
    }

    stopTimeline() {
        const transport = Tone.getTransport();
        transport.stop();
        transport.cancel();
        for (const player of Object.values(this.part.players)) {
            player.stop();
        }
    }

    stop() {
        this.startAt = null;
        if (this.part) {
            this.stopTimeline();
        }
    }
}