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
let xpOnOk = null, xpOnClose = null;

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

// opts = { title, html, icon: 'info'|'warn'|'msg' }
function openXP(opts, px, py, onOk, onClose) {
  xpTitle.textContent = opts.title || "Local Disk (C:)";
  xpIcon.innerHTML = XP_ICONS[opts.icon] || XP_ICONS.info;
  xpBody.innerHTML = opts.html || "";
  xpOnOk = onOk || null;
  xpOnClose = onClose || null;
  xpOverlay.hidden = false;
  // Open centered on the click, clamped so the whole box stays on-screen.
  const w = xpDialog.offsetWidth, h = xpDialog.offsetHeight, m = 8;
  const left = Math.max(m, Math.min(px - w / 2, window.innerWidth - w - m));
  const top = Math.max(m, Math.min(py - h / 2, window.innerHeight - h - m));
  xpDialog.style.left = left + "px";
  xpDialog.style.top = top + "px";
}
function fireXP(which) {
  const ok = xpOnOk, close = xpOnClose;
  xpOverlay.hidden = true;
  xpOnOk = xpOnClose = null;
  if (which === "ok" && ok) ok();
  else if (which === "close" && close) close();
}
const xpOpen = () => !xpOverlay.hidden;
document.getElementById("xp-ok").addEventListener("click", () => fireXP("ok"));
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
    { title: "Local Disk (C:)", icon: "warn", html: "Are you sure?" },
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
    { title: "Notice", icon: "warn", html: `<div class="name">${squawk}</div>` },
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

canvas.addEventListener("click", (e) => {
  if (xpOpen() || holding || gullActive) return;
  const p = pickAt(e.clientX, e.clientY);
  if (!p) return;
  const ent = p.entity;
  if (ent.kind === "item" && ent.shell) { onShellClicked(p, e.clientX, e.clientY); return; }
  if (/^(seagull|sea_bird)/.test(ent.key)) { onGullClicked(ent.ref, e.clientX, e.clientY); return; }
  if (ent.key === "dolphin1") { onDolphinClicked(); return; }
  const c = ent.ref && ent.ref.content; // fixed at spawn
  if (c) openXP({ title: c.title, icon: c.icon, html: c.html }, e.clientX, e.clientY, () => {}, () => {});
  else openXP({ title: "Local Disk (C:)", icon: "info", html: genericFallback(ent.name) }, e.clientX, e.clientY, () => {}, () => {});
});
canvas.addEventListener("mousemove", (e) => {
  if (xpOpen() || holding || gullActive) { canvas.style.cursor = "default"; return; }
  canvas.style.cursor = pickAt(e.clientX, e.clientY) ? "pointer" : "default";
});

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

  pixelatedFullscreen: true,
};

// Anchor palettes through the day.
const PALETTES = [
  {
    name: "sunrise",
    t: 0.00,
    sand: [242, 182, 109],
    shallow: [142, 214, 200],
    deep: [22, 127, 147],
    foam: [255, 234, 200],
    brightness: 1.02,
    saturation: 0.92,
    contrast: 0.90,
  },
  {
    name: "day",
    t: 0.25,
    sand: [246, 211, 117],
    shallow: [94, 216, 199],
    deep: [7, 135, 168],
    foam: [255, 248, 232],
    brightness: 1.10,
    saturation: 1.06,
    contrast: 1.00,
  },
  {
    name: "sunset",
    t: 0.50,
    sand: [233, 154, 78],
    shallow: [94, 184, 173],
    deep: [7, 95, 128],
    foam: [255, 217, 168],
    brightness: 0.92,
    saturation: 1.00,
    contrast: 1.04,
  },
  {
    name: "night",
    t: 0.75,
    sand: [78, 88, 112],
    shallow: [30, 103, 112],
    deep: [7, 56, 76],
    foam: [169, 217, 232],
    brightness: 0.42,
    saturation: 0.72,
    contrast: 0.86,
  },
  {
    name: "sunriseAgain",
    t: 1.00,
    sand: [242, 182, 109],
    shallow: [142, 214, 200],
    deep: [22, 127, 147],
    foam: [255, 234, 200],
    brightness: 1.02,
    saturation: 0.92,
    contrast: 0.90,
  },
];

// Detected x-position of the sand/water boundary for each row.
let shoreline = [];

// A cached copy of the untouched base image at internal resolution.
let basePixels = null;

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
  initLife({
    RENDER_W,
    RENDER_H,
    getShoreline: () => shoreline,
    assetBase: "./assets/",
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

  ctx.putImageData(basePixels, 0, 0);

  if (SETTINGS.drawWaterMotion) drawWaterMotion(t);
  drawWetSandWash(t);
  drawFoamEdge(t);
  if (SETTINGS.drawWaterSparkle) drawWaterSparkle(t);

  let palette = null;
  if (SETTINGS.enableDayNight) {
    const dayTime = currentDayTime(t);
    palette = getInterpolatedPalette(dayTime);
    applyTimeOfDayGrade(dayTime, palette);
    updateClockHud(dayTime);
  }

  const map = drawToScreen();
  updateAndDrawLife(screen, t, palette, map);
  requestAnimationFrame(loop);
}

// Map wall-clock or demo time onto the palette cycle.
// Palette anchors: 0 sunrise, 0.25 day, 0.5 sunset, 0.75 night.
// Real-clock mapping: 6am -> sunrise, noon -> day, 6pm -> sunset, midnight -> night.
function currentDayTime(t) {
  if (!SETTINGS.useRealClock) {
    return (SETTINGS.startDayTime + (t / SETTINGS.dayCycleSeconds)) % 1;
  }
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return ((hours - 6 + 24) % 24) / 24;
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
