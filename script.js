(() => {
  "use strict";

  /* ---------- Config ---------- */
  const COLORS = ["#ff4d8d", "#ff2e63", "#ffffff", "#c77dff", "#ff8fb8", "#e0245e", "#ffd1e3"];
  const GATHER = 4600;   // ms particles fly in
  const HOLD = 4800;     // ms the finished heart stays
  const SCATTER = 2400;  // ms particles burst outward
  const PAUSE = 700;     // ms of calm before restarting
  const MAX_DELAY = 1500;
  const CYCLE = GATHER + HOLD + SCATTER + PAUSE;

  const canvas = document.getElementById("heartCanvas");
  const ctx = canvas.getContext("2d");
  const message = document.getElementById("message");

  const COUNT = window.innerWidth < 600 ? 700 : 1000;
  let W = 0, H = 0, cx = 0, cy = 0, scale = 1, baseSize = 12;
  const sprites = {};
  let particles = [];

  /* ---------- Math helpers ---------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // Parametric heart curve (centered, y flipped for canvas)
  function heartPoint(t, s) {
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: x * s, y: -y * s - 2.5 };
  }

  /* ---------- Pre-rendered glowing heart sprites ---------- */
  function makeSprite(color) {
    const S = 64;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const k = S * 0.0195;
    g.translate(S / 2, S / 2 + 2);
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI * 2;
      const p = heartPoint(t, k);
      const x = p.x, y = p.y + 2.5 * k;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.fillStyle = color;
    g.fill();
    g.shadowBlur = 5;
    g.fill();
    return c;
  }
  COLORS.forEach((c) => (sprites[c] = makeSprite(c)));

  /* ---------- Particles ---------- */
  function createParticles() {
    particles = [];
    for (let i = 0; i < COUNT; i++) {
      const t = Math.random() * Math.PI * 2;
      // ~35% on the outline for a crisp edge, the rest fill the interior
      const s = i < COUNT * 0.35 ? 1 + rand(-0.02, 0.02) : Math.sqrt(Math.random()) * 0.97;
      const p = heartPoint(t, s);
      particles.push({
        tx: p.x, ty: p.y,
        sprite: sprites[COLORS[(Math.random() * COLORS.length) | 0]],
        size: rand(0.5, 1.15),
        delay: Math.random() * MAX_DELAY,
        curve: rand(-0.35, 0.35),
        phase: Math.random() * Math.PI * 2,
        sx: 0, sy: 0, ex: 0, ey: 0
      });
    }
    randomizeStarts();
  }

  function randomizeStarts() {
    const R = Math.max(W, H);
    for (const p of particles) {
      // random start on a wide ring/field around the screen
      const a = Math.random() * Math.PI * 2;
      const d = rand(0.55, 1.1) * R;
      p.sx = cx + Math.cos(a) * d;
      p.sy = cy + Math.sin(a) * d * 0.8;
      // scatter destination: outward from the heart
      const px = cx + p.tx * scale, py = cy + p.ty * scale;
      const ang = Math.atan2(py - cy, px - cx) + rand(-0.6, 0.6);
      const dist = rand(0.5, 1.3) * R;
      p.ex = px + Math.cos(ang) * dist;
      p.ey = py + Math.sin(ang) * dist;
      p.delay = Math.random() * MAX_DELAY;
      p.curve = rand(-0.35, 0.35);
    }
  }

  /* ---------- Sizing ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
    scale = Math.min(W / 37, H / 34);
    baseSize = clamp(scale * 1.15, 9, 20);
    if (particles.length) randomizeStarts();
  }

  /* ---------- Main loop ---------- */
  let clock = 0, last = performance.now(), cycleIndex = 0, textShown = false;

  function frame(now) {
    clock += Math.min(now - last, 50); // cap so tab switches don't jump
    last = now;

    const ci = Math.floor(clock / CYCLE);
    if (ci !== cycleIndex) { cycleIndex = ci; randomizeStarts(); }
    const t = clock % CYCLE;

    let phase, pt;
    if (t < GATHER) { phase = 0; pt = t; }
    else if (t < GATHER + HOLD) { phase = 1; pt = t - GATHER; }
    else if (t < GATHER + HOLD + SCATTER) { phase = 2; pt = t - GATHER - HOLD; }
    else { phase = 3; pt = 0; }

    // text fades in once the heart is formed, out as it scatters
    const wantText = phase === 1 && pt > 500;
    if (wantText !== textShown) {
      textShown = wantText;
      message.classList.toggle("visible", wantText);
    }

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    // heartbeat pulse (double-beat) during hold
    const beat = phase === 1
      ? 1 + 0.03 * Math.pow(Math.max(0, Math.sin(clock * 0.0045)), 3) + 0.015 * Math.sin(clock * 0.0022)
      : 1;

    // soft central glow
    let glow = 0;
    if (phase === 0) glow = clamp((pt - GATHER * 0.5) / (GATHER * 0.5)) * 0.7;
    else if (phase === 1) glow = 0.75 + 0.25 * Math.sin(clock * 0.0045);
    else if (phase === 2) glow = 0.7 * (1 - clamp(pt / (SCATTER * 0.6)));
    if (glow > 0.01) {
      const r = scale * 26 * beat;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(255, 60, 120, ${0.22 * glow})`);
      grad.addColorStop(0.6, `rgba(190, 40, 120, ${0.1 * glow})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    if (phase !== 3) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const hx = cx + p.tx * scale, hy = cy + p.ty * scale;
        let x, y, a = 1;

        if (phase === 0) {
          const lin = clamp((pt - p.delay) / (GATHER - MAX_DELAY));
          const e = easeInOut(lin);
          const dx = hx - p.sx, dy = hy - p.sy;
          const sw = Math.sin(Math.PI * e) * p.curve; // curved, swirling flight
          x = p.sx + dx * e - dy * sw;
          y = p.sy + dy * e + dx * sw;
          a = clamp((pt - p.delay) / 700);
        } else if (phase === 1) {
          const wob = Math.sin(clock * 0.002 + p.phase) * 1.4;
          x = cx + p.tx * scale * beat + wob;
          y = cy + p.ty * scale * beat + Math.cos(clock * 0.0017 + p.phase) * 1.4;
        } else {
          const u = clamp(pt / SCATTER);
          const e = u * u * (3 - 2 * u) * 0.6 + u * u * u * 0.4;
          x = hx + (p.ex - hx) * e;
          y = hy + (p.ey - hy) * e;
          a = 1 - clamp((u - 0.15) / 0.85);
        }

        if (a <= 0.01) continue;
        const tw = phase === 1 ? 0.8 + 0.2 * Math.sin(clock * 0.004 + p.phase * 3) : 1;
        const sz = baseSize * p.size * (phase === 1 ? beat : 1);
        ctx.globalAlpha = a * tw;
        ctx.drawImage(p.sprite, x - sz / 2, y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";

    requestAnimationFrame(frame);
  }

  /* ---------- Background floating hearts ---------- */
  function buildBackgroundHearts() {
    const wrap = document.getElementById("bgHearts");
    const palette = ["#ff4d8d", "#ff2e63", "#c77dff", "#ffb3d1"];
    const n = window.innerWidth < 600 ? 14 : 24;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.textContent = "♥";
      s.style.setProperty("--x", rand(0, 100).toFixed(1) + "%");
      s.style.setProperty("--s", rand(10, 30).toFixed(0) + "px");
      s.style.setProperty("--d", rand(12, 24).toFixed(1) + "s");
      s.style.setProperty("--delay", (-rand(0, 24)).toFixed(1) + "s");
      s.style.setProperty("--sway", rand(-40, 40).toFixed(0) + "px");
      s.style.setProperty("--c", palette[(Math.random() * palette.length) | 0]);
      wrap.appendChild(s);
    }
  }

  /* ---------- Init ---------- */
  buildBackgroundHearts();
  resize();
  createParticles();
  window.addEventListener("resize", resize);
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
})();