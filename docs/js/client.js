const WS_URL = location.hostname === "localhost"
  ? "ws://localhost:8080"
  : "wss://distributed-listening.onrender.com";
const socket = new WebSocket(WS_URL);

const startBtn = document.getElementById("start-btn");
const controls = document.getElementById("controls");
const playBtn = document.getElementById("play-btn");
const stopBtn = document.getElementById("stop-btn");

// --- Clock sync ------------------------------------------------------------
// The server's clock defines the shared timeline. We ping it a few times and
// keep the offset from the fastest round trip (least network noise).
let clockOffset = 0; // serverTime - localTime, in ms

function syncClock(samples = 5) {
  return new Promise((resolve) => {
    const results = [];
    const ping = () => socket.send(JSON.stringify({ type: "sync", clientTime: Date.now() }));

    const onMessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type !== "sync") return;
      const rtt = Date.now() - message.clientTime;
      results.push({ rtt, offset: message.serverTime - (message.clientTime + rtt / 2) });

      if (results.length < samples) return ping();
      socket.removeEventListener("message", onMessage);
      clockOffset = results.reduce((a, b) => (b.rtt < a.rtt ? b : a)).offset;
      console.log(`Clock offset ${clockOffset}ms`);
      resolve();
    };

    socket.addEventListener("message", onMessage);
    ping();
  });
}

// --- Building this phone's part from the score ----------------------------
// Signal chain: players -> effects... -> gain -> destination.
// Built once, when the server tells us our group and sends the score.
let part = null; // { players, params, events }

// Turns one effect entry from the score into a Tone.js node.
function createEffect(effect) {
  switch (effect.type) {
    case "lowpass":
    case "highpass":
    case "bandpass":
      return new Tone.Filter(effect.frequency, effect.type);
    default:
      console.warn("Unknown effect type, skipping:", effect.type);
      return null;
  }
}

async function buildPart(score, group) {
  const groupPart = score.groups[group];
  const gain = new Tone.Gain(1).toDestination();

  // Anything an event can "set" or "ramp", by name: "gain" or "<effectId>.frequency".
  // `initial` is the value it returns to whenever the timeline restarts.
  const params = { gain: { param: gain.gain, initial: 1 } };
  const effectNodes = [];
  for (const effect of groupPart.effects) {
    const node = createEffect(effect);
    if (!node) continue;
    effectNodes.push(node);
    if (effect.id && node.frequency) {
      params[`${effect.id}.frequency`] = { param: node.frequency, initial: effect.frequency };
    }
  }
  Tone.connectSeries(...effectNodes, gain);
  const input = effectNodes[0] ?? gain;

  // One player per sound this group actually uses; paths are relative to the page.
  const players = {};
  const events = [];
  for (const event of groupPart.events) {
    const sound = event.play ?? event.stop;
    const target = event.set ?? event.ramp;
    if (sound !== undefined) {
      if (!score.sounds[sound]) {
        console.warn("Unknown sound, skipping event:", event);
        continue;
      }
      players[sound] ??= new Tone.Player(new URL(score.sounds[sound], document.baseURI).href).connect(input);
    } else if (target !== undefined && !params[target]) {
      console.warn("Unknown target, skipping event:", event);
      continue;
    }
    events.push(event);
  }
  // Sort by time (stable, so same-time events keep the order the artist wrote).
  events.sort((a, b) => a.at - b.at);

  await Tone.loaded(); // wait for every audio file to finish loading
  return { players, params, events };
}

// --- The shared timeline ---------------------------------------------------
// startAt is the server-clock time (ms) at which the timeline is at 0. If that
// moment has already passed (we joined late), we start partway through.
let startAt = null;

// Performs one event at audio-clock `time`.
function applyEvent(event, time) {
  if (event.play !== undefined) part.players[event.play].start(time);
  else if (event.stop !== undefined) part.players[event.stop].stop(time);
  else if (event.set !== undefined) part.params[event.set].param.setValueAtTime(event.value, time);
  else if (event.ramp !== undefined) part.params[event.ramp].param.rampTo(event.to, event.over, time);
}

// Puts sounds and params into the state they'd be in at `position` seconds,
// as if every earlier event had already run. Only matters for late joiners.
function catchUp(position, startTime) {
  const values = {};
  const ramps = {};   // ramps still in progress at `position`
  const playing = {}; // sound -> timeline time it started
  for (const [name, { initial }] of Object.entries(part.params)) values[name] = initial;

  for (const event of part.events) {
    if (event.at >= position) break;
    if (event.play !== undefined) playing[event.play] = event.at;
    else if (event.stop !== undefined) delete playing[event.stop];
    else if (event.set !== undefined) {
      values[event.set] = event.value;
      delete ramps[event.set];
    } else if (event.ramp !== undefined) {
      const name = event.ramp;
      const done = (position - event.at) / event.over; // fraction of the ramp elapsed
      if (done >= 1) {
        values[name] = event.to;
        delete ramps[name];
      } else {
        values[name] += (event.to - values[name]) * done;
        ramps[name] = { to: event.to, over: event.over * (1 - done) };
      }
    }
  }

  for (const [name, { param }] of Object.entries(part.params)) {
    param.cancelScheduledValues(0);
    param.setValueAtTime(values[name], Tone.now());
    if (ramps[name]) param.rampTo(ramps[name].to, ramps[name].over, startTime);
  }
  for (const [sound, at] of Object.entries(playing)) {
    const player = part.players[sound];
    const offset = position - at; // how far into the file we should be
    if (offset < player.buffer.duration) player.start(startTime, offset);
  }
}

function startTimeline() {
  stopTimeline();
  const transport = Tone.getTransport();

  // Convert startAt from the server's clock to seconds from now on ours.
  const delay = (startAt - clockOffset - Date.now()) / 1000;
  const position = Math.max(0, -delay); // > 0 if we're joining late
  const startTime = Tone.now() + Math.max(0, delay);

  catchUp(position, startTime);
  for (const event of part.events) {
    if (event.at >= position) transport.schedule((time) => applyEvent(event, time), event.at);
  }
  transport.start(startTime, position);
  console.log(`Timeline starting at position ${position.toFixed(2)}s`);
}

function stopTimeline() {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  for (const player of Object.values(part.players)) player.stop();
}

// --- WebSocket / buttons -----------------------------------------------------
socket.addEventListener("open", () => {
  console.log("Connected to WebSocket server");

  startBtn.addEventListener("click", async () => {
    // Tone.start() must run inside a user gesture to unlock audio.
    await Tone.start();
    await syncClock();
    socket.send(JSON.stringify({ type: "ready" }));
  });

  playBtn.addEventListener("click", () => {
    socket.send(JSON.stringify({ type: "play" }));
  });

  stopBtn.addEventListener("click", () => {
    socket.send(JSON.stringify({ type: "stop" }));
  });

  socket.addEventListener("message", async (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "ready") {
      console.log("Assigned group:", message.group);
      startAt = message.startAt; // non-null if the piece is already running
      part = await buildPart(message.score, message.group);
      controls.style.display = "block";
      startBtn.style.display = "none";
      // startAt may also have been set by a "play" that arrived while loading.
      if (startAt !== null) startTimeline();
    }

    if (message.type === "play") {
      startAt = message.startAt;
      if (part) startTimeline();
    }

    else if (message.type === "stop") {
      startAt = null;
      if (part) stopTimeline();
    }
  });
});
