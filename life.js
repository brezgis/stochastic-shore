// life.js — washed-up items + roaming creatures for the stochastic shore.
// Drawn crisp (photoreal) on top of the pixel beach for the intended contrast.
// Coordinates are in the beach's internal space (RENDER_W x RENDER_H); the
// caller passes the screen mapping {scale, dx, dy} each frame.

import { contentFor } from "./content.js";
import { nextStation } from "./stations.js";

const HALF_PI = Math.PI / 2;

// ----------------------------------------------------------------------------
// Tunables
// ----------------------------------------------------------------------------
const LIFE = {
  itemMin: 5, itemMax: 9,        // active wash-ups at a time
  minShells: 2,                  // always at least this many shells
  itemSpawnEvery: [5, 11],       // seconds between item arrivals (a few at a time)
  itemReclaimEvery: [70, 150],   // seconds between the tide taking something back

  creatureMin: 2, creatureMax: 4,
  creatureSpawnEvery: [6, 12],
  // target population skew: >1 leans toward the low end, so the max is rare.
  itemSkew: 1.9,
  creatureSkew: 1.8,

  fadeIn: 3.0,                   // seconds for a wash-up / creature to appear
  fadeOut: 3.5,                  // seconds to leave

  // Wrack line: tide deposits most debris in a band along the high-water mark.
  wrackFraction: 0.75,           // share of items that ride the line (rest scatter)
  wrackOffset: 44,               // internal px up the sand the line sits from the waterline
  wrackSpread: 46,               // how loosely items spread around the line (bigger = looser)
};

// ----------------------------------------------------------------------------
// Asset manifests
// ----------------------------------------------------------------------------
// Items: { key, file, w (internal px), weight, shell? }
const ITEMS = [
  // shells (common; pearl is rare)
  { key: 'shell1', file: 'shell1.png', w: 30, weight: 10, shell: true },
  { key: 'shell2', file: 'shell2.png', w: 22, weight: 10, shell: true },
  { key: 'shell4', file: 'shell4.png', w: 26, weight: 10, shell: true },
  { key: 'shell5', file: 'shell5.png', w: 24, weight: 10, shell: true },
  { key: 'shell8', file: 'shell8.png', w: 20, weight: 10, shell: true },
  { key: 'shell10', file: 'shell10.png', w: 26, weight: 9, shell: true },
  { key: 'shell12', file: 'shell12.png', w: 28, weight: 9, shell: true },
  { key: 'blue_shell7', file: 'blue_shell7.png', w: 24, weight: 8, shell: true },
  { key: 'pink_shell7', file: 'pink_shell7.png', w: 24, weight: 8, shell: true },
  { key: 'pink_shell11', file: 'pink_shell11.png', w: 20, weight: 8, shell: true },
  { key: 'shiny_shell6', file: 'shiny_shell6.png', w: 26, weight: 7, shell: true },
  { key: 'shell_pearl9', file: 'shell_pearl9.png', w: 22, weight: 2, shell: true },
  // other beachcombing finds
  { key: 'sea_glass', file: 'sea_glass.png', w: 16, weight: 7 },
  { key: 'seaweed_pile', file: 'seaweed_pile.png', w: 44, weight: 6 },
  { key: 'seaweed_pile2', file: 'seaweed_pile2.png', w: 42, weight: 6 },
  { key: 'sand_dollar', file: 'sand_dollar.png', w: 26, weight: 5 },
  { key: 'sea_star_1', file: 'sea_star_1.png', w: 28, weight: 4 },
  { key: 'sea_star_2', file: 'sea_star_2.png', w: 28, weight: 4 },
  { key: 'sea_star_3', file: 'sea_star_3.png', w: 30, weight: 4 },
  { key: 'coral1', file: 'coral1.png', w: 30, weight: 4 },
  { key: 'coral2', file: 'coral2.png', w: 34, weight: 4 },
  { key: 'coral3', file: 'coral3.png', w: 34, weight: 4 },
  { key: 'sea_cucumber', file: 'sea_cucumber.png', w: 30, weight: 4 },
  { key: 'sea_cucumber2', file: 'sea_cucumber2.png', w: 28, weight: 4 },
  { key: 'shark_tooth1', file: 'shark_tooth1.png', w: 16, weight: 2 },
  { key: 'shark_tooth2', file: 'shark_tooth2.png', w: 16, weight: 2 },
  { key: 'megalodon_tooth', file: 'megalodon_tooth.png', w: 24, weight: 1 },
  { key: 'message_in_bottle_1', file: 'message_in_bottle_1.png', w: 24, weight: 1.5 },
  { key: 'message_in_bottle_2', file: 'message_in_bottle_2.png', w: 26, weight: 1.5 },
];

// Behaviour profiles. band = [minOffset, maxOffset] from the shoreline edge
// (negative = up the sand / left, positive = into the shallows / right).
// speed in internal px/s. pause in seconds. step = target distance range.
const PROFILES = {
  sandpiper: { speed: 72, band: [-48, 14], pause: [0.12, 0.6], step: [18, 64], face: 'side', life: [110, 200], bob: 1.6 },
  gull:      { speed: 24, band: [-165, -22], pause: [1.4, 4.0], step: [40, 130], face: 'side', life: [180, 330], bob: 0.6 },
  crab:      { speed: 42, band: [-58, 26], pause: [0.4, 1.4], step: [30, 90], face: 'side', life: [140, 260], bob: 0.0, sideways: true },
  hermit:    { speed: 30, band: [-135, -12], pause: [0.6, 2.0], step: [16, 50], face: 'side', life: [150, 280], bob: 0.0 },
  horseshoe: { speed: 16, band: [-22, 56], pause: [1.4, 3.2], step: [30, 80], face: 'topdown', native: 0.7, life: [160, 300], bob: 0.0 },
  turtle:    { speed: 16, band: [-34, 250], pause: [2.0, 5.0], step: [40, 140], face: 'topdown', native: -HALF_PI, life: [140, 260], bob: 0.0 },
  dolphin:   { speed: 48, band: [80, 360], pause: [0.4, 1.4], step: [140, 300], face: 'side', life: [60, 130], bob: 7.0 }, // lives out in the water, porpoising
};

// Creatures: { key, file, w, weight, profile, nativeRight?, fromWater? }
const CREATURES = [
  { key: 'sandpiper_2', file: 'sandpiper_2.png', w: 40, weight: 10, profile: 'sandpiper', nativeRight: true },
  { key: 'crab2', file: 'crab2.png', w: 52, weight: 7, profile: 'crab', nativeRight: true },
  { key: 'hermit_crab1', file: 'hermit_crab1.png', w: 32, weight: 6, profile: 'hermit', nativeRight: true },
  { key: 'hemit_crab2', file: 'hemit_crab2.png', w: 28, weight: 6, profile: 'hermit', nativeRight: true },
  { key: 'hermit_crab3', file: 'hermit_crab3.png', w: 28, weight: 6, profile: 'hermit', nativeRight: true },
  { key: 'seagull1', file: 'seagull1.png', w: 56, weight: 4, profile: 'gull', nativeRight: true },
  { key: 'seagull_2', file: 'seagull_2.png', w: 74, weight: 4, profile: 'gull', nativeRight: true },
  { key: 'sea_bird1', file: 'sea_bird1.png', w: 60, weight: 4, profile: 'gull', nativeRight: false },
  { key: 'horseshoe_crab1', file: 'horseshoe_crab1.png', w: 48, weight: 2.5, profile: 'horseshoe', fromWater: true, solo: true },
  { key: 'horseshoe_crab2', file: 'horseshoe_crab2.png', w: 44, weight: 2.5, profile: 'horseshoe', fromWater: true, solo: true },
  { key: 'sea_turtle', file: 'sea_turtle.png', w: 82, weight: 0.4, profile: 'turtle', fromWater: true, solo: true },
  { key: 'dolphin1', file: 'dolphin1.png', w: 78, weight: 0.5, profile: 'dolphin', nativeRight: true, fromWater: true, solo: true },
];

// ----------------------------------------------------------------------------
// Module state
// ----------------------------------------------------------------------------
let W = 640, H = 360;
let getShoreline = () => [];
const images = {};         // key -> HTMLImageElement (loaded)
let items = [];
let creatures = [];
let itemTarget = 7;
let tItemSpawn = 0, tItemReclaim = 0, tCreatureSpawn = 0, tCreatureRetarget = 0;
let creatureTarget = 3;
let lastT = null;
let ready = false;
let nextId = 1;            // stable id per item (for hold/release from outside)
let pickables = [];        // [{cx,cy,hw,hh,entity}] in CSS px, rebuilt each frame

// Prettify an asset key into a display name: 'sea_turtle' -> 'Sea Turtle'.
function prettyName(key) {
  return key
    .replace(/_?\d+$/, '')
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Topmost sprite under a CSS-pixel point: returns {cx,cy,hw,hh,entity} or null.
export function pickAt(px, py) {
  for (let i = pickables.length - 1; i >= 0; i--) {
    const p = pickables[i];
    if (Math.abs(px - p.cx) <= p.hw && Math.abs(py - p.cy) <= p.hh) return p;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Skewed integer in [min,max]; exp>1 biases toward min (so max is rare).
const biasedTarget = (min, max, exp) => Math.round(min + (max - min) * Math.pow(Math.random(), exp));
// Triangular noise in [-spread, spread], dense in the middle (a cheap bell shape).
const triOffset = (spread) => (Math.random() + Math.random() - 1) * spread;

function pickWeighted(list, exclude) {
  const pool = exclude ? list.filter(exclude) : list;
  if (!pool.length) return null;
  let total = 0;
  for (const e of pool) total += e.weight;
  let r = Math.random() * total;
  for (const e of pool) { r -= e.weight; if (r <= 0) return e; }
  return pool[pool.length - 1];
}

function edgeAt(y) {
  const line = getShoreline();
  if (!line || !line.length) return W * 0.42;
  return line[clamp(Math.round(y), 0, line.length - 1)] || W * 0.42;
}

// Pick a valid wander point inside a profile's band, anywhere down the beach.
function pointInBand(band, y) {
  const yy = y == null ? rand(H * 0.1, H * 0.9) : y;
  const e = edgeAt(yy);
  const x = clamp(e + rand(band[0], band[1]), 8, W - 8);
  return { x, y: yy };
}

// ----------------------------------------------------------------------------
// Items (static wash-ups)
// ----------------------------------------------------------------------------
function activeShellCount() {
  return items.filter((it) => it.def.shell && it.state !== 'leaving').length;
}

// At most one of each kind on the beach at a time -> a varied mix, never four
// of the same shell. Ensures the minimum number of (distinct) shells first.
function chooseItemDef() {
  const activeKeys = new Set(items.filter((it) => it.state !== 'leaving').map((it) => it.def.key));
  const needShell = activeShellCount() < LIFE.minShells;
  return needShell
    ? pickWeighted(ITEMS, (e) => e.shell && !activeKeys.has(e.key))
    : pickWeighted(ITEMS, (e) => !activeKeys.has(e.key));
}

// The scene is cover-scaled (cropped) to fill the window, so the internal
// image edges sit off-screen. Compute the mapping and the visible internal box
// so we never place items in the cropped-away regions.
function viewMap() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const scale = Math.max(vw / W, vh / H);
  return { scale, dx: (vw - W * scale) / 2, dy: (vh - H * scale) / 2 };
}
function visibleInternalBox(marginPx) {
  const { scale, dx, dy } = viewMap();
  return {
    xLo: (-dx + marginPx) / scale,
    xHi: (window.innerWidth - dx - marginPx) / scale,
    yLo: (-dy + marginPx) / scale,
    yHi: (window.innerHeight - dy - marginPx) / scale,
  };
}

function sandPoint(def) {
  // Anywhere on the visible dry/wet sand, with the sprite's footprint kept
  // fully inside the screen.
  const img = images[def.key];
  const aspect = img ? img.height / img.width : 1;
  const halfW = def.w / 2;
  const halfH = (def.w * aspect) / 2;
  const b = visibleInternalBox(6);

  let yLo = Math.max(H * 0.01 + halfH, b.yLo + halfH);
  let yHi = Math.min(H * 0.99 - halfH, b.yHi - halfH);
  if (yHi < yLo) { const m = (yLo + yHi) / 2; yLo = yHi = m; }
  const yy = rand(yLo, yHi);

  const e = edgeAt(yy);
  // Valid x spans the dry sand down to the very shallow lapping water.
  const SHALLOW = 18; // internal px into the water
  let xLo = Math.max(W * 0.005 + halfW, b.xLo + halfW);
  let xHi = Math.min(e + SHALLOW - halfW, b.xHi - halfW);
  if (xHi < xLo) xHi = xLo;

  let x;
  if (Math.random() < LIFE.wrackFraction) {
    // ride the wrack line: a band a constant distance up from the wavy waterline
    x = clamp(e - LIFE.wrackOffset + triOffset(LIFE.wrackSpread), xLo, xHi);
  } else {
    x = rand(xLo, xHi); // stray scatter, anywhere on the sand
  }
  return { x, y: yy };
}

function spawnItem(def, instant) {
  // Items rest anywhere on the visible sand, spread across the beach.
  let pos;
  for (let tries = 0; tries < 10; tries++) {
    pos = sandPoint(def);
    const tooClose = items.some((it) => Math.hypot(it.x - pos.x, it.y - pos.y) < 24);
    if (!tooClose) break;
  }
  items.push({
    def, id: nextId++, x: pos.x, y: pos.y,
    rot: rand(-0.25, 0.25),
    alpha: instant ? 1 : 0,
    state: 'arriving',
    held: false, locked: false,  // held = lifted off beach; locked = protected from tide
    // chosen once at spawn, fixed for this instance's whole life on the beach:
    station: def.shell ? nextStation() : null,
    content: def.shell ? null : contentFor(def.key),
  });
}

function reclaimItem() {
  // The tide takes back something near the waterline, never dropping shells < min.
  const candidates = items
    .filter((it) => it.state !== 'leaving' && !it.held && !it.locked)
    .filter((it) => !(it.def.shell && activeShellCount() <= LIFE.minShells))
    .sort((a, b) => (b.x - edgeAt(b.y)) - (a.x - edgeAt(a.y))); // closest to water first
  if (candidates.length) candidates[0].state = 'leaving';
}

function updateItems(dt) {
  for (const it of items) {
    if (it.held) continue;  // a held shell is frozen until put down
    if (it.state === 'arriving') {
      it.alpha = Math.min(1, it.alpha + dt / LIFE.fadeIn);
      if (it.alpha >= 1) it.state = 'resting';
    } else if (it.state === 'leaving') {
      it.alpha -= dt / LIFE.fadeOut;
    }
  }
  items = items.filter((it) => it.held || it.alpha > 0.01);

  tItemSpawn -= dt;
  if (tItemSpawn <= 0) {
    tItemSpawn = rand(...LIFE.itemSpawnEvery);
    const active = items.filter((it) => it.state !== 'leaving').length;
    if (active < itemTarget) {
      const def = chooseItemDef();
      if (def) spawnItem(def, false);
    }
  }

  tItemReclaim -= dt;
  if (tItemReclaim <= 0) {
    tItemReclaim = rand(...LIFE.itemReclaimEvery);
    const active = items.filter((it) => it.state !== 'leaving').length;
    if (active > itemTarget || (active > LIFE.itemMin && Math.random() < 0.5)) reclaimItem();
    itemTarget = biasedTarget(LIFE.itemMin, LIFE.itemMax, LIFE.itemSkew);
  }
}

// ----------------------------------------------------------------------------
// Creatures (roaming)
// ----------------------------------------------------------------------------
function newTarget(c) {
  const p = pointInBand(c.prof.band, c.prof.sideways
    ? clamp(c.y + rand(-12, 12), H * 0.08, H * 0.92)  // crabs keep their row, scuttle sideways
    : null);
  // keep the step length within the profile's range
  const d = Math.hypot(p.x - c.x, p.y - c.y);
  const want = rand(...c.prof.step);
  if (d > 1) {
    const k = Math.min(1, want / d);
    c.tx = c.x + (p.x - c.x) * k;
    c.ty = c.y + (p.y - c.y) * k;
  } else { c.tx = p.x; c.ty = p.y; }
  c.tx = clamp(c.tx, 8, W - 8);
}

function spawnCreature() {
  const def = pickWeighted(CREATURES, (e) =>
    !(e.solo && creatures.some((c) => c.def.key === e.key && c.state !== 'leaving')));
  const prof = PROFILES[def.profile];
  const y = rand(H * 0.12, H * 0.88);
  const e = edgeAt(y);
  // creatures from the water emerge at the wet edge; others appear on the sand
  const x = def.fromWater
    ? clamp(e + rand(10, prof.band[1]), 8, W - 8)
    : clamp(e + rand(prof.band[0], prof.band[1] - 6), 8, W - 8);
  const c = {
    def, prof, x, y, tx: x, ty: y,
    lastVx: def.nativeRight ? 1 : -1, lastVy: 0,
    state: 'arriving', alpha: 0,
    pauseLeft: 0, age: 0, life: rand(...prof.life),
    phase: rand(0, Math.PI * 2),
    content: contentFor(def.key),  // fixed for this instance (null for gulls/dolphin)
    gull: null,                    // gull squawk/head, chosen lazily then frozen
  };
  newTarget(c);
  creatures.push(c);
}

function updateCreatures(dt, t) {
  for (const c of creatures) {
    c.age += dt;

    if (c.state === 'arriving') {
      c.alpha = Math.min(1, c.alpha + dt / LIFE.fadeIn);
      if (c.alpha >= 1) c.state = 'roaming';
    } else if (c.state === 'leaving') {
      c.alpha -= dt / LIFE.fadeOut;
    } else if (c.age > c.life) {
      c.state = 'leaving';
    }

    // movement
    if (c.state !== 'leaving') {
      if (c.pauseLeft > 0) {
        c.pauseLeft -= dt;
      } else {
        const dx = c.tx - c.x, dy = c.ty - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2.5) {
          c.pauseLeft = rand(...c.prof.pause);
          newTarget(c);
        } else {
          const v = c.prof.speed * dt;
          const ux = dx / dist, uy = dy / dist;
          c.x += ux * Math.min(v, dist);
          c.y += uy * Math.min(v, dist);
          c.lastVx = ux; c.lastVy = uy;
        }
      }
      // keep inside the band as the wavy shoreline shifts under them
      const e = edgeAt(c.y);
      c.x = clamp(c.x, e + c.prof.band[0], e + c.prof.band[1]);
      c.x = clamp(c.x, 8, W - 8);
      c.y = clamp(c.y, H * 0.06, H * 0.94);
    }
  }
  creatures = creatures.filter((c) => c.alpha > 0.01);

  // population management
  tCreatureSpawn -= dt;
  if (tCreatureSpawn <= 0) {
    tCreatureSpawn = rand(...LIFE.creatureSpawnEvery);
    const active = creatures.filter((c) => c.state !== 'leaving').length;
    if (active < creatureTarget) spawnCreature();
  }
  tCreatureRetarget -= dt;
  if (tCreatureRetarget <= 0) {
    tCreatureRetarget = rand(30, 60);
    creatureTarget = biasedTarget(LIFE.creatureMin, LIFE.creatureMax, LIFE.creatureSkew);
  }
}

// ----------------------------------------------------------------------------
// Drawing
// ----------------------------------------------------------------------------
function dayFilter(palette) {
  if (!palette) return 'none';
  const b = clamp(palette.brightness, 0.5, 1.12);
  const s = clamp(palette.saturation, 0.7, 1.1);
  return `brightness(${b.toFixed(3)}) saturate(${s.toFixed(3)})`;
}

function drawShadow(g, sx, sy, w, alpha, nightFactor) {
  g.save();
  g.filter = 'none';
  g.globalAlpha = alpha * (0.22 + 0.12 * nightFactor);
  g.fillStyle = '#0a1418';
  g.beginPath();
  g.ellipse(sx, sy, w * 0.42, w * 0.15, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function drawSprite(g, img, sx, sy, w, h, anchorBottom, flip, rot, alpha, filter) {
  g.save();
  g.globalAlpha = alpha;
  g.filter = filter;
  g.translate(sx, anchorBottom ? sy - h / 2 : sy);
  if (rot) g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.drawImage(img, -w / 2, -h / 2, w, h);
  g.restore();
}

export function updateAndDrawLife(g, t, palette, map) {
  if (!ready) return;
  const dt = lastT == null ? 0 : clamp(t - lastT, 0, 0.05);
  lastT = t;

  updateItems(dt);
  updateCreatures(dt, t);

  const { scale, dx, dy } = map;
  const filter = dayFilter(palette);
  const nightFactor = palette ? clamp((1.0 - palette.brightness) / 0.6, 0, 1) : 0;
  const prevSmooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = true; // photoreal cut-outs stay crisp, not pixelated

  // draw items first (creatures walk over them), back-to-front by y
  const drawables = [];
  for (const it of items) {
    if (it.held) continue;  // lifted shell is rendered by the shell-radio overlay
    const img = images[it.def.key]; if (!img) continue;
    drawables.push({ kind: 'item', y: it.y, it, img });
  }
  for (const c of creatures) {
    const img = images[c.def.key]; if (!img) continue;
    drawables.push({ kind: 'creature', y: c.y, c, img });
  }
  drawables.sort((a, b) => a.y - b.y);

  pickables = [];
  for (const d of drawables) {
    if (d.kind === 'item') {
      const it = d.it, img = d.img;
      const w = it.def.w * scale;
      const h = w * (img.height / img.width);
      const sx = dx + it.x * scale, sy = dy + it.y * scale;
      drawShadow(g, sx, sy, w, it.alpha, nightFactor);
      // items sit flat: anchor near their middle-bottom
      const cy = sy - h * 0.18;
      drawSprite(g, img, sx, cy, w, h, false, false, it.rot, it.alpha, filter);
      pickables.push({ cx: sx, cy, hw: w / 2, hh: h / 2, entity: { kind: 'item', key: it.def.key, name: prettyName(it.def.key), shell: !!it.def.shell, ref: it } });
    } else {
      const c = d.c, img = d.img, prof = c.prof;
      const w = c.def.w * scale;
      const h = w * (img.height / img.width);
      const bob = prof.bob ? Math.sin(t * 6 + c.phase) * prof.bob * scale * (c.pauseLeft > 0 ? 0.2 : 1) : 0;
      const sx = dx + c.x * scale, sy = dy + c.y * scale - bob;
      drawShadow(g, sx, dy + c.y * scale, w, c.alpha, nightFactor);
      let cx, cy, hw, hh;
      if (prof.face === 'topdown') {
        const ang = Math.atan2(c.lastVy, c.lastVx);
        drawSprite(g, img, sx, sy, w, h, false, false, ang - prof.native, c.alpha, filter);
        cx = sx; cy = sy; hw = Math.max(w, h) / 2; hh = hw;
      } else {
        const movingRight = c.lastVx >= 0;
        const flip = movingRight !== !!c.def.nativeRight;
        drawSprite(g, img, sx, sy, w, h, true, flip, 0, c.alpha, filter);
        cx = sx; cy = sy - h / 2; hw = w / 2; hh = h / 2;
      }
      pickables.push({ cx, cy, hw, hh, entity: { kind: 'creature', key: c.def.key, name: prettyName(c.def.key), ref: c } });
    }
  }

  g.imageSmoothingEnabled = prevSmooth;
}

// ----------------------------------------------------------------------------
// Init
// ----------------------------------------------------------------------------
export function initLife(opts) {
  W = opts.RENDER_W; H = opts.RENDER_H;
  getShoreline = opts.getShoreline;
  const base = opts.assetBase || './assets/';

  const all = [...ITEMS, ...CREATURES];
  let loaded = 0;
  for (const def of all) {
    const img = new Image();
    img.onload = () => {
      images[def.key] = img;
      if (++loaded === all.length) seedInitial();
    };
    img.onerror = () => { if (++loaded === all.length) seedInitial(); };
    img.src = base + def.file;
  }

  itemTarget = biasedTarget(LIFE.itemMin, LIFE.itemMax, LIFE.itemSkew);
  creatureTarget = biasedTarget(LIFE.creatureMin, LIFE.creatureMax, LIFE.creatureSkew);
  tItemReclaim = rand(...LIFE.itemReclaimEvery);
  tCreatureRetarget = rand(20, 40);
  // The opening population is filled gently by seedInitial(); let the steady
  // trickle take over only after that cascade has finished.
  tItemSpawn = 9;
  tCreatureSpawn = 11;
}

function seedInitial() {
  ready = true;
  // Gently populate on first render: each item/creature fades in one by one.
  const STAGGER = 380;
  let delay = 200;
  const at = (ms, fn) => setTimeout(fn, ms);

  for (let i = 0; i < itemTarget; i++) {
    at(delay, () => {
      const def = chooseItemDef();
      if (def) spawnItem(def, false); // fade in
    });
    delay += STAGGER;
  }
  for (let i = 0; i < creatureTarget; i++) {
    at(delay, () => spawnCreature());
    delay += STAGGER * 1.4;
  }
}
