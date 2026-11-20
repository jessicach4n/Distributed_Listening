const THRESHOLD_DB = -50;   // below this = "silent"
const MAX_CIRCLES = 12;
const SPAWN_EVERY = 20;     // frames between spawns

let hueCursor = Math.random() * 360;
// Golden-angle step: successive circles land far apart on the color wheel,
// so you get the full range instead of clusters of similar colors.
const nextHue = () => (hueCursor = (hueCursor + 137.5) % 360);

function createVisuals(container) {
  const meter = new Tone.Meter({ smoothing: 0.85 });
  Tone.getDestination().connect(meter);

  const sketch = (p) => {
    let circles = [];

    const spawn = () => ({
      x: p.random(p.width),
      y: p.random(p.height),
      vx: p.random(-1.5, 1.5),
      vy: p.random(-1.5, 1.5),
      r: p.random(90, 200),     // a bit larger, since the soft edge fades out
      hue: nextHue(),
      alpha: 0,
    });

    p.setup = () => {
      p.createCanvas(p.windowWidth, p.windowHeight);
      p.colorMode(p.HSB, 360, 100, 100, 1);
      p.noStroke();
    };

    p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);

    p.draw = () => {
      p.clear();
      const db = meter.getValue();          // -Infinity when silent
      const active = db > THRESHOLD_DB;
      const level = p.constrain(p.map(db, -50, -6, 0, 1), 0, 1);


      if (active && circles.length < MAX_CIRCLES && p.frameCount % SPAWN_EVERY === 0) {
        circles.push(spawn());
      }

      const ctx = p.drawingContext;

      for (const c of circles) {
        c.alpha += ((active ? 0.8 : 0) - c.alpha) * 0.05;
        c.hue = (c.hue + 0.3) % 360;               // slow color drift

        c.x += c.vx; c.y += c.vy;
        if (c.x < 0 || c.x > p.width)  c.vx *= -1;
        if (c.y < 0 || c.y > p.height) c.vy *= -1;

        const radius = (c.r * (1 + level * 0.5)) / 2;
        const color = (a) => `hsla(${c.hue}, 85%, 60%, ${a})`;

        // Soft edge: solid-ish centre fading to fully transparent at the rim.
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
        g.addColorStop(0,   color(c.alpha));
        g.addColorStop(0.5, color(c.alpha * 0.6));
        g.addColorStop(1,   color(0));

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // remove faded circles once audio has stopped
      if (!active) circles = circles.filter((c) => c.alpha > 0.01);
    };
  };

  const instance = new p5(sketch, container);
  return {
    destroy() {
      instance.remove();
      meter.dispose();
    },
  };
}

// Start/stop automatically when the canvas screen is shown/hidden,
// so we don't need to modify player.js.
const screen = document.getElementById('canvas-screen');
const container = document.getElementById('canvas-container');
let visuals = null;

new MutationObserver(() => {
  if (!screen.hidden && !visuals) visuals = createVisuals(container);
  else if (screen.hidden && visuals) { visuals.destroy(); visuals = null; }
}).observe(screen, { attributes: true, attributeFilter: ['hidden'] });