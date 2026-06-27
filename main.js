import { initLife, updateAndDrawLife, pickAt } from "./life.js";
import { nextStation } from "./stations.js";

const canvas = document.getElementById("shore");
const screen = canvas.getContext("2d");

// ===========================================================================
// Windows XP dialog controller (per-call OK / X handlers)
// ===========================================================================
const xpOverlay = document.getElementById("xp-overlay");
const xpDialog = document.getElementById("xp-dialog");
const xpTitle = document.getElementById("xp-title");
const xpIcon = document.getElementById("xp-icon");
const xpBody = document.getElementById("xp-body");
const xpOk = document.getElementById("xp-ok");
const xpOk2 = document.getElementById("xp-ok2");
let xpOnOk = null, xpOnClose = null, xpOnSecond = null;

// Authentic-style Windows XP message-box icons, drawn as inline SVG.
const XP_ICONS = {
  info: `<svg viewBox="0 0 32 32"><defs><radialGradient id="xpi" cx="0.35" cy="0.30" r="0.95">
      <stop offset="0" stop-color="#cfe8ff"/><stop offset="0.45" stop-color="#3f9bf2"/><stop offset="1" stop-color="#0a5ec0"/></radialGradient></defs>
    <circle cx="16" cy="16" r="13" fill="url(#xpi)" stroke="#063f80" stroke-width="1"/>
    <ellipse cx="12.5" cy="10.5" rx="5.5" ry="3" fill="#fff" opacity="0.30"/>
    <text x="16" y="23" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="bold" font-size="18" fill="#fff">i</text></svg>`,
  warn: `<svg viewBox="0 0 32 32"><defs><linearGradient id="xpw" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe97a"/><stop offset="1" stop-color="#f1a900"/></linearGradient></defs>
    <path d="M16 3.5 L29.5 28 Q30.6 30.2 28 30.2 L4 30.2 Q1.4 30.2 2.5 28 Z" fill="url(#xpw)" stroke="#8a6a00" stroke-width="1.2" stroke-linejoin="round"/>
    <text x="16" y="27" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="bold" font-size="17" fill="#222">!</text></svg>`,
  msg: `<svg viewBox="0 0 32 32"><defs><radialGradient id="xpq" cx="0.35" cy="0.30" r="0.95">
      <stop offset="0" stop-color="#cfe8ff"/><stop offset="0.45" stop-color="#3f9bf2"/><stop offset="1" stop-color="#0a5ec0"/></radialGradient></defs>
    <circle cx="16" cy="16" r="13" fill="url(#xpq)" stroke="#063f80" stroke-width="1"/>
    <ellipse cx="12.5" cy="10.5" rx="5.5" ry="3" fill="#fff" opacity="0.30"/>
    <text x="16" y="23" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-weight="bold" font-size="17" fill="#fff">?</text></svg>`,
};

// opts = { title, html, icon: 'info'|'warn'|'msg', okLabel?, secondLabel? }
function openXP(opts, px, py, onOk, onClose, onSecond) {
  xpTitle.textContent = opts.title || "Local Disk (C:)";
  xpIcon.innerHTML = XP_ICONS[opts.icon] || XP_ICONS.info;
  xpBody.innerHTML = opts.html || "";
  xpOk.textContent = opts.okLabel || "OK";
  if (opts.secondLabel) { xpOk2.textContent = opts.secondLabel; xpOk2.hidden = false; }
  else { xpOk2.hidden = true; }
  xpOnOk = onOk || null;
  xpOnClose = onClose || null;
  xpOnSecond = onSecond || null;
  xpOverlay.hidden = false;
  // Open centered on the click, clamped so the whole box stays on-screen.
  const w = xpDialog.offsetWidth, h = xpDialog.offsetHeight, m = 8;
  const left = Math.max(m, Math.min(px - w / 2, window.innerWidth - w - m));
  const top = Math.max(m, Math.min(py - h / 2, window.innerHeight - h - m));
  xpDialog.style.left = left + "px";
  xpDialog.style.top = top + "px";
}
function fireXP(which) {
  const ok = xpOnOk, close = xpOnClose, second = xpOnSecond;
  xpOverlay.hidden = true;
  xpOnOk = xpOnClose = xpOnSecond = null;
  if (which === "ok" && ok) ok();
  else if (which === "close" && close) close();
  else if (which === "second" && second) second();
}
const xpOpen = () => !xpOverlay.hidden;
xpOk.addEventListener("click", () => fireXP("ok"));
xpOk2.addEventListener("click", () => fireXP("second"));
document.getElementById("xp-close").addEventListener("click", () => fireXP("close"));
xpOverlay.addEventListener("click", (e) => { if (e.target === xpOverlay) fireXP("close"); });
window.addEventListener("keydown", (e) => { if (e.key === "Escape" && xpOpen()) fireXP("close"); });

// ===========================================================================
// Shell radio: pick up a shell -> zoom to center -> live broadcast
// ===========================================================================
const shellStage = document.getElementById("shell-stage");
const shellHolder = document.getElementById("shell-holder");
const shellImg = document.getElementById("shell-img");
const shellAudio = document.getElementById("shell-audio");
const SHELL_VOLUME = 0.5;   // capped, never blaring
let holding = null;         // { ref, rect, station } once a shell is lifted
let pending = null;         // shell awaiting the OK to start listening
let volTimer = null;

function rampVolume(target, ms) {
  clearInterval(volTimer);
  const start = shellAudio.volume;
  const t0 = performance.now();
  volTimer = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    shellAudio.volume = start + (target - start) * k;
    if (k >= 1) { clearInterval(volTimer); volTimer = null; }
  }, 30);
}

function holderTransformAt(rect) {
  const bigW = shellImg.offsetWidth || (Math.min(window.innerWidth, window.innerHeight) * 0.46);
  const s0 = (rect.hw * 2) / bigW;
  const dx0 = rect.cx - window.innerWidth / 2;
  const dy0 = rect.cy - window.innerHeight / 2;
  return `translate(calc(-50% + ${dx0}px), calc(-50% + ${dy0}px)) scale(${s0})`;
}

function onShellClicked(p, px, py) {
  const ref = p.entity.ref;
  ref.locked = true; // protect from the tide while the popup is open
  const station = ref.station || nextStation(); // fixed per shell at spawn
  pending = { ref, rect: { cx: p.cx, cy: p.cy, hw: p.hw, hh: p.hh }, station };
  openXP(
    { title: "Radio", icon: "info", html: `Listen to <b>${station.name}</b>?` },
    px, py,
    () => startHold(),       // OK = listen
    () => { ref.locked = false; pending = null; } // X = never mind
  );
}

function startHold() {
  const { ref, rect, station } = pending;
  pending = null;
  ref.held = true;
  holding = { ref, rect, station };

  shellImg.src = "./assets/" + ref.def.key + ".png";
  shellStage.hidden = false;
  requestAnimationFrame(() => {
    shellHolder.style.transition = "none";
    shellHolder.style.opacity = "0";
    shellHolder.style.transform = holderTransformAt(rect);
    void shellHolder.offsetWidth; // reflow so the start state sticks
    shellHolder.style.transition = "transform 2100ms cubic-bezier(0.33, 0, 0.22, 1), opacity 1400ms ease";
    shellHolder.style.opacity = "1";
    shellHolder.style.transform = "translate(-50%, -50%) scale(1)";
  });

  shellAudio.src = station.url;
  shellAudio.volume = 0.03;
  shellAudio.play().catch(() => {});
  rampVolume(SHELL_VOLUME, 2200); // swells in slowly and continuously as it comes close
}

shellStage.addEventListener("click", (e) => {
  if (!holding || xpOpen()) return;
  if (e.target === shellImg) return; // clicking the shell keeps it
  openXP(
    { title: "Stochastic Shore", icon: "warn", html: "Put down the shell?" },
    e.clientX, e.clientY,
    () => putDownShell(),  // OK = put it down
    () => {}               // X = keep listening
  );
});

function putDownShell() {
  if (!holding) return;
  const { ref, rect } = holding;
  shellHolder.style.transition = "transform 760ms cubic-bezier(0.5,0,0.7,0.3), opacity 760ms ease";
  shellHolder.style.transform = holderTransformAt(rect);
  shellHolder.style.opacity = "0";
  rampVolume(0, 720);
  const finish = () => {
    if (!holding || holding.ref !== ref) return;
    shellStage.hidden = true;
    shellAudio.pause();
    shellAudio.removeAttribute("src");
    shellAudio.load();
    ref.held = false;
    ref.locked = false;
    holding = null;
  };
  shellHolder.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 1000); // safety if transitionend misses
}

// ===========================================================================
// Seagull jump-scare + dolphin sparkle
// ===========================================================================
const gullStage = document.getElementById("gull-stage");
const gullImg = document.getElementById("gull-img");
const gullAudio = document.getElementById("gull-audio");
const fxStage = document.getElementById("fx-stage");
let gullActive = false;

// head image + which way it faces (so it peeks from the correct edge)
const GULL_HEADS = [
  { file: "seagull_response1.png", face: "right" },
  { file: "seagull_response3.png", face: "right" },
  { file: "seagull_response_2.png", face: "left" },
  { file: "seagull_response4.png", face: "left" },
];
const SQUAWKS = ["SQUAWK!", "SKRAAAW!", "AWK! AWK! AWK!", "SCREEEE!", "MINE! MINE! MINE!", "EEEARGH!", "SKREE-AWK!", "RAAAWK!"];
const pickArr = (a) => a[Math.floor(Math.random() * a.length)];

function onGullClicked(ref, px, py) {
  openXP(
    { title: "Seagull", icon: "warn", html: "Are you sure?" },
    px, py,
    () => showGull(ref),  // OK = let it in
    () => {}              // X = nope
  );
}

function showGull(ref) {
  if (!ref.gull) ref.gull = { head: pickArr(GULL_HEADS), squawk: pickArr(SQUAWKS) };
  const { head, squawk } = ref.gull;
  gullActive = true;

  gullImg.src = "./assets/" + head.file;
  // right-facing heads peek in from the LEFT edge; left-facing from the RIGHT
  const fromLeft = head.face === "right";
  gullStage.hidden = false;
  gullImg.classList.toggle("from-left", fromLeft);
  gullImg.classList.toggle("from-right", !fromLeft);
  requestAnimationFrame(() => {
    gullImg.style.transition = "none";
    gullImg.style.transform = fromLeft ? "translateX(-100%)" : "translateX(100%)";
    void gullImg.offsetWidth;
    gullImg.style.transition = "transform 360ms cubic-bezier(0.34,1.56,0.64,1)";
    gullImg.style.transform = fromLeft ? "translateX(-16%)" : "translateX(16%)";
  });

  gullAudio.currentTime = 0;
  gullAudio.volume = 0.6;
  gullAudio.play().catch(() => {});

  // squawk box on the side away from the gull
  const px = fromLeft ? window.innerWidth * 0.72 : window.innerWidth * 0.28;
  const py = window.innerHeight * 0.34;
  openXP(
    { title: "Seagull", icon: "warn", html: `<div class="name">${squawk}</div>` },
    px, py,
    () => dismissGull(),
    () => dismissGull()
  );
}

function dismissGull() {
  if (!gullActive) return;
  const fromLeft = gullImg.classList.contains("from-left");
  gullImg.style.transition = "transform 320ms ease-in";
  gullImg.style.transform = fromLeft ? "translateX(-100%)" : "translateX(100%)";
  setTimeout(() => { gullStage.hidden = true; gullActive = false; }, 330);
}

function onDolphinClicked() {
  // a rainbow arc + a burst of sparkles, no dialog
  fxStage.innerHTML =
    '<svg id="fx-rainbow" viewBox="0 0 100 50" preserveAspectRatio="xMidYMax meet">' +
    ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']
      .map((c, i) => `<path d="M ${8 + i * 2.2} 50 A ${42 - i * 2.2} ${42 - i * 2.2} 0 0 1 ${92 - i * 2.2} 50" fill="none" stroke="${c}" stroke-width="2.2"/>`)
      .join("") +
    "</svg>";
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("div");
    s.className = "fx-sparkle";
    s.textContent = "✨";
    s.style.left = (15 + Math.random() * 70) + "vw";
    s.style.top = (20 + Math.random() * 55) + "vh";
    s.style.animationDelay = (Math.random() * 0.5).toFixed(2) + "s";
    s.style.fontSize = (14 + Math.random() * 26) + "px";
    fxStage.appendChild(s);
  }
  fxStage.classList.remove("show");
  void fxStage.offsetWidth;
  fxStage.classList.add("show");
  clearTimeout(onDolphinClicked._t);
  onDolphinClicked._t = setTimeout(() => { fxStage.classList.remove("show"); fxStage.innerHTML = ""; }, 2800);
}

// ---- canvas picking: route by what was clicked -----------------------------
const genericFallback = (name) =>
  `<div class="name">${name}</div><div class="filler">…filler text — we'll write this together.</div>`;

// A press becomes a DRAG past this many px; otherwise it's a CLICK.
const DRAG_THRESH = 5;
const SAND_MARK_LIFE = 45;                                  // seconds a sand line lingers
const SKITTER = /^(crab|hermit|hemit|horseshoe|sandpiper|seagull|sea_bird)/; // critters you can move
const GULL = /^(seagull|sea_bird)/;     // grumpy: errors when grabbed, won't swim
const NO_WATER = /^(sandpiper|seagull|sea_bird)/; // birds hop back out of the sea
let sandStrokes = [];                                       // [{points, born}]
let ptr = null;                                             // active pointer interaction

// License-safe "dun-dun" error chime (no Microsoft assets).
let errAudioCtx = null;
function playErrorSound() {
  try {
    errAudioCtx = errAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ac = errAudioCtx, now = ac.currentTime;
    [196.0, 146.83].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "square"; o.frequency.value = f;
      const t0 = now + i * 0.15;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.14);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0 + 0.16);
    });
  } catch (e) {}
}

// Soft license-safe reward chime when a catch surfaces (C–E–G).
function playCatchSound() {
  try {
    errAudioCtx = errAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const ac = errAudioCtx, now = ac.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t0 = now + i * 0.08;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.22);
      o.connect(g).connect(ac.destination);
      o.start(t0); o.stop(t0 + 0.24);
    });
  } catch (e) {}
}

const clampInternal = (p) => ({
  x: Math.max(4, Math.min(RENDER_W - 4, p.x)),
  y: Math.max(4, Math.min(RENDER_H - 4, p.y)),
});

function classifyDown(e) {
  const pick = pickAt(e.clientX, e.clientY);
  if (pick) {
    const ent = pick.entity;
    if (ent.kind === "item") return { type: "item", pick, ref: ent.ref };
    if (SKITTER.test(ent.key)) return { type: "creatureDrag", pick, ref: ent.ref };
    return { type: "creatureNoDrag", pick, ref: ent.ref }; // gull / turtle / dolphin
  }
  const wp = waterPointInternal(e.clientX, e.clientY);
  if (wp && isWaterInternal(wp.x, wp.y)) return { type: "water" };
  if (wp) return { type: "sand" };
  return { type: "none" };
}

canvas.addEventListener("mousedown", (e) => {
  if (xpOpen() || holding || gullActive || fishHolding) return;
  e.preventDefault();
  ptr = { ...classifyDown(e), startX: e.clientX, startY: e.clientY, dragging: false };
});

canvas.addEventListener("mousemove", (e) => {
  if (!ptr) {
    if (xpOpen() || holding || gullActive || fishHolding) { canvas.style.cursor = "default"; return; }
    const over = pickAt(e.clientX, e.clientY) || fishingRingAt(e.clientX, e.clientY) >= 0;
    canvas.style.cursor = over ? "pointer" : "default";
    return;
  }
  if (!ptr.dragging && Math.hypot(e.clientX - ptr.startX, e.clientY - ptr.startY) > DRAG_THRESH) {
    ptr.dragging = true;
    beginDrag(ptr, e);
  }
  if (ptr.dragging) duringDrag(ptr, e);
});

window.addEventListener("mouseup", (e) => {
  if (!ptr) return;
  const p = ptr; ptr = null;
  if (p.dragging) endDrag(p, e);
  else plainClick(p, e);
});

function beginDrag(p, e) {
  if (p.type === "item") { p.ref.locked = true; canvas.style.cursor = "grabbing"; }
  else if (p.type === "creatureDrag") {
    p.ref.dragging = true; canvas.style.cursor = "grabbing";
    if (GULL.test(p.ref.def.key)) playErrorSound(); // gull protests being grabbed
  }
  else if (p.type === "creatureNoDrag") { playErrorSound(); } // turtle/dolphin can't be moved
  else if (p.type === "sand") {
    p.stroke = { points: [], grains: [], born: performance.now() / 1000 };
    sandStrokes.push(p.stroke);
    addSandPoint(p, e);
  }
}

function duringDrag(p, e) {
  const wp = waterPointInternal(e.clientX, e.clientY);
  if (!wp) return;
  if (p.type === "item" || p.type === "creatureDrag") {
    const c = clampInternal(wp);
    p.ref.x = c.x; p.ref.y = c.y;
    if (p.type === "creatureDrag") { p.ref.tx = c.x; p.ref.ty = c.y; }
  } else if (p.type === "sand") {
    addSandPoint(p, e);
  } else if (p.type === "water") {
    if (!p._rt || performance.now() - p._rt > 90) {
      p._rt = performance.now();
      if (isWaterInternal(wp.x, wp.y)) spawnClickRipple(wp.x, wp.y, performance.now() / 1000);
    }
  }
}

function sinkIntoSea(ref, wp) {
  ref.state = "leaving";
  ref.fastLeave = true;                 // quick fade
  const now = performance.now() / 1000;
  spawnClickRipple(wp.x, wp.y, now);     // a little water-circle left behind
  spawnClickRipple(wp.x, wp.y, now + 0.14);
}

function dartFrom(ref, x, y) {
  const ang = Math.random() * Math.PI * 2, d = 30 + Math.random() * 32;
  ref.tx = x + Math.cos(ang) * d;
  ref.ty = y + Math.sin(ang) * d;
  ref.pauseLeft = 0;
  ref.dartT = 0.55;
}

function endDrag(p, e) {
  const wp = waterPointInternal(e.clientX, e.clientY);
  const inWater = wp && isWaterInternal(wp.x, wp.y);
  if (p.type === "item") {
    p.ref.locked = false;
    if (inWater) sinkIntoSea(p.ref, wp); // tossed into the sea -> sinks & fades
  } else if (p.type === "creatureDrag") {
    p.ref.dragging = false;
    if (inWater && NO_WATER.test(p.ref.def.key)) {
      // birds hate the water — hop back onto the sand
      p.ref.x = Math.max(8, edgeAtInternal(wp.y) - (12 + Math.random() * 20));
      p.ref.y = Math.max(8, Math.min(RENDER_H - 8, wp.y));
      dartFrom(p.ref, p.ref.x, p.ref.y);
    } else if (inWater) {
      sinkIntoSea(p.ref, wp); // crabs etc. slip under
    } else {
      dartFrom(p.ref, p.ref.x, p.ref.y); // dropped on sand: startled dart
    }
  }
  canvas.style.cursor = "default";
}

function plainClick(p, e) {
  if (p.type === "item" || p.type === "creatureDrag" || p.type === "creatureNoDrag") {
    const ent = p.pick.entity;
    if (ent.kind === "item" && ent.shell) { onShellClicked(p.pick, e.clientX, e.clientY); return; }
    if (/^(seagull|sea_bird)/.test(ent.key)) { onGullClicked(ent.ref, e.clientX, e.clientY); return; }
    if (ent.key === "dolphin1") { onDolphinClicked(); return; }
    const c = ent.ref && ent.ref.content;
    if (c) openXP({ title: ent.name, icon: c.icon, html: c.html }, e.clientX, e.clientY, () => {}, () => {});
    else openXP({ title: ent.name, icon: "info", html: genericFallback(ent.name) }, e.clientX, e.clientY, () => {}, () => {});
    return;
  }
  if (p.type === "water") {
    const ri = fishingRingAt(e.clientX, e.clientY);
    if (ri >= 0) { reelIn(ri); return; }
    const wp = waterPointInternal(e.clientX, e.clientY);
    if (wp && isWaterInternal(wp.x, wp.y)) spawnClickRipple(wp.x, wp.y, performance.now() / 1000);
  }
}

function addSandPoint(p, e) {
  const wp = waterPointInternal(e.clientX, e.clientY);
  if (!wp) return;
  if (!(wp.x < edgeAtInternal(wp.y) - 2 && wp.x > 2 && wp.y > 2 && wp.y < RENDER_H - 2)) return;
  const pts = p.stroke.points;
  const last = pts[pts.length - 1];
  let w = 2.6;
  if (last) {
    const d = Math.hypot(wp.x - last.x, wp.y - last.y);
    if (d < 0.7) return;                          // skip micro-moves so it doesn't clump
    w = Math.max(1.0, Math.min(3.0, 3.2 - d * 0.16)); // faster drag -> thinner groove
  }
  pts.push({ x: wp.x, y: wp.y, w });
  // crumbled sand pushed aside along the trench
  if (Math.random() < 0.55) {
    const ang = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 2.4;
    p.stroke.grains.push({ x: wp.x + Math.cos(ang) * r, y: wp.y + Math.sin(ang) * r });
  }
}

// Stroke a polyline segment-by-segment so each bit uses its own width.
function strokeSandPath(points, ox, oy, addW, style) {
  ctx.strokeStyle = style;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    ctx.lineWidth = Math.max(0.6, (a.w + b.w) / 2 + addW);
    ctx.beginPath();
    ctx.moveTo(a.x + ox, a.y + oy);
    ctx.lineTo(b.x + ox, b.y + oy);
    ctx.stroke();
  }
}

const FOOTPRINT_LIFE = 22;  // seconds tracks linger
let footprints = [];
function spawnFootprint(x, y, t) {
  footprints.push({ x, y, born: t });
  if (footprints.length > 600) footprints.shift();
}
function drawFootprints(t) {
  if (!footprints.length) return;
  ctx.save();
  for (const f of footprints) {
    const alpha = (1 - (t - f.born) / FOOTPRINT_LIFE) * 0.32;
    if (alpha <= 0.02) continue;
    ctx.fillStyle = `rgba(60, 44, 27, ${alpha})`;
    ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 1);
  }
  footprints = footprints.filter((f) => (t - f.born) < FOOTPRINT_LIFE);
  ctx.restore();
}

function drawSandMarks(t) {
  if (!sandStrokes.length) return;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of sandStrokes) {
    const life = 1 - (t - s.born) / SAND_MARK_LIFE;
    if (life <= 0.04 || s.points.length < 2) continue;
    // sunlit lip on the upper-left edge of the groove
    strokeSandPath(s.points, -1, -1, 0.4, `rgba(234, 214, 172, ${life * 0.5})`);
    // dark carved groove, offset slightly into shadow
    strokeSandPath(s.points, 0.4, 0.5, 0, `rgba(72, 53, 32, ${life * 0.6})`);
    // crumbled grains beside the trench
    ctx.fillStyle = `rgba(150, 128, 92, ${life * 0.5})`;
    for (const g of s.grains) ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 1);
  }
  sandStrokes = sandStrokes.filter((s) => (t - s.born) < SAND_MARK_LIFE);
  ctx.restore();
}

// Internal render size. It scales up to fullscreen.
// Lower = chunkier pixels. Higher = more detail.
const RENDER_W = 640;
const RENDER_H = 360;

const scene = document.createElement("canvas");
scene.width = RENDER_W;
scene.height = RENDER_H;
const ctx = scene.getContext("2d", { willReadFrequently: true });

const base = new Image();
base.src = "./shore/base_beach.png";

// -----------------------------
// TWEAKABLE SETTINGS
// -----------------------------

const SETTINGS = {
  // Shore lapping
  lapSpeed: 0.58,
  reach: 28,
  wetBand: 18,
  foamAlpha: 0.62,
  foamNoise: 0.55,

  // Water motion
  waterMotionAlpha: 0.18,
  waterMotionSpeed: 0.36,
  causticAlpha: 0.20,
  sparkleAlpha: 0.22,
  drawWaterMotion: true,
  drawWaterSparkle: true,

  // Open-ocean wave bands: faint swells drifting through the water.
  drawOceanWaveBands: true,
  oceanWaveAlpha: 0.18,
  oceanWaveSpeed: 0.22,
  oceanWaveSpacing: 42,
  oceanWaveWidth: 5,

  // Water rings: cosmetic ripples where you click + persistent fishing "bites".
  drawWaterRings: true,
  clickRippleLife: 1.9,        // seconds a click ripple lives
  clickRippleMaxR: 17,         // internal px it expands to
  clickRippleRings: 3,
  fishingRingCount: 2,         // how many catchable bites float at once
  fishingRingMaxR: 12,         // internal px the bite rings pulse to

  // Location-aware sand sparkle: tiny glints, strongest at sunrise/sunset.
  drawSandSparkle: true,
  sandSparkleAlpha: 0.18,
  sandSparkleDensity: 0.16,
  drySparkleBias: 0.72,
  wetEdgeSparkleBias: 1.00,

  // Day / night cycle
  enableDayNight: true,

  // When true, the scene tracks the real local clock:
  // ~6am sunrise, noon day, ~6pm sunset, midnight night.
  useRealClock: true,

  // Used only when useRealClock is false (demo mode).
  // Full loop duration, in seconds. 120 is good for testing.
  dayCycleSeconds: 120,

  // Where the demo cycle starts: 0 sunrise, 0.25 day, 0.5 sunset, 0.75 night
  startDayTime: 0.00,

  // Master strength of the color grade.
  // Lower if it feels too "filtered."
  lightingStrength: 1.0,

  // Cinematic night overlays
  drawMoonPath: true,
  drawNightTwinkles: true,
  drawFoamMoonGlow: true,

  pixelatedFullscreen: true,
};

// Cinematic keyframes: longer golden hour, slower sunset, richer dusk.
// The real-clock mapping in currentDayTime() places these at realistic hours.
const PALETTES = [
  { name: "sunrise",       t: 0.00, sand: [239, 182, 128], shallow: [145, 209, 200], deep: [37, 119, 140], foam: [255, 233, 206], brightness: 0.98, saturation: 0.90, contrast: 0.90 },
  { name: "goldenMorning", t: 0.14, sand: [245, 197, 121], shallow: [138, 220, 208], deep: [27, 132, 154], foam: [255, 243, 218], brightness: 1.05, saturation: 0.98, contrast: 0.95 },
  { name: "day",           t: 0.33, sand: [246, 211, 117], shallow: [96, 219, 203],  deep: [8, 140, 171],  foam: [255, 248, 234], brightness: 1.10, saturation: 1.06, contrast: 1.00 },
  { name: "lateDay",       t: 0.56, sand: [239, 195, 112], shallow: [101, 202, 191], deep: [18, 121, 149], foam: [255, 242, 220], brightness: 1.00, saturation: 1.00, contrast: 0.98 },
  { name: "sunset",        t: 0.72, sand: [232, 156, 92],  shallow: [98, 177, 170],  deep: [18, 92, 122],  foam: [255, 221, 175], brightness: 0.90, saturation: 1.00, contrast: 1.04 },
  { name: "dusk",          t: 0.82, sand: [130, 114, 129], shallow: [60, 124, 137],  deep: [15, 72, 98],   foam: [206, 218, 226], brightness: 0.64, saturation: 0.82, contrast: 0.96 },
  { name: "night",         t: 0.90, sand: [78, 88, 112],   shallow: [28, 96, 108],   deep: [7, 45, 65],    foam: [178, 221, 238], brightness: 0.44, saturation: 0.70, contrast: 0.88 },
  { name: "preDawn",       t: 0.97, sand: [112, 110, 125], shallow: [68, 127, 138],  deep: [16, 79, 98],   foam: [202, 218, 228], brightness: 0.60, saturation: 0.78, contrast: 0.90 },
  { name: "sunriseAgain",  t: 1.00, sand: [239, 182, 128], shallow: [145, 209, 200], deep: [37, 119, 140], foam: [255, 233, 206], brightness: 0.98, saturation: 0.90, contrast: 0.90 },
];

// Detected x-position of the sand/water boundary for each row.
let shoreline = [];

// A cached copy of the untouched base image at internal resolution.
let basePixels = null;
let nightTwinkles = [];
let clickRipples = [];   // cosmetic ripples where you click the water
let fishingRings = [];   // persistent catchable "bites" floating on the water
let nextFishingRingAt = 1;
let lastMap = null;      // {scale,dx,dy} from drawToScreen, for screen<->water hit tests

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  screen.setTransform(dpr, 0, 0, dpr, 0, 0);
  screen.imageSmoothingEnabled = !SETTINGS.pixelatedFullscreen;
}

window.addEventListener("resize", resize);
resize();

base.onload = () => {
  prepareBase();
  buildNightTwinkles();
  initLife({
    RENDER_W,
    RENDER_H,
    getShoreline: () => shoreline,
    assetBase: "./assets/",
    onWake: (ix, iy, t) => spawnClickRipple(ix, iy, t), // wake-trail behind swimmers
    onStep: (ix, iy, t) => spawnFootprint(ix, iy, t),   // tracks behind land critters
  });
  requestAnimationFrame(loop);
};

function prepareBase() {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, RENDER_W, RENDER_H);
  ctx.drawImage(base, 0, 0, RENDER_W, RENDER_H);

  basePixels = ctx.getImageData(0, 0, RENDER_W, RENDER_H);
  shoreline = detectShoreline(basePixels);
  shoreline = smoothLine(shoreline, 10);
}

function detectShoreline(imageData) {
  const data = imageData.data;
  const line = [];

  for (let y = 0; y < RENDER_H; y++) {
    let found = Math.floor(RENDER_W * 0.42);

    for (let x = Math.floor(RENDER_W * 0.18); x < Math.floor(RENDER_W * 0.78); x++) {
      const i = (y * RENDER_W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (isWaterPixel(r, g, b)) {
        found = x;
        break;
      }
    }

    line[y] = found;
  }

  return line;
}

function isWaterPixel(r, g, b) {
  const blueGreen = g > 105 && b > 95;
  const coolerThanSand = b > r * 0.78;
  const notTooYellow = g > r * 0.68;
  return blueGreen && coolerThanSand && notTooYellow;
}

function smoothLine(line, passes = 4) {
  let smoothed = line.slice();

  for (let pass = 0; pass < passes; pass++) {
    const prev = smoothed.slice();
    for (let y = 2; y < RENDER_H - 2; y++) {
      smoothed[y] =
        prev[y - 2] * 0.08 +
        prev[y - 1] * 0.22 +
        prev[y]     * 0.40 +
        prev[y + 1] * 0.22 +
        prev[y + 2] * 0.08;
    }
  }

  return smoothed;
}

function loop(ms) {
  const t = ms / 1000;
  const dayTime = currentDayTime(t);

  ctx.putImageData(basePixels, 0, 0);

  if (SETTINGS.drawWaterMotion) drawWaterMotion(t);
  if (SETTINGS.drawOceanWaveBands) drawOceanWaveBands(t, dayTime);
  drawWetSandWash(t);
  drawFoamEdge(t);
  if (SETTINGS.drawWaterSparkle) drawWaterSparkle(t);
  if (SETTINGS.drawWaterRings) drawWaterRings(t);
  drawFootprints(t);
  drawSandMarks(t);

  let palette = null;
  if (SETTINGS.enableDayNight) {
    palette = getInterpolatedPalette(dayTime);
    applyTimeOfDayGrade(dayTime, palette);
    updateClockHud(dayTime);
  }
  if (SETTINGS.drawSandSparkle) drawSandSparkle(t, dayTime);

  const atmosphere = getAtmosphere(dayTime);
  if (SETTINGS.drawMoonPath) drawMoonPath(t, atmosphere.nightFactor);
  if (SETTINGS.drawNightTwinkles) drawNightTwinklesOverlay(t, atmosphere.nightFactor);
  if (SETTINGS.drawFoamMoonGlow) drawFoamMoonGlow(atmosphere.nightFactor);

  const map = drawToScreen();
  lastMap = map;
  updateAndDrawLife(screen, t, palette, map);
  requestAnimationFrame(loop);
}

// Map wall-clock or demo time onto the palette cycle.
// Palette anchors: 0 sunrise, 0.25 day, 0.5 sunset, 0.75 night.
// Real-clock mapping: 6am -> sunrise, noon -> day, 6pm -> sunset, midnight -> night.
// Map the real local clock onto the cinematic palette so each phase lands at a
// realistic hour (sunrise ~6am, golden ~7:30, midday noon, sunset ~7pm,
// night ~10:30pm+). Piecewise-linear between (hour -> palette time) anchors.
const CLOCK_ANCHORS = [
  [6.0, 0.00],  [7.5, 0.14],  [12.0, 0.33], [16.5, 0.56],
  [19.0, 0.72], [20.5, 0.82], [22.5, 0.90], [28.5, 0.97], [30.0, 1.00],
];
function currentDayTime(t) {
  if (!SETTINGS.useRealClock) {
    return (SETTINGS.startDayTime + (t / SETTINGS.dayCycleSeconds)) % 1;
  }
  const now = new Date();
  let h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  if (h < 6) h += 24; // fold the small hours into the 6..30 cycle
  for (let i = 0; i < CLOCK_ANCHORS.length - 1; i++) {
    const [h0, p0] = CLOCK_ANCHORS[i];
    const [h1, p1] = CLOCK_ANCHORS[i + 1];
    if (h >= h0 && h <= h1) return p0 + (p1 - p0) * (h - h0) / (h1 - h0);
  }
  return 0;
}

const PHASE_LABELS = [
  [0.00, "sunrise"], [0.18, "morning"], [0.25, "midday"],
  [0.40, "afternoon"], [0.50, "sunset"], [0.62, "dusk"],
  [0.75, "night"], [0.92, "late night"],
];
function phaseLabel(dayTime) {
  let label = "sunrise";
  for (const [t, name] of PHASE_LABELS) { if (dayTime >= t) label = name; }
  return label;
}

let lastHudText = "";
function updateClockHud(dayTime) {
  const meta = document.getElementById("meta");
  if (!meta) return;
  const now = new Date();
  const clock = SETTINGS.useRealClock
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : `${String(Math.floor(dayTime * 24)).padStart(2, "0")}:${String(Math.floor((dayTime * 24 % 1) * 60)).padStart(2, "0")}`;
  if (clock !== lastHudText) { meta.textContent = clock; lastHudText = clock; }
}

function drawToScreen() {
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  screen.clearRect(0, 0, viewW, viewH);
  screen.imageSmoothingEnabled = !SETTINGS.pixelatedFullscreen;

  const scale = Math.max(viewW / RENDER_W, viewH / RENDER_H);
  const drawW = RENDER_W * scale;
  const drawH = RENDER_H * scale;
  const dx = (viewW - drawW) / 2;
  const dy = (viewH - drawH) / 2;

  screen.drawImage(scene, dx, dy, drawW, drawH);
  return { scale, dx, dy };
}

// -----------------------------
// WATER MOVEMENT / SPARKLE
// -----------------------------

function drawWaterMotion(t) {
  const imageData = ctx.getImageData(0, 0, RENDER_W, RENDER_H);
  const pixels = imageData.data;
  const speed = SETTINGS.waterMotionSpeed;

  for (let y = 0; y < RENDER_H; y++) {
    const edge = shoreline[y];
    const startX = Math.max(0, Math.floor(edge + 5));

    for (let x = startX; x < RENDER_W; x++) {
      const i = (y * RENDER_W + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (!isWaterPixel(r, g, b)) continue;

      const distFromShore = x - edge;
      const shallowFade = 1 - clamp01(distFromShore / 260);

      const band1 = Math.sin(x * 0.035 + y * 0.075 + t * speed * 2.8);
      const band2 = Math.sin(x * 0.082 - y * 0.026 - t * speed * 1.7);
      const band3 = Math.sin((x + y) * 0.025 + t * speed * 2.1);

      const combined = (band1 + band2 * 0.75 + band3 * 0.6) / 2.35;

      const lightAmount = Math.max(0, combined) * SETTINGS.waterMotionAlpha * (0.25 + shallowFade * 0.85);
      const shadowAmount = Math.max(0, -combined) * SETTINGS.waterMotionAlpha * 0.18;

      tintPixelRaw(pixels, i, [166, 255, 234], lightAmount);
      darkenPixelRaw(pixels, i, shadowAmount);

      const vein =
        Math.sin(x * 0.105 + y * 0.155 + t * speed * 4.6) +
        Math.sin(x * 0.062 - y * 0.132 - t * speed * 3.2);

      if (vein > 1.62) {
        const caustic = SETTINGS.causticAlpha * shallowFade * (vein - 1.62) * 0.95;
        tintPixelRaw(pixels, i, [232, 255, 238], caustic);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function drawWaterSparkle(t) {
  ctx.save();

  for (let y = 10; y < RENDER_H - 10; y += 3) {
    const edge = shoreline[y];
    const startX = Math.max(edge + 24, Math.floor(RENDER_W * 0.38));

    for (let x = startX; x < RENDER_W - 8; x += 7) {
      const distFromShore = x - edge;
      const shallowFade = 1 - clamp01(distFromShore / 310);

      const drift =
        Math.sin(x * 0.065 + y * 0.13 + t * 1.05) +
        Math.sin(x * 0.018 - y * 0.075 - t * 0.62);

      const glitter = noise01(x * 0.039 + t * 0.08, y * 0.067 - t * 0.03, 10.0);

      if (drift + glitter * 1.65 > 2.12) {
        const a = SETTINGS.sparkleAlpha * (0.20 + shallowFade * 0.95);

        ctx.fillStyle = `rgba(218, 255, 244, ${a})`;
        ctx.fillRect(x, y, 2, 1);

        if (glitter > 0.84) {
          ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.72})`;
          ctx.fillRect(x + 1, y - 1, 1, 1);
          ctx.fillRect(x + 2, y, 1, 1);
        }
      }
    }
  }

  for (let y = 8; y < RENDER_H - 8; y += 5) {
    const edge = shoreline[y];
    const rippleX = edge + 22 + Math.sin(y * 0.04 + t * 0.9) * 10;

    if (noise01(y * 0.12, t * 0.25, 22.0) > 0.62) {
      ctx.fillStyle = `rgba(205, 255, 237, ${SETTINGS.sparkleAlpha * 0.34})`;
      ctx.fillRect(Math.floor(rippleX), y, 8, 1);
    }
  }

  ctx.restore();
}

// -----------------------------
// SHORE WASH / FOAM
// -----------------------------

function drawWetSandWash(t) {
  const phase = softLap(t);
  const data = ctx.getImageData(0, 0, RENDER_W, RENDER_H);
  const pixels = data.data;

  for (let y = 0; y < RENDER_H; y++) {
    const edge = shoreline[y];

    const localWobble =
      Math.sin(y * 0.055 + t * 1.4) * 4.0 +
      Math.sin(y * 0.017 - t * 0.9) * 5.5;

    const reach = SETTINGS.wetBand + phase * SETTINGS.reach + localWobble;

    const startX = Math.max(0, Math.floor(edge - reach));
    const endX = Math.min(RENDER_W - 1, Math.floor(edge + 7));

    for (let x = startX; x <= endX; x++) {
      const distFromEdge = edge - x;
      const falloff = 1 - clamp01(distFromEdge / Math.max(1, reach));
      const waveSoftness = smoothstep(0.0, 1.0, falloff);
      const wet = waveSoftness * (0.18 + phase * 0.18);

      tintPixel(pixels, x, y, [68, 192, 184], wet * 0.45);
      darkenPixel(pixels, x, y, wet * 0.16);

      if (distFromEdge > 5 && distFromEdge < reach * 0.45) {
        const glimmer = 0.028 * phase * noise01(x * 0.05, y * 0.08, t * 0.7);
        tintPixel(pixels, x, y, [255, 236, 185], glimmer);
      }
    }
  }

  ctx.putImageData(data, 0, 0);
}

function drawFoamEdge(t) {
  const phase = softLap(t);
  const foamPulse = 0.35 + 0.65 * Math.sin(Math.PI * phase);
  const alpha = SETTINGS.foamAlpha * foamPulse;

  ctx.save();

  for (let y = 0; y < RENDER_H; y += 1) {
    const edge = shoreline[y];

    const largeWobble =
      Math.sin(y * 0.048 + t * 1.25) * 5.0 +
      Math.sin(y * 0.013 - t * 0.75) * 7.0;

    const tinyWobble =
      Math.sin(y * 0.37 + t * 3.2) * 1.8 +
      Math.sin(y * 0.81 - t * 2.7) * 0.9;

    const foamX = edge - 5 - phase * SETTINGS.reach * 0.78 + largeWobble + tinyWobble;

    const broken =
      noise01(y * 0.11, t * 0.65, 2.0) >
      0.20 + SETTINGS.foamNoise * 0.18;

    if (!broken) continue;

    const thickness = 1.2 + phase * 3.4 + noise01(y * 0.31, t, 0) * 2.0;

    ctx.fillStyle = `rgba(255, 248, 220, ${alpha})`;
    ctx.fillRect(Math.floor(foamX), y, Math.ceil(thickness), 1);

    if (noise01(y * 0.19, t * 1.2, 7.0) > 0.60) {
      ctx.fillStyle = `rgba(255, 255, 245, ${alpha * 0.54})`;
      ctx.fillRect(Math.floor(foamX - 4 - phase * 5), y, 1 + Math.floor(phase * 2), 1);
    }

    if (noise01(y * 0.23, -t * 1.4, 12.0) > 0.67) {
      ctx.fillStyle = `rgba(235, 255, 246, ${alpha * 0.42})`;
      ctx.fillRect(Math.floor(foamX + 5 + phase * 2), y, 2, 1);
    }
  }

  for (let y = 0; y < RENDER_H; y += 2) {
    const edge = shoreline[y];
    const wobble = Math.sin(y * 0.05 + t * 1.1) * 4.0;
    const ghostX = edge - 10 - phase * SETTINGS.reach * 0.42 + wobble;

    if (noise01(y * 0.08, t * 0.4, 4.0) > 0.56) {
      ctx.fillStyle = `rgba(255, 249, 225, ${alpha * 0.20})`;
      ctx.fillRect(Math.floor(ghostX), y, 3, 1);
    }
  }

  ctx.restore();
}

// -----------------------------
// DAY / NIGHT COLOR GRADING
// -----------------------------

function applyTimeOfDayGrade(dayTime, precomputed) {
  const palette = precomputed || getInterpolatedPalette(dayTime);
  const data = ctx.getImageData(0, 0, RENDER_W, RENDER_H);
  const pixels = data.data;
  const strength = SETTINGS.lightingStrength;

  for (let y = 0; y < RENDER_H; y++) {
    const edge = shoreline[y];

    for (let x = 0; x < RENDER_W; x++) {
      const i = (y * RENDER_W + x) * 4;
      let r = pixels[i];
      let g = pixels[i + 1];
      let b = pixels[i + 2];

      const cls = classifyPixel(r, g, b, x, edge);

      let targetColor = null;
      let tintAmount = 0;

      if (cls === "foam") {
        targetColor = palette.foam;
        tintAmount = 0.42 * strength;
      } else if (cls === "sand") {
        targetColor = palette.sand;
        tintAmount = 0.38 * strength;
      } else if (cls === "shallow") {
        targetColor = palette.shallow;
        tintAmount = 0.34 * strength;
      } else if (cls === "deep") {
        targetColor = palette.deep;
        tintAmount = 0.28 * strength;
      }

      if (targetColor) {
        r = lerp(r, targetColor[0], tintAmount);
        g = lerp(g, targetColor[1], tintAmount);
        b = lerp(b, targetColor[2], tintAmount);
      }

      [r, g, b] = adjustContrast(r, g, b, palette.contrast);
      [r, g, b] = adjustSaturation(r, g, b, palette.saturation);
      [r, g, b] = adjustBrightness(r, g, b, palette.brightness);

      pixels[i] = clamp255(r);
      pixels[i + 1] = clamp255(g);
      pixels[i + 2] = clamp255(b);
    }
  }

  ctx.putImageData(data, 0, 0);
}

function classifyPixel(r, g, b, x, edge) {
  const brightness = (r + g + b) / 3;

  if (brightness > 222 && Math.abs(r - g) < 22 && Math.abs(g - b) < 28) {
    return "foam";
  }

  if (!isWaterPixel(r, g, b) && x < edge + 8) {
    return "sand";
  }

  if (isWaterPixel(r, g, b)) {
    const dist = x - edge;
    if (dist < 95) return "shallow";
    return "deep";
  }

  return "sand";
}

function getInterpolatedPalette(t) {
  t = ((t % 1) + 1) % 1;

  let a = PALETTES[0];
  let b = PALETTES[1];

  for (let i = 0; i < PALETTES.length - 1; i++) {
    if (t >= PALETTES[i].t && t <= PALETTES[i + 1].t) {
      a = PALETTES[i];
      b = PALETTES[i + 1];
      break;
    }
  }

  const span = (b.t - a.t) || 1;
  const rawU = (t - a.t) / span;
  const u = smoothstep(0, 1, rawU);

  return {
    sand: lerpColor(a.sand, b.sand, u),
    shallow: lerpColor(a.shallow, b.shallow, u),
    deep: lerpColor(a.deep, b.deep, u),
    foam: lerpColor(a.foam, b.foam, u),
    brightness: lerp(a.brightness, b.brightness, u),
    saturation: lerp(a.saturation, b.saturation, u),
    contrast: lerp(a.contrast, b.contrast, u),
  };
}

// -----------------------------
// Helpers
// -----------------------------

function softLap(t) {
  const s = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * SETTINGS.lapSpeed);
  return smoothstep(0.0, 1.0, s);
}

function tintPixel(pixels, x, y, color, amount) {
  amount = clamp01(amount);
  const i = (y * RENDER_W + x) * 4;
  tintPixelRaw(pixels, i, color, amount);
}

function tintPixelRaw(pixels, i, color, amount) {
  amount = clamp01(amount);
  pixels[i]     = pixels[i]     + (color[0] - pixels[i])     * amount;
  pixels[i + 1] = pixels[i + 1] + (color[1] - pixels[i + 1]) * amount;
  pixels[i + 2] = pixels[i + 2] + (color[2] - pixels[i + 2]) * amount;
}

function darkenPixel(pixels, x, y, amount) {
  amount = clamp01(amount);
  const i = (y * RENDER_W + x) * 4;
  darkenPixelRaw(pixels, i, amount);
}

function darkenPixelRaw(pixels, i, amount) {
  amount = clamp01(amount);
  pixels[i]     *= 1 - amount;
  pixels[i + 1] *= 1 - amount;
  pixels[i + 2] *= 1 - amount;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
}

function adjustBrightness(r, g, b, brightness) {
  return [r * brightness, g * brightness, b * brightness];
}

function adjustContrast(r, g, b, contrast) {
  return [
    ((r - 128) * contrast) + 128,
    ((g - 128) * contrast) + 128,
    ((b - 128) * contrast) + 128,
  ];
}

function adjustSaturation(r, g, b, saturation) {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    gray + (r - gray) * saturation,
    gray + (g - gray) * saturation,
    gray + (b - gray) * saturation,
  ];
}

function clamp255(v) {
  return Math.max(0, Math.min(255, v));
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function noise01(x, y, z = 0) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

// ===========================================================================
// Cinematic shore layers (ported from the location-aware sparkle update)
// ===========================================================================

function buildNightTwinkles() {
  nightTwinkles = [];
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(lerp(RENDER_W * 0.48, RENDER_W - 8, noise01(i * 0.91, 3.3, 7.7)));
    const y = Math.floor(lerp(8, RENDER_H - 8, noise01(i * 0.37, 8.8, 1.9)));
    const size = noise01(i * 0.14, 9.1, 4.5) > 0.82 ? 2 : 1;
    const phase = noise01(i * 0.72, 4.4, 8.2) * Math.PI * 2;
    const speed = lerp(0.35, 1.2, noise01(i * 0.27, 6.6, 9.4));
    const strength = lerp(0.25, 1.0, noise01(i * 0.13, 2.2, 4.6));
    nightTwinkles.push({ x, y, size, phase, speed, strength });
  }
}

function drawOceanWaveBands(t, dayTime = 0.33) {
  // Subtle open-ocean swells: moving wave bands inside the water, separate
  // from the shoreline foam. They echo the curve of the beach but stay offshore.
  const atmosphere = typeof getAtmosphere === "function"
    ? getAtmosphere(dayTime)
    : { nightFactor: 0 };

  const nightFactor = atmosphere.nightFactor || 0;
  const imageData = ctx.getImageData(0, 0, RENDER_W, RENDER_H);
  const pixels = imageData.data;

  const speed = SETTINGS.oceanWaveSpeed;
  const spacing = SETTINGS.oceanWaveSpacing;
  const width = SETTINGS.oceanWaveWidth;

  for (let y = 0; y < RENDER_H; y++) {
    const edge = shoreline[y];

    // Keep this away from the lapping/foam edge. This is "actual ocean" motion.
    const startX = Math.max(Math.floor(edge + 38), Math.floor(RENDER_W * 0.42));

    for (let x = startX; x < RENDER_W; x++) {
      const i = (y * RENDER_W + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      if (!isWaterPixel(r, g, b)) continue;

      const distFromShore = x - edge;

      // Fade in after the shoreline, then fade out in the far/deep water.
      const nearShoreFade = smoothstep(28, 110, distFromShore);
      const farFade = 1 - smoothstep(RENDER_W * 0.58, RENDER_W * 0.86, distFromShore);
      const waterZone = clamp01(nearShoreFade * (0.35 + farFade * 0.65));

      // Curve the bands so they feel like soft swells rather than straight stripes.
      const curve =
        Math.sin(y * 0.034 + t * 0.18) * 15 +
        Math.sin(y * 0.011 - t * 0.11) * 26;

      // Subtracting time makes the swells drift toward shore.
      const waveCoord = (distFromShore + curve - t * speed * 42) / spacing;
      const wrapped = waveCoord - Math.floor(waveCoord);

      const crest = 1 - smoothstep(0.0, width / spacing, wrapped);
      const trailing = 1 - smoothstep(0.0, (width * 2.8) / spacing, wrapped);

      // Break up the bands so they look watery, not like contour-map lines.
      const breakup =
        0.68 +
        0.32 * Math.sin(y * 0.18 + x * 0.027 + t * 0.72) *
        Math.sin(y * 0.041 - t * 0.35);

      const crestAmount =
        crest *
        breakup *
        waterZone *
        SETTINGS.oceanWaveAlpha *
        (nightFactor > 0.4 ? 0.55 : 1.0);

      const troughAmount =
        Math.max(0, trailing - crest) *
        waterZone *
        SETTINGS.oceanWaveAlpha *
        0.10;

      const crestColor = nightFactor > 0.35 ? [190, 226, 242] : [210, 255, 238];

      tintPixelRaw(pixels, i, crestColor, crestAmount);
      darkenPixelRaw(pixels, i, troughAmount);

      // A few tiny bright pixels along crests, strongest in shallower water.
      const shallow = 1 - clamp01(distFromShore / 230);
      if (crestAmount > 0.055 && shallow > 0.18 && noise01(x * 0.09, y * 0.13, t * 0.16) > 0.82) {
        tintPixelRaw(pixels, i, [245, 255, 250], crestAmount * 0.55);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function drawSandSparkle(t, dayTime) {
  const atmosphere = getAtmosphere(dayTime);
  const goldenFactor = atmosphere.goldenFactor || 0;
  const nightFactor = atmosphere.nightFactor || 0;
  const dayFactor = gaussianCycle(dayTime, 0.33, 0.16);

  // Sunrise/sunset strongest, daytime moderate, night almost none.
  const baseStrength = 0.16;
  const goldenBoost = goldenFactor * 0.82;
  const dayLift = dayFactor * 0.16;
  const nightFade = 1 - Math.min(1, nightFactor * 1.35);

  const sparkleStrength =
    SETTINGS.sandSparkleAlpha *
    (baseStrength + goldenBoost + dayLift) *
    nightFade;

  if (sparkleStrength < 0.012) return;

  // We sample pixels once so we can cheaply test whether each position is sand.
  const sample = ctx.getImageData(0, 0, RENDER_W, RENDER_H).data;

  ctx.save();

  for (let y = 4; y < RENDER_H - 4; y += 2) {
    const edge = shoreline[y];

    // Keep sparkle on the sand side only.
    const minX = Math.max(2, Math.floor(edge - 175));
    const maxX = Math.max(minX + 1, Math.floor(edge - 9));

    for (let x = minX; x < maxX; x += 2) {
      const distToShore = edge - x;

      // Pixel test: skip water.
      const i = (y * RENDER_W + x) * 4;
      const r = sample[i], g = sample[i + 1], b = sample[i + 2];
      if (isWaterPixel(r, g, b)) continue;

      // Two location zones:
      // 1) wet-edge glints near the wet/dry transition, especially at low-angle light
      // 2) dry-sand glints farther inland, softer and more sparse
      const wetEdgeZone = 1 - smoothstep(8, 58, distToShore);
      const midSandZone = smoothstep(20, 72, distToShore) * (1 - smoothstep(72, 132, distToShore));
      const dryZone = smoothstep(70, 145, distToShore) * (1 - smoothstep(145, 188, distToShore));

      // Time-of-day weighting:
      // - golden hour: strong wet-edge sparkle
      // - daytime: mild dry sand sparkle
      // - night: almost none
      const wetEdgeWeight =
        SETTINGS.wetEdgeSparkleBias *
        wetEdgeZone *
        (0.10 + goldenFactor * 1.25);

      const midSandWeight =
        0.42 * midSandZone * (0.28 + goldenFactor * 0.42 + dayFactor * 0.28);

      const dryWeight =
        SETTINGS.drySparkleBias *
        dryZone *
        (0.10 + dayFactor * 0.50 + goldenFactor * 0.18);

      const bandStrength = clamp01(wetEdgeWeight + midSandWeight + dryWeight);
      if (bandStrength < 0.04) continue;

      // Color temperature shifts with the light.
      let sparkleColor = [255, 243, 215];  // default pale warm
      if (goldenFactor > 0.28) {
        sparkleColor = [255, 231, 176];    // warmer gold at sunrise/sunset
      } else if (dayFactor > 0.20) {
        sparkleColor = [250, 246, 230];    // pale white in full day
      } else if (nightFactor > 0.20) {
        sparkleColor = [210, 223, 234];    // very faint cool glint
      }

      // Placement: denser around wet-edge glints during golden hour,
      // sparser in dry sand so it stays tasteful.
      const drift = 0.5 + 0.5 * Math.sin(t * 1.05 + x * 0.045 + y * 0.07);
      const spatialNoise = noise01(x * 0.11, y * 0.17, 3.7);
      const chance =
        SETTINGS.sandSparkleDensity *
        bandStrength *
        (0.52 + drift * 0.55) *
        (wetEdgeZone > dryZone ? (0.95 + goldenFactor * 0.30) : 0.72);

      if (spatialNoise > 1 - chance) {
        const alpha = sparkleStrength * bandStrength * (0.36 + drift * 0.64);

        // Main glint: tiny horizontal sparkle
        ctx.fillStyle = `rgba(${sparkleColor[0]}, ${sparkleColor[1]}, ${sparkleColor[2]}, ${alpha})`;
        ctx.fillRect(x, y, 2, 1);

        // Wet-edge glints sometimes get a brighter "kiss" pixel.
        if (wetEdgeZone > 0.25 && noise01(x * 0.23, y * 0.19, 9.1) > 0.80) {
          ctx.fillStyle = `rgba(255, 255, 250, ${alpha * 0.90})`;
          ctx.fillRect(x + 1, y - 1, 1, 1);
        }

        // Rare little cross-glints on drier sand in strong daylight/golden light.
        if (dryZone > 0.24 && (goldenFactor > 0.16 || dayFactor > 0.40) && noise01(x * 0.09, y * 0.27, 5.4) > 0.91) {
          ctx.fillStyle = `rgba(255, 251, 240, ${alpha * 0.65})`;
          ctx.fillRect(x, y - 1, 1, 1);
          ctx.fillRect(x + 1, y + 1, 1, 1);
        }
      }
    }
  }

  ctx.restore();
}

function getAtmosphere(dayTime) {
  // Smooth factors that peak in different parts of the cycle.
  const nightFactor = gaussianCycle(dayTime, 0.91, 0.085);
  const sunsetFactor = gaussianCycle(dayTime, 0.73, 0.08);
  const sunriseFactor = gaussianCycle(dayTime, 0.09, 0.09);

  return {
    nightFactor,
    sunsetFactor,
    sunriseFactor,
    goldenFactor: Math.max(sunsetFactor, sunriseFactor),
  };
}

function drawMoonPath(t, nightFactor) {
  if (nightFactor < 0.02) return;

  ctx.save();

  const alphaBase = 0.11 * nightFactor;
  const xCenter = lerp(RENDER_W * 0.68, RENDER_W * 0.84, 0.5 + 0.5 * Math.sin(t * 0.08));
  const yStart = 20;
  const yEnd = RENDER_H - 14;

  for (let y = yStart; y < yEnd; y += 2) {
    const edge = shoreline[Math.floor(y)];
    const waterMinX = edge + 24;
    const verticalFade = 1 - Math.abs((y - RENDER_H * 0.52) / (RENDER_H * 0.52));
    const bandWidth = 10 + verticalFade * 28;

    for (let x = Math.max(waterMinX, Math.floor(xCenter - bandWidth)); x < Math.min(RENDER_W, Math.ceil(xCenter + bandWidth)); x += 2) {
      const dx = Math.abs(x - xCenter);
      const pathFalloff = 1 - clamp01(dx / bandWidth);
      const shimmer = 0.55 + 0.45 * Math.sin(y * 0.12 + x * 0.03 + t * 0.9);
      const a = alphaBase * pathFalloff * verticalFade * shimmer;

      if (a <= 0.008) continue;

      ctx.fillStyle = `rgba(205, 232, 255, ${a})`;
      ctx.fillRect(x, y, 2, 1);

      if (pathFalloff > 0.72 && noise01(x * 0.08, y * 0.1, t * 0.1) > 0.72) {
        ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.75})`;
        ctx.fillRect(x + 1, y, 1, 1);
      }
    }
  }

  ctx.restore();
}

function drawNightTwinklesOverlay(t, nightFactor) {
  if (nightFactor < 0.02) return;

  ctx.save();

  for (const s of nightTwinkles) {
    const edge = shoreline[Math.floor(clamp255(s.y))];
    if (s.x < edge + 16) continue;

    const pulse = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
    const a = nightFactor * s.strength * pulse * 0.18;

    if (a < 0.01) continue;

    ctx.fillStyle = `rgba(220, 240, 255, ${a})`;
    ctx.fillRect(s.x, s.y, s.size, 1);

    if (s.size > 1 && pulse > 0.78) {
      ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.8})`;
      ctx.fillRect(s.x + 1, s.y - 1, 1, 1);
    }
  }

  ctx.restore();
}

function drawFoamMoonGlow(nightFactor) {
  if (nightFactor < 0.03) return;

  ctx.save();
  const alpha = 0.15 * nightFactor;

  for (let y = 0; y < RENDER_H; y += 2) {
    const edge = shoreline[y];
    const wave = Math.sin(y * 0.05) * 4.0;
    const glowX = edge - 3 + wave;

    ctx.fillStyle = `rgba(196, 228, 245, ${alpha * 0.55})`;
    ctx.fillRect(Math.floor(glowX), y, 3, 1);

    if (noise01(y * 0.09, 5.7, 1.2) > 0.67) {
      ctx.fillStyle = `rgba(236, 247, 255, ${alpha * 0.36})`;
      ctx.fillRect(Math.floor(glowX - 2), y, 1, 1);
    }
  }

  ctx.restore();
}

function gaussianCycle(t, center, width) {
  const d = cycleDistance(t, center);
  return Math.exp(-(d * d) / (2 * width * width));
}

function cycleDistance(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

// ===========================================================================
// Water rings: cosmetic click ripples + clickable fishing "bites"
// ===========================================================================
const idxY = (iy) => Math.max(0, Math.min(RENDER_H - 1, Math.round(iy)));
const edgeAtInternal = (iy) => shoreline[idxY(iy)] || RENDER_W * 0.42;

function waterPointInternal(cssX, cssY) {
  if (!lastMap) return null;
  return { x: (cssX - lastMap.dx) / lastMap.scale, y: (cssY - lastMap.dy) / lastMap.scale };
}
function isWaterInternal(ix, iy) {
  return ix > edgeAtInternal(iy) + 6 && ix >= 0 && ix < RENDER_W && iy >= 0 && iy < RENDER_H;
}
function spawnClickRipple(ix, iy, t) {
  clickRipples.push({ x: ix, y: iy, born: t });
}
function spawnFishingRing(t) {
  const y = RENDER_H * (0.14 + Math.random() * 0.72);
  const x = edgeAtInternal(y) + 40 + Math.random() * 130;
  if (x > RENDER_W - 10) return;
  fishingRings.push({ x, y, bob: Math.random() * Math.PI * 2 });
}
function fishingRingAt(cssX, cssY) {
  const p = waterPointInternal(cssX, cssY);
  if (!p) return -1;
  for (let i = fishingRings.length - 1; i >= 0; i--) {
    const r = fishingRings[i];
    if (Math.hypot(p.x - r.x, p.y - r.y) <= SETTINGS.fishingRingMaxR + 7) return i;
  }
  return -1;
}

function drawWaterRings(t) {
  // keep a couple of bites floating (not while a catch is on screen)
  if (!fishHolding && fishingRings.length < SETTINGS.fishingRingCount && t >= nextFishingRingAt) {
    spawnFishingRing(t);
    nextFishingRingAt = t + 4 + Math.random() * 6;
  }

  ctx.save();
  ctx.lineWidth = 1;

  // fishing bites: darker, continuously pulsing concentric rings
  for (const fr of fishingRings) {
    const yb = fr.y + Math.sin(t * 0.8 + fr.bob) * 0.6;
    for (let k = 0; k < 2; k++) {
      const ph = ((t * 0.55 + fr.bob) + k * 0.5) % 1;
      const r = 2 + ph * SETTINGS.fishingRingMaxR;
      const alpha = 0.5 * (1 - ph);
      if (alpha <= 0.02) continue;
      ctx.strokeStyle = `rgba(12, 32, 42, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(fr.x, yb, r, r * 0.66, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(8, 24, 34, 0.30)";
    ctx.fillRect(Math.round(fr.x), Math.round(yb), 1, 1);
  }

  // cosmetic click ripples: light, expanding, fading
  for (const cr of clickRipples) {
    const a = (t - cr.born) / SETTINGS.clickRippleLife;
    if (a <= 0 || a >= 1) continue;
    const fade = 1 - a;
    for (let k = 0; k < SETTINGS.clickRippleRings; k++) {
      const ph = a - k * 0.2;
      if (ph <= 0) continue;
      const r = ph * SETTINGS.clickRippleMaxR;
      const alpha = 0.5 * fade * (1 - k * 0.3);
      if (alpha <= 0.02) continue;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.ellipse(cr.x, cr.y, r, r * 0.66, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  clickRipples = clickRipples.filter((cr) => (t - cr.born) < SETTINGS.clickRippleLife);
  ctx.restore();
}

// ===========================================================================
// The catch: reel a fish (rarely an octopus) up to fill the screen
// ===========================================================================
const fishStage = document.getElementById("fish-stage");
const fishHolder = document.getElementById("fish-holder");
const fishImg = document.getElementById("fish-img");
let fishHolding = null; // { key, rect } once a catch is on screen

const CATCH = [
  { key: "fish1", weight: 10, name: "Emperor Angelfish" },
  { key: "fish2", weight: 10, name: "Yellow Tang" },
  { key: "fish3", weight: 10, name: "Copperband Butterflyfish" },
  { key: "fish4", weight: 10, name: "Regal Angelfish" },
  { key: "fish5", weight: 10, name: "Clownfish" },
  { key: "fish6", weight: 10, name: "Flame Anthias" },
  { key: "fish7", weight: 10, name: "Blue Tang" },
  { key: "octopus1", weight: 2, name: "Octopus" }, // the rare catch
];
function pickCatch() {
  let tot = 0; for (const c of CATCH) tot += c.weight;
  let r = Math.random() * tot;
  for (const c of CATCH) { r -= c.weight; if (r <= 0) return c; }
  return CATCH[0];
}

function fishHolderTransformAt(rect) {
  const bigW = fishImg.offsetWidth || (Math.min(window.innerWidth, window.innerHeight) * 0.54);
  const s0 = Math.max(0.04, (rect.r * 2) / bigW);
  const dx0 = rect.cx - window.innerWidth / 2;
  const dy0 = rect.cy - window.innerHeight / 2;
  return `translate(calc(-50% + ${dx0}px), calc(-50% + ${dy0}px)) scale(${s0})`;
}

function reelIn(ringIndex) {
  if (!lastMap) return;
  const fr = fishingRings[ringIndex];
  if (!fr) return;
  fishingRings.splice(ringIndex, 1); // consume the bite
  const caught = pickCatch();
  const rect = {
    cx: lastMap.dx + fr.x * lastMap.scale,
    cy: lastMap.dy + fr.y * lastMap.scale,
    r: SETTINGS.fishingRingMaxR * lastMap.scale,
  };
  fishHolding = { key: caught.key, name: caught.name, rect };
  playCatchSound();
  fishImg.src = "./assets/" + caught.key + ".png";
  fishStage.hidden = false;
  requestAnimationFrame(() => {
    fishHolder.style.transition = "none";
    fishHolder.style.opacity = "0";
    fishHolder.style.transform = fishHolderTransformAt(rect);
    void fishHolder.offsetWidth;
    fishHolder.style.transition = "transform 1100ms cubic-bezier(0.22,0.61,0.36,1), opacity 800ms ease";
    fishHolder.style.opacity = "1";
    fishHolder.style.transform = "translate(-50%, -50%) scale(1)";
  });
}

fishStage.addEventListener("click", (e) => {
  if (!fishHolding || xpOpen()) return;
  openXP(
    { title: "Local Fish (Sea:)", icon: "info", html: `<div class="name">You caught a ${fishHolding.name}!</div>`, okLabel: "OK", secondLabel: "Release the fish" },
    e.clientX, e.clientY,
    () => {},            // OK = keep looking at it
    () => {},            // X = keep looking at it
    () => releaseFish()  // Release the fish
  );
});

function releaseFish() {
  if (!fishHolding) return;
  const { rect } = fishHolding;
  fishHolder.style.transition = "transform 750ms cubic-bezier(0.5,0,0.7,0.3), opacity 750ms ease";
  fishHolder.style.transform = fishHolderTransformAt(rect);
  fishHolder.style.opacity = "0";
  const done = () => {
    if (!fishHolding) return;
    fishStage.hidden = true;
    fishHolding = null;
    nextFishingRingAt = performance.now() / 1000 + 3; // a fresh bite a moment later
  };
  fishHolder.addEventListener("transitionend", done, { once: true });
  setTimeout(done, 950);
}
