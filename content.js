// content.js — what each creature/item "says" in its Windows XP box.
// Shells are handled separately (radio). Sea gulls are intentionally omitted
// (deferred). Everything else gets a snippet here.

// Real excerpts from public-domain translations (Gutenberg / Wikisource).
const PHILO = [
  { by: "Plato, Apology (tr. Jowett)",
    text: `To discourse daily about virtue, and of those other things about which you hear me examining myself and others, is the greatest good of man, and the unexamined life is not worth living.` },
  { by: "Plato, Apology (tr. Jowett)",
    text: `The hour of departure has arrived, and we go our ways—I to die, and you to live. Which is better God only knows.` },
  { by: "Confucius, Analects (tr. Legge)",
    text: `Is it not pleasant to learn with a constant perseverance and application? Is it not delightful to have friends coming from distant quarters? Is he not a man of complete virtue, who feels no discomposure though men may take no note of him?` },
  { by: "Confucius, Analects (tr. Legge)",
    text: `Fine words and an insinuating appearance are seldom associated with true virtue.` },
  { by: "Laozi, Tao Te Ching, ch. 8 (tr. Legge)",
    text: `The highest excellence is like that of water. The excellence of water appears in its benefiting all things, and in its occupying, without striving, the low place which all men dislike. Hence its way is near to that of the Tao.` },
  { by: "Du Fu, “A Spring View” (tr. Bynner)", poem: true,
    text: `Though a country be sundered, hills and rivers endure;\nAnd spring comes green again to trees and grasses\nWhere petals have been shed like tears\nAnd lonely birds have sung their grief.\nAfter the war-fires of three months,\nOne message from home is worth a ton of gold.\nI stroke my white hair. It has grown too thin\nTo hold the hairpins any more.` },
  { by: "Du Fu, “A Night Abroad” (tr. Bynner)", poem: true,
    text: `A light wind is rippling at the grassy shore . . .\nThrough the night, to my motionless tall mast,\nThe stars lean down from open space,\nAnd the moon comes running up the river.\nIf only my art might bring me fame\nAnd free my sick old age from office!—\nFlitting, flitting, what am I like\nBut a sand-snipe in the wide, wide world!` },
  { by: "Du Fu, “On a Moonlight Night” (tr. Bynner)", poem: true,
    text: `Far off in Fu-chou she is watching the moonlight,\nWatching it alone from the window of her chamber—\nFor our boy and girl, poor little babes,\nAre too young to know where the Capital is.\nWhen shall we lie again, with no more tears,\nWatching this bright light on our screen?` },
];

const LONGVIEW = [
  { by: "Marcus Aurelius, Meditations (tr. Long)",
    text: `As a stream so are all things belonging to the body; as a dream, or as a smoke, so are all that belong unto the soul.` },
  { by: "Marcus Aurelius, Meditations (tr. Long)",
    text: `Our life is a warfare, and a mere pilgrimage. Fame after life is no better than oblivion.` },
  { by: "Marcus Aurelius, Meditations (tr. Long)",
    text: `Many small pieces of frankincense are set upon the same altar: one drops first and is consumed, another after; and it comes all to one.` },
];

const QUIPS = [
  "Wait — did you see that? No? Okay. Okay. Moving on.",
  "I have somewhere to be. Several somewheres. All at once.",
  "The wave is coming. The wave is going. I cannot keep up. I will not stop trying.",
  "Found a thing. Lost the thing. Found another thing.",
  "Personal space. Personal space. PERSONAL SPACE.",
  "I'm not nervous. YOU'RE nervous.",
];

const EW = ["Ew.", "Ew, slimy!", "Ugh. Wet.", "Do not touch that."];

const GLASS = [
  "Glass occurs in nature: lightning fusing sand leaves hollow glass tubes called fulgurites.",
  "The Romans were the first to use glass for windows, around 100 AD.",
  "Sea glass needs 20–40 years of tumbling in the surf to lose its sharp edges.",
  "Red sea glass is among the rarest — much of it came from old ship lanterns and car taillights.",
  "The glassmakers of Murano were once forbidden to leave Venice, to keep their secrets from escaping.",
  "The oldest known glass objects are Egyptian beads from about 3500 BC.",
  "Obsidian — natural volcanic glass — made the sharpest blades of the ancient world.",
];

const CORAL = [
  "Coral is an animal, a farmer, and a rock at once: polyps that grow algae and build limestone.",
  "A coral reef can be thousands of years old, growing only centimeters a year.",
  "The Great Barrier Reef is the largest living structure on Earth — visible from space.",
  "Coral polyps are close cousins of jellyfish and sea anemones.",
  "Coral gets its color from the algae living inside it; stressed, it expels them and turns white.",
  "Some corals glow under ultraviolet light — a built-in sunscreen for their algae.",
];

const STARFISH = [
  "A sea star has no brain and no blood — it pumps seawater to move.",
  "Lose an arm? A sea star regrows it. Some can regrow an entire body from a single arm.",
  "Sea stars eat by pushing their stomach out through their mouth and digesting prey outside the body.",
  "They aren't fish — sea stars are echinoderms, kin to sea urchins and sand dollars.",
  "A sea star 'sees' with a tiny eyespot at the tip of each arm.",
];

const SANDDOLLAR = [
  "A living sand dollar is purple and fuzzy with tiny spines; the white disk is its bleached skeleton.",
  "The five-petal pattern is a field of tiny holes it used to breathe and creep along.",
  "Break one open and the little white pieces look like doves — an old sailors' good-luck legend.",
  "Sand dollars stand on edge in the current to catch drifting food, half-buried in the sand.",
];

const CUCUMBER = [
  "A threatened sea cucumber can eject its own internal organs to distract predators — then regrow them.",
  "Many sea cucumbers breathe through their backside.",
  "Sea cucumbers are echinoderms — distant cousins of sea stars, despite looking like a sad sock.",
  "Some host tiny pearlfish that live inside their rear cavity. Rent-free.",
  "They tidy the seafloor, eating sand and excreting it clean — the ocean's patient gut.",
];

const SHARK = [
  "A shark may grow and shed tens of thousands of teeth in a lifetime; the losers sink to the seabed.",
  "Shark teeth fossilize easily — the rest of a shark is cartilage and rarely survives.",
  "A shark's skin is covered in tiny tooth-like scales called denticles.",
  "Sharks have prowled the oceans for over 400 million years — older than trees.",
];

const MEGALODON = [
  "Megalodon's teeth could top 18 cm — the largest of any shark that ever lived.",
  "Otodus megalodon may have reached 18 meters, dwarfing today's great white.",
  "It vanished around 3.6 million years ago, perhaps as the seas cooled.",
  "Its bite is estimated among the most powerful of any animal, ever.",
];

const DEEPTIME = [
  "Horseshoe crabs have scuttled the seafloor for about 450 million years — older than the dinosaurs.",
  "They aren't crabs at all — they're closer to spiders and scorpions.",
  "Their blue, copper-based blood is used to test medicines for contamination.",
  "A horseshoe crab has ten eyes scattered across its body.",
  "That long tail isn't a weapon — it's for flipping back over.",
];

const MESSAGES = [
  "Whoever finds this: the tide was kind today.",
  "I am well. The lighthouse still turns. — M.",
  "If you are reading this, you are farther than I ever went.",
  "The water remembers everything. Be careful what you tell it.",
  "Lat. unknown. Long. gone. Still floating.",
  "Day 412. Still no signal. The fish have opinions.",
  "Found a door in the sea. Did not open it.",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// category -> { title, icon, pool, quote? }
const CATS = {
  philo:      { title: "Properties",        icon: "info", pool: PHILO, quote: true },
  longview:   { title: "System Properties", icon: "info", pool: LONGVIEW, quote: true },
  quip:       { title: "Notice",            icon: "info", pool: QUIPS },
  ew:         { title: "Warning",           icon: "warn", pool: EW },
  glass:      { title: "Did You Know?",     icon: "info", pool: GLASS },
  coral:      { title: "Did You Know?",     icon: "info", pool: CORAL },
  starfish:   { title: "Did You Know?",     icon: "info", pool: STARFISH },
  sanddollar: { title: "Did You Know?",     icon: "info", pool: SANDDOLLAR },
  cucumber:   { title: "Did You Know?",     icon: "info", pool: CUCUMBER },
  shark:      { title: "Did You Know?",     icon: "info", pool: SHARK },
  megalodon:  { title: "Did You Know?",     icon: "info", pool: MEGALODON },
  deeptime:   { title: "Did You Know?",     icon: "info", pool: DEEPTIME },
  message:    { title: "Incoming Message",  icon: "msg",  pool: MESSAGES },
};

function categoryFor(key) {
  if (/^(crab|hermit|hemit)/.test(key)) return "philo";
  if (/^sea_turtle/.test(key)) return "longview";
  if (/^horseshoe/.test(key)) return "deeptime";
  if (/^sandpiper/.test(key)) return "quip";
  if (/^(seagull|sea_bird)/.test(key)) return null; // gulls deferred
  if (/^seaweed/.test(key)) return "ew";
  if (key === "sea_glass") return "glass";
  if (/^coral/.test(key)) return "coral";
  if (/^sea_star/.test(key)) return "starfish";
  if (key === "sand_dollar") return "sanddollar";
  if (/^sea_cucumber/.test(key)) return "cucumber";
  if (/^shark_tooth/.test(key)) return "shark";
  if (key === "megalodon_tooth") return "megalodon";
  if (/^message_in_bottle/.test(key)) return "message";
  return null;
}

// Returns { title, icon, html } for an entity key, or null if it has no content.
export function contentFor(key) {
  const cat = categoryFor(key);
  if (!cat) return null;
  const c = CATS[cat];
  const item = pick(c.pool);
  let html;
  if (c.quote) {
    const body = item.poem
      ? `<span class="poem">${item.text.replace(/\n/g, "<br>")}</span>`
      : `&ldquo;${item.text}&rdquo;`;
    html = `${body}<span class="by">— ${item.by}</span>`;
  } else {
    html = item;
  }
  return { title: c.title, icon: c.icon, html };
}
