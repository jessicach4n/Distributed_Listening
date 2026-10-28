// --- Building a group's part from the score --------------------------------
// Signal chain: players -> effects (in score order) -> volume -> destination.

// Turns one effect entry from the score into a Tone.js node, plus the settings
// events can change, as { name: { param, initial } }. A setting with `apply`
// instead of `param` can only be "set", not ramped (Tone has no smooth control
// for it). Every setting not given in the score falls back to the default here.
// `players` is the group's players, which "drift" acts on instead of a node.
function createEffect(effect, players) {
    switch (effect.type) {
        case "lowpass":
        case "highpass":
        case "bandpass": {
            const frequency = effect.frequency ?? 1000; // Hz
            const q = effect.q ?? 1;                    // resonance
            const node = new Tone.Filter({ type: effect.type, frequency, Q: q });
            const params = { q: { param: node.Q, initial: q } };

            // The form always writes the lfo settings and says whether they're
            // in use with `lfoOn`; hand-written scores just include `lfo` or not.
            if (effect.lfo && effect.lfoOn !== false) {
                // LFO-driven: the cutoff sweeps between min and max, `rate` times per
                // second. The LFO owns the cutoff, so "frequency" can't also be ramped.
                const { rate = 0.2, min = 200, max = 2000 } = effect.lfo;
                const lfo = new Tone.LFO(rate, min, max).connect(node.frequency).start();
                params.rate = { param: lfo.frequency, initial: rate };
                // `extras` are nodes outside the chain, disposed along with it.
                return { node, params, extras: [lfo] };
            }
            params.frequency = { param: node.frequency, initial: frequency };
            return { node, params };
        }

        case "pan": {
            const pan = effect.pan ?? 0; // -1 = left, 0 = centre, 1 = right
            const node = new Tone.Panner(pan);
            return { node, params: { pan: { param: node.pan, initial: pan } } };
        }

        case "reverb": {
            const mix = effect.mix ?? 0.3; // 0 = dry, 1 = fully wet
            const node = new Tone.Reverb({
                decay: effect.decay ?? 4,          // seconds for the tail to die away
                preDelay: effect.preDelay ?? 0.01, // seconds before the reverb starts
                wet: mix,
            });
            // The reverb tail is generated asynchronously; `ready` resolves when done.
            return { node, params: { mix: { param: node.wet, initial: mix } }, ready: node.ready };
        }

        case "delay": {
            const time = effect.time ?? 0.25;        // seconds between echoes
            const feedback = effect.feedback ?? 0.4; // 0–0.95, how many echoes repeat
            const mix = effect.mix ?? 0.3;
            const node = new Tone.FeedbackDelay({ delayTime: time, feedback, wet: mix, maxDelay: 5 });
            return {
                node,
                params: {
                    time: { param: node.delayTime, initial: time },
                    feedback: { param: node.feedback, initial: feedback },
                    mix: { param: node.wet, initial: mix },
                },
            };
        }

        case "pitch": {
            const semitones = effect.semitones ?? 0; // +12 = octave up, -12 = octave down
            const mix = effect.mix ?? 1;
            const node = new Tone.PitchShift({ pitch: semitones, wet: mix });
            return {
                node,
                params: {
                    semitones: { apply: (value) => (node.pitch = value), initial: semitones },
                    mix: { param: node.wet, initial: mix },
                },
            };
        }

        case "drift": {
            // Not a node in the chain: it sets the playback speed of every sound in
            // the group (like tape, faster is also slightly higher). Two groups
            // looping the same sound at slightly different rates slowly phase apart.
            const rate = effect.rate ?? 1; // 1 = normal, 1.02 = 2% faster
            const apply = (value) => {
                for (const player of Object.values(players)) player.playbackRate = value;
            };
            return { node: null, params: { rate: { apply, initial: rate, isRate: true } } };
        }

        default:
            console.warn("Unknown effect type, skipping:", effect.type);
            return null;
    }
}

// Sets a setting immediately at audio-clock `time`, whichever kind it is.
function setValue(target, value, time) {
    if (target.param) target.param.setValueAtTime(value, time);
    else target.apply(value);
}

// Builds one group of the score: its effect chain, a player per sound it uses,
// and its events. Problems that make the player skip something are passed to
// `warn` (they'd otherwise go unnoticed). `soundFor(path)` gives what a
// Tone.Player loads for a sound: a URL, or an already-decoded AudioBuffer.
function buildGroup(score, key, soundFor, warn) {
    const groupPart = score.groups[key];
    const volume = new Tone.Gain(1).toDestination();

    // Anything an event can "set" or "ramp", by name: "volume" or "<effectId>.<setting>".
    // An effect's id defaults to its type, so one reverb is just "reverb.mix".
    // `initial` is the value it returns to whenever the timeline restarts.
    const params = { volume: { param: volume.gain, initial: 1 } };
    const players = {}; // filled in below; created first so "drift" can reach them
    let rateTarget = null; // the "drift.rate" param, if this group drifts
    const effectNodes = [];
    const extras = [];  // nodes outside the chain (LFOs)
    const pending = []; // effects still getting ready (reverb)
    for (const effect of groupPart.effects ?? []) {
        const created = createEffect(effect, players);
        if (!created) {
            warn(`Unknown effect type "${effect.type}", so it was left out.`);
            continue;
        }
        if (created.node) effectNodes.push(created.node);
        if (created.extras) extras.push(...created.extras);
        if (created.ready) pending.push(created.ready);
        const id = effect.id ?? effect.type;
        if (params[`${id}.${Object.keys(created.params)[0]}`]) {
            warn(`Two effects are both called "${id}"; events can only control the last one. Give one an ID.`);
        }
        for (const [name, target] of Object.entries(created.params)) {
            params[`${id}.${name}`] = target;
            if (target.isRate) rateTarget = `${id}.${name}`;
        }
    }
    Tone.connectSeries(...effectNodes, volume);
    const input = effectNodes[0] ?? volume;

    // One player per sound this group actually uses.
    const events = [];
    for (let event of groupPart.events ?? []) {
        // The form writes the volume target as "gain".
        if (event.set === "gain") event = { ...event, set: "volume" };
        if (event.ramp === "gain") event = { ...event, ramp: "volume" };

        const sound = event.play ?? event.stop;
        const target = event.set ?? event.ramp;
        if (sound !== undefined) {
            const soundPath = score.sounds?.[sound];
            if (!soundPath) {
                warn(`Event at ${event.at}s uses sound "${sound}", which isn't in the sounds list; skipped.`, event);
                continue;
            }
            if (!players[sound]) {
                const source = soundFor(soundPath, sound);
                if (!source) {
                    warn(`Sound "${sound}" has no audio file; its events were skipped.`, event);
                    continue;
                }
                players[sound] = new Tone.Player(source).connect(input);
            }
            if (rateTarget) players[sound].playbackRate = params[rateTarget].initial;
            // "loop": true loops the whole file; "loop": [start, end] loops that
            // section (seconds into the file). It applies every time the sound plays.
            if (event.loop) {
                const [loopStart, loopEnd] = Array.isArray(event.loop) ? event.loop : [0, 0]; // 0 end = file end
                Object.assign(players[sound], { loop: true, loopStart, loopEnd });
            }
        } else if (target !== undefined && !params[target]) {
            warn(`Event at ${event.at}s changes "${target}", which no effect in this group has; skipped.`, event);
            continue;
        } else if (event.ramp !== undefined && !params[target].param) {
            warn(`Event at ${event.at}s ramps "${target}", which can only be set, not ramped; skipped.`, event);
            continue;
        }
        events.push(event);
    }
    // Sort by time (stable, so same-time events keep the order the artist wrote).
    events.sort((a, b) => a.at - b.at);

    return {
        key, players, params, events, rateTarget, pending,
        nodes: [...Object.values(players), ...extras, ...effectNodes, volume],
    };
}

export class AudioPlayer {
    constructor() {
        this.clockOffset = 0; // serverTime - localTime, in ms
        this.startAt = null;
        this.part = null;     // { groups: [built group, ...], nodes: [every node] }
        this.warnings = [];   // [{ group, message, event? }] from the last initialize()
        this.loading = 0; // counts initialize() calls, so a stale one can tell it's been replaced
    }

    // Builds `group`'s part of `score`, replacing any part already built (the
    // conductor loaded a different piece, or this phone moved group). `group`
    // can also be a list of groups, which then play together on one timeline
    // (the form's preview does this). `sounds` says where sound files are:
    // usually the piece's folder (paths in the score are relative to it), or a
    // function (path, soundName) giving a URL or AudioBuffer for each sound.
    // `startAt` is non-null if the piece is already playing.
    async initialize(score, group, startAt = null, sounds = document.baseURI) {
        const keys = Array.isArray(group) ? group : [group];
        for (const key of keys) {
            if (!score?.groups?.[key]) throw new Error(`Score does not contain group "${key}".`);
        }
        const loading = ++this.loading;
        this.dispose();
        this.startAt = startAt ?? null;

        const soundFor = typeof sounds === "function" ? sounds : (path) => new URL(path, sounds).href;
        const warnings = [];
        const groups = keys.map((key) => buildGroup(score, key, soundFor, (message, event) => {
            console.warn(`Group "${key}": ${message}`, event ?? "");
            warnings.push({ group: key, message, event });
        }));
        this.warnings = warnings;
        const part = { groups, nodes: groups.flatMap((g) => g.nodes) };
        try {
            await Tone.loaded(); // wait for every audio file to finish loading
            await Promise.all(groups.flatMap((g) => g.pending));
        } catch (error) {
            for (const node of part.nodes) node.dispose();
            throw error;
        }
        if (loading !== this.loading) {
            // Another piece arrived while this one was loading; it wins.
            for (const node of part.nodes) node.dispose();
            return;
        }
        this.part = part;
        if (this.startAt !== null) {
            this.startTimeline();
        }
    }

    // Stops and frees the current part, if any.
    dispose() {
        if (!this.part) return;
        this.stopTimeline();
        for (const node of this.part.nodes) node.dispose();
        this.part = null;
    }

    reset() {
        this.loading++;
        this.startAt = null;
        this.dispose();
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

    // Performs one of `group`'s events at audio-clock `time`.
    applyEvent(group, event, time) {
        if (event.play !== undefined) {
            group.players[event.play].start(time);
        } else if (event.stop !== undefined) {
            group.players[event.stop].stop(time);
        } else if (event.set !== undefined) {
            setValue(group.params[event.set], event.value, time);
        } else if (event.ramp !== undefined) {
            group.params[event.ramp].param.rampTo(event.to, event.over, time);
        }
    }

    // Puts `group`'s sounds and params into the state they'd be in at `position`
    // seconds, as if every earlier event had already run. Matters for late
    // joiners, and for a preview that starts partway through.
    catchUp(group, position, startTime) {
        const { rateTarget } = group;
        const values = {};
        const ramps = {};   // ramps still in progress at `position`
        const playing = {}; // sound -> { offset: seconds into the file, since: timeline time }
        for (const [name, { initial }] of Object.entries(group.params)) {
            values[name] = initial;
        }
        // Under "drift" the file moves at `rate` seconds per second, so a playing
        // sound's file position is advanced whenever the rate changes.
        const rate = () => (rateTarget ? values[rateTarget] : 1);
        const advance = (time) => {
            for (const p of Object.values(playing)) {
                p.offset += (time - p.since) * rate();
                p.since = time;
            }
        };

        for (const event of group.events) {
            if (event.at >= position) break;
            if (event.play !== undefined) {
                playing[event.play] = { offset: 0, since: event.at };
            } else if (event.stop !== undefined) {
                delete playing[event.stop];
            } else if (rateTarget && event.set === rateTarget) {
                advance(event.at);
                values[event.set] = event.value;
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

        for (const [name, target] of Object.entries(group.params)) {
            target.param?.cancelScheduledValues(0);
            setValue(target, values[name], Tone.now());
            if (ramps[name]) {
                target.param.rampTo(ramps[name].to, ramps[name].over, startTime);
            }
        }
        advance(position);
        for (const [sound, { offset }] of Object.entries(playing)) {
            const player = group.players[sound];
            if (player.loop) {
                // Fold the position back into the loop once it has gone around.
                const loopEnd = player.loopEnd || player.buffer.duration;
                const length = loopEnd - player.loopStart;
                const into = offset < loopEnd
                    ? offset
                    : player.loopStart + ((offset - player.loopStart) % length);
                player.start(startTime, into);
            } else if (offset < player.buffer.duration) {
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

        for (const group of this.part.groups) {
            this.catchUp(group, position, startTime);
            for (const event of group.events) {
                if (event.at >= position) {
                    transport.schedule((time) => this.applyEvent(group, event, time), event.at);
                }
            }
        }
        transport.start(startTime, position);
        console.log(`Timeline starting at position ${position.toFixed(2)}s`);
    }

    stopTimeline() {
        const transport = Tone.getTransport();
        transport.stop();
        transport.cancel();
        for (const group of this.part.groups) {
            for (const player of Object.values(group.players)) {
                player.stop();
            }
        }
    }

    stop() {
        this.startAt = null;
        if (this.part) {
            this.stopTimeline();
        }
    }
}