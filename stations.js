// stations.js — the rotation pool of live radio sources for the shell radio.
// Each shell pickup pulls the next station from a shuffled queue, so you cycle
// through variety without immediate repeats. All HTTPS so they play on a
// secure page; community streams occasionally change or go quiet.

export const STATIONS = [
  // --- weird / local / talk ---
  { name: "WFMU 91.1 — East Orange, NJ · Freeform", url: "https://stream0.wfmu.org/freeform-128k" },
  { name: "WFMU — Sheena's Jungle Room", url: "https://stream0.wfmu.org/sheena" },
  { name: "WFMU — Rock 'n' Soul Radio", url: "https://stream0.wfmu.org/rocknsoul" },
  { name: "Shirley & Spinoza — Freeform", url: "https://s2.radio.co/sec5fa6199/listen" },
  { name: "WMBR 88.1 — MIT, Cambridge", url: "https://wmbr.org:8002/hi" },
  { name: "KBOO 90.7 — Portland, OR · Community", url: "https://live.kboo.fm:8443/high" },
  { name: "KEXP 90.3 — Seattle, WA", url: "https://kexp-mp3-128.streamguys1.com/kexp128.mp3" },
  { name: "WKCR 89.9 — Columbia University, NYC", url: "https://wkcr.streamguys1.com/live" },
  { name: "Radio K (KUOM) — Minneapolis · College", url: "https://radiok.broadcasttool.stream/play_256" },
  { name: "Radio UNAM 96.1 — Mexico City", url: "https://tv.radiohosting.online:9484/stream" },
  { name: "BBC World Service — London · Talk", url: "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service" },
  { name: "RMC — France · Talk (FR)", url: "https://audio.bfmtv.com/rmcradio_128.mp3" },
  { name: "KOTR — 50s Sci-Fi Old Time Radio", url: "https://stream.kf7k.com/listen/scifi/radio.mp3" },
  { name: "SomaFM — SF in SF · Live Readings & Talks", url: "https://ice4.somafm.com/sfinsf-128-mp3" },
  { name: "SomaFM — Live · Special Broadcasts", url: "https://ice4.somafm.com/live-128-mp3" },
  // --- music beds ---
  { name: "Classic FM — London · Classical", url: "https://ice-the.musicradio.com/ClassicFMMP3" },
  { name: "YourClassical — Relax · Public Radio", url: "https://relax.stream.publicradio.org/relax.mp3" },
  { name: "Rai Radio 3 — Italy · Classical", url: "https://icestreaming.rai.it/3.mp3" },
  { name: "Jazz Radio — Blues", url: "https://jazzblues.ice.infomaniak.ch/jazzblues-high.mp3" },
  { name: "101 Smooth Jazz", url: "https://jking.cdnstream1.com/b22139_128mp3" },
  { name: "181.FM — Highway · Classic Country", url: "https://listen.181fm.com/181-highway_128k.mp3" },
  { name: "SomaFM — Groove Salad", url: "https://ice5.somafm.com/groovesalad-128-mp3" },
  { name: "SomaFM — Secret Agent", url: "https://ice6.somafm.com/secretagent-128-mp3" },
  { name: "SomaFM — Heavyweight Reggae", url: "https://ice6.somafm.com/reggae-256-mp3" },
  { name: "La Grosse Radio — Reggae", url: "https://hd.lagrosseradio.info/lagrosseradio-reggae-192.mp3" },
];

let queue = [];
function reshuffle() {
  queue = STATIONS.slice();
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
}

// Next station in the shuffled rotation.
export function nextStation() {
  if (!queue.length) reshuffle();
  return queue.shift();
}
