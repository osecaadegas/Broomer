"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  CARD_GAME_PROGRESS_EVENT,
  CARD_GAME_STARTING_POINTS,
  CARD_GAME_STORAGE_KEY,
} from "@/lib/card-game-rewards";

type ThemeId = "spongebob";
type Rarity = "common" | "rare" | "epic" | "legendary";
type GameView = "lobby" | "store" | "opening" | "inventory" | "collections";
type PackSource = "free" | "points";
type PackOpeningState =
  | "idle"
  | "holding"
  | "opening"
  | "rewards-ready"
  | "revealing"
  | "complete";
type OpeningAnimationType = "standard" | "bunny-omen" | "deep-wait";
type PackSound =
  | "hold"
  | "cancel"
  | "open"
  | "flip"
  | "rare"
  | "epic"
  | "legendary"
  | "new"
  | "complete";

type CardTheme = {
  id: ThemeId;
  name: string;
  shortName: string;
  packName: string;
  accent: string;
  gradient: string;
  cards: Record<Rarity, string[]>;
};

type CollectibleCard = {
  id: string;
  themeId: ThemeId;
  slug: string;
  file: string;
  name: string;
  title: string;
  rarity: Rarity;
  quote: string;
  power: number;
  jelly: number;
  artImage: string;
};

type StoredCardGame = {
  version: 2;
  points: number;
  cards: Record<string, number>;
  packsOpened: number;
  dupesSold: number;
  lastFreePackAtByTheme: Partial<Record<ThemeId, number>>;
};

type LegacyStoredCardGame = Partial<StoredCardGame> & {
  collection?: Record<string, unknown>;
  lastFreePackAt?: number | null;
};

type PackProduct = {
  id: string;
  themeId: ThemeId;
  name: string;
  tier: string;
  cost: number;
  size: number;
  odds: Record<Rarity, number>;
  featured?: boolean;
};

type Pull = {
  card: CollectibleCard;
  isNew: boolean;
  copy: number;
  duplicateValue: number;
};

type OpeningSession = {
  id: string;
  productId: string;
  productName: string;
  themeId: ThemeId;
  source: PackSource;
  animationType: OpeningAnimationType;
  pulls: Pull[];
  revealed: boolean[];
  packOpen: boolean;
  collectionBefore: number;
  collectionAfter: number;
  collectionTotal: number;
  createdAt: number;
};

type DuplicateEntry = {
  card: CollectibleCard;
  duplicateCount: number;
  value: number;
};

const PACK_COST = 150;
const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RANDOM_MAX = 0x100000000;
const PACK_OPENING_SEQUENCE_MS = 2850;
const HOLD_TO_OPEN_MS = 1150;
const HOLD_HAPTIC_MARKS = [0.18, 0.42, 0.68, 0.92];
const SOUND_PREF_KEY = `${CARD_GAME_STORAGE_KEY}:sound`;

const RARITY_REVEAL_MS: Record<Rarity, number> = {
  common: 760,
  rare: 1080,
  epic: 1650,
  legendary: 1900,
};

const OPENING_ANIMATION_REGISTRY: Record<
  OpeningAnimationType,
  {
    label: string;
    secret?: boolean;
    cue: string;
    className: string;
  }
> = {
  standard: {
    label: "Reef seal",
    cue: "The reef seal is listening.",
    className: "is-standard-opening",
  },
  "bunny-omen": {
    label: "Bunny omen",
    secret: true,
    cue: "...ears behind the pack",
    className: "is-bunny-omen-opening",
  },
  "deep-wait": {
    label: "Deep wait",
    secret: true,
    cue: "...wait",
    className: "is-deep-wait-opening",
  },
};

const PACK_SOUND_SETTINGS: Record<
  PackSound,
  {
    frequency: number;
    duration: number;
    gain: number;
    type: OscillatorType;
  }
> = {
  hold: { frequency: 154, duration: 0.1, gain: 0.025, type: "sine" },
  cancel: { frequency: 92, duration: 0.08, gain: 0.018, type: "triangle" },
  open: { frequency: 220, duration: 0.22, gain: 0.035, type: "sawtooth" },
  flip: { frequency: 330, duration: 0.12, gain: 0.025, type: "triangle" },
  rare: { frequency: 470, duration: 0.18, gain: 0.03, type: "sine" },
  epic: { frequency: 660, duration: 0.32, gain: 0.038, type: "triangle" },
  legendary: { frequency: 780, duration: 0.42, gain: 0.044, type: "sawtooth" },
  new: { frequency: 520, duration: 0.2, gain: 0.032, type: "sine" },
  complete: { frequency: 390, duration: 0.24, gain: 0.028, type: "triangle" },
};

const PACK_ART_BY_THEME: Record<
  ThemeId,
  {
    hero: string;
    cameo: string[];
  }
> = {
  spongebob: {
    hero: "/cards/spongebob/epic/spongebob-golden-boss.jpg",
    cameo: [
      "/cards/spongebob/rare/sandy-shadow-queen.png",
      "/cards/spongebob/common/krusty-krab-sign.jpg",
      "/cards/spongebob/epic/squidward-night-club.jpg",
    ],
  },
};

const RARITY_ASSET_FOLDER: Record<Rarity, string> = {
  common: "common",
  rare: "rare",
  epic: "epic",
  legendary: "Legendary",
};

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];

const RARITY_META: Record<
  Rarity,
  {
    label: string;
    shortLabel: string;
    sellValue: number;
    frame: string;
    chip: string;
    text: string;
    ring: string;
  }
> = {
  common: {
    label: "Common",
    shortLabel: "C",
    sellValue: 12,
    frame: "from-slate-300 via-zinc-50 to-slate-500",
    chip: "bg-slate-200 text-slate-900",
    text: "text-slate-800",
    ring: "ring-slate-200/65",
  },
  rare: {
    label: "Rare",
    shortLabel: "R",
    sellValue: 35,
    frame: "from-cyan-300 via-sky-100 to-blue-500",
    chip: "bg-cyan-200 text-cyan-950",
    text: "text-cyan-900",
    ring: "ring-cyan-200/80",
  },
  epic: {
    label: "Epic",
    shortLabel: "E",
    sellValue: 90,
    frame: "from-fuchsia-400 via-pink-100 to-violet-600",
    chip: "bg-fuchsia-200 text-fuchsia-950",
    text: "text-fuchsia-900",
    ring: "ring-fuchsia-200/80",
  },
  legendary: {
    label: "Legendary",
    shortLabel: "L",
    sellValue: 180,
    frame: "from-amber-300 via-yellow-100 to-rose-500",
    chip: "bg-yellow-200 text-yellow-950",
    text: "text-yellow-950",
    ring: "ring-yellow-200/90",
  },
};

const CARD_THEMES: Record<ThemeId, CardTheme> = {
  spongebob: {
    id: "spongebob",
    name: "SpongeBob Reef",
    shortName: "Reef",
    packName: "Krusty Cards",
    accent: "#fde047",
    gradient: "from-cyan-400 via-sky-600 to-violet-700",
    cards: {
      common: [
        "fred-fish.jpg",
        "fred-my-leg.jpg",
        "gary-be-happy.jpg",
        "gary-food-bowl.jpg",
        "gary-royal-pawn.png",
        "krusty-krab-restaurant.jpg",
        "krusty-krab-sign.jpg",
        "mr-krabs-money-dive.jpg",
        "mr-krabs-royal-rook.png",
        "patrick-royal-knight.png",
        "plankton-grin.jpg",
        "plankton-krabby-patty.jpg",
        "plankton-scream-sticker.jpg",
        "plankton-victory.jpg",
        "run-gary-run.jpg",
        "sandy-rodeo-ride.jpg",
        "sandy-royal-queen.png",
        "sandy-space-suit.jpg",
        "spongebob-front-yard.jpg",
        "spongebob-grill-shift.jpg",
        "spongebob-patrick-cool-duo.jpg",
        "spongebob-patrick-scared.jpg",
        "spongebob-pineapple-home.jpg",
        "spongebob-royal-king.png",
        "squidward-flower-dance.jpg",
        "squidward-house.jpg",
        "squidward-royal-bishop.png",
        "tom-fish.jpg",
      ],
      rare: [
        "gary-shadow-pawn.png",
        "mr-krabs-shadow-rook.png",
        "patrick-shadow-knight.png",
        "sandy-flower-dome.jpg",
        "sandy-shadow-queen.png",
        "sandy-wall-climb.jpg",
        "spongebob-fry-cook-point.jpg",
        "spongebob-shadow-king.png",
        "spongebob-summer-chill.jpg",
        "squidward-football-field.jpg",
        "squidward-sassy-hands.jpg",
        "squidward-shadow-bishop.png",
      ],
      epic: [
        "mr-krabs-deep-treasure.jpg",
        "plankton-pirate-captain.jpg",
        "spongebob-biker.jpg",
        "spongebob-gift-pirate.png",
        "spongebob-golden-boss.jpg",
        "spongebob-lab-kingpin.jpg",
        "spongebob-patrick-street-duo.jpg",
        "spongebob-skater.jpg",
        "spongebob-taxi-mech.jpg",
        "squidward-city-cruise.jpg",
        "squidward-night-club.jpg",
      ],
      legendary: [
        "Bikini Bottom got a streetwear upgrade_ \u{1F306}\u{1F525}\u{1F3A8}\u{1F4A5}.jpg",
        "Bikini Bottom got a streetwear upgrade_ \u{1F306}\u{1F525}\u{1F3A8}\u{1F4A5} (1).jpg",
        "Bikini Bottom got a streetwear upgrade_ \u{1F306}\u{1F525}\u{1F3A8}\u{1F4A5} (2).jpg",
        "download.jpg",
        "download (3).jpg",
        "download (4).jpg",
        "download (5).jpg",
        "download (6).jpg",
        "download (7).jpg",
        "download (8).jpg",
        "download (9).jpg",
        "download (10).jpg",
        "https___t_me_austinauston.jpg",
        "Patrick Star.jpg",
        "SpongeBob Diamond Grillz.jpg",
        "SpongeBob SquarePants.jpg",
        "Spongebob x Kaws Wallpaper.jpg",
        "Ya fav cartoons.jpg",
        "Ya fav cartoons (1).jpg",
      ],
    },
  },
};

const THEME_ORDER: ThemeId[] = ["spongebob"];

const PACK_PRODUCTS: PackProduct[] = [
  {
    id: "reef-starter",
    themeId: "spongebob",
    name: "Reef Starter Pack",
    tier: "Standard",
    cost: PACK_COST,
    size: 5,
    odds: { common: 72, rare: 22, epic: 5, legendary: 1 },
    featured: true,
  },
  {
    id: "deep-current",
    themeId: "spongebob",
    name: "Deep Current Pack",
    tier: "Premium",
    cost: 420,
    size: 5,
    odds: { common: 47, rare: 37, epic: 14, legendary: 2 },
  },
  {
    id: "neptune-vault",
    themeId: "spongebob",
    name: "Neptune Vault Pack",
    tier: "Elite",
    cost: 850,
    size: 7,
    odds: { common: 29, rare: 44, epic: 24, legendary: 3 },
  },
];

const CARD_WORDS: Record<string, string> = {
  biker: "Biker",
  boss: "Boss",
  chill: "Chill",
  city: "City",
  club: "Club",
  cook: "Cook",
  cool: "Cool",
  crab: "Crab",
  cruise: "Cruise",
  deep: "Deep",
  dance: "Dance",
  dome: "Dome",
  duo: "Duo",
  fish: "Fish",
  flower: "Flower",
  food: "Food",
  football: "Football",
  fred: "Fred",
  front: "Front",
  fry: "Fry",
  gary: "Gary",
  gift: "Gift",
  golden: "Golden",
  grill: "Grill",
  grin: "Grin",
  hands: "Hands",
  home: "Home",
  house: "House",
  king: "King",
  kingpin: "Kingpin",
  krab: "Krab",
  krabby: "Krabby",
  krabs: "Krabs",
  krusty: "Krusty",
  lab: "Lab",
  leg: "Leg",
  mech: "Mech",
  money: "Money",
  mr: "Mr.",
  my: "My",
  night: "Night",
  palm: "Palm",
  patrick: "Patrick",
  patty: "Patty",
  pawn: "Pawn",
  pineapple: "Pineapple",
  pirate: "Pirate",
  plankton: "Plankton",
  restaurant: "Restaurant",
  ride: "Ride",
  rodeo: "Rodeo",
  rook: "Rook",
  royal: "Royal",
  run: "Run",
  sandy: "Sandy",
  sassy: "Sassy",
  scared: "Scared",
  shadow: "Shadow",
  shift: "Shift",
  sign: "Sign",
  skater: "Skater",
  space: "Space",
  spongebob: "SpongeBob",
  squidward: "Squidward",
  star: "Star",
  street: "Street",
  suit: "Suit",
  summer: "Summer",
  taxi: "Taxi",
  tom: "Tom",
  treasure: "Treasure",
  victory: "Victory",
  wall: "Wall",
  yard: "Yard",
};

const LEGENDARY_DOWNLOAD_NAMES: Record<string, string> = {
  download: "Midnight Reef Icon",
  "download (3)": "Golden Alley SpongeBob",
  "download (4)": "Vault Chain SpongeBob",
  "download (5)": "Night Market SpongeBob",
  "download (6)": "Royal Grill SpongeBob",
  "download (7)": "Bubble Flex Patrick",
  "download (8)": "Krusty Afterhours Boss",
  "download (9)": "Street Crown Patrick",
  "download (10)": "Reef Graffiti Legend",
};

const LEGENDARY_NAME_OVERRIDES: Record<string, string> = {
  "https___t_me_austinauston": "Midnight Reef Signal",
  "Patrick Star": "Patrick Star Apex",
  "SpongeBob Diamond Grillz": "Diamond Grillz SpongeBob",
  "SpongeBob SquarePants": "SquarePants Icon",
  "Spongebob x Kaws Wallpaper": "Kaws Reef Signal",
  "Ya fav cartoons": "Favorite Cartoon Kings",
  "Ya fav cartoons (1)": "Favorite Cartoon Queens",
};

const RARITY_SCORE_BASE: Record<Rarity, number> = {
  common: 12,
  rare: 72,
  epic: 150,
  legendary: 280,
};

const RARITY_TITLES: Record<Rarity, string[]> = {
  common: ["Reef Regular", "Shift Pull", "Daily Catch", "Dock Card"],
  rare: ["Vault Pull", "Deep Current", "Collector Cut", "Prize Catch"],
  epic: ["Headliner", "Neptune Cut", "Deep-Sea Crown", "Vault Star"],
  legendary: ["Street Myth", "Vault Apex", "Reef Relic", "Golden Omen"],
};

const REVEAL_SOUND_BY_RARITY: Record<Rarity, PackSound> = {
  common: "flip",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
};

const REVEAL_NOTICE_BY_RARITY: Record<Rarity, string> = {
  common: "Card pressure rising.",
  rare: "The reef is glowing.",
  epic: "Something big is coming.",
  legendary: "The vault just went quiet.",
};

const REVEAL_HAPTIC_BY_RARITY: Record<Rarity, number | number[]> = {
  common: 10,
  rare: [12, 24],
  epic: [18, 26, 18, 44],
  legendary: [20, 38, 24, 52, 32],
};

const REVEAL_ALL_HAPTIC_BY_RARITY: Record<Rarity, number | number[]> = {
  common: 10,
  rare: [12, 20],
  epic: [16, 28, 16, 42],
  legendary: [20, 34, 22, 48],
};

const REVEAL_ALL_MS: Record<Rarity, number> = {
  common: 640,
  rare: 820,
  epic: 1080,
  legendary: 1220,
};

function slugFromFile(file: string) {
  return file.replace(/\.[^.]+$/, "");
}

function legendaryCardName(slug: string) {
  if (slug.startsWith("Bikini Bottom got a streetwear upgrade_")) {
    if (slug.endsWith("(1)")) return "Bikini Bottom Heat Drop";
    if (slug.endsWith("(2)")) return "Bikini Bottom Night Drop";
    return "Bikini Bottom Streetwear Drop";
  }

  return LEGENDARY_NAME_OVERRIDES[slug] ?? LEGENDARY_DOWNLOAD_NAMES[slug];
}

function formatCardName(slug: string, rarity: Rarity) {
  if (rarity === "legendary") {
    const override = legendaryCardName(slug);
    if (override) return override;
  }

  return slug
    .split("-")
    .map(
      (word) =>
        CARD_WORDS[word] ?? `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(" ");
}

function cardTitle(rarity: Rarity, index: number) {
  const titles = RARITY_TITLES[rarity];
  return titles[index % titles.length];
}

function cardQuote(rarity: Rarity, name: string) {
  if (rarity === "legendary") return `${name} makes the whole vault go quiet.`;
  if (rarity === "epic") return `${name} headlines the deep-sea case.`;
  if (rarity === "rare") return `${name} lands in the vault shelf.`;
  return `${name} joins the reef binder.`;
}

function buildCard(
  theme: CardTheme,
  rarity: Rarity,
  file: string,
  index: number,
): CollectibleCard {
  const slug = slugFromFile(file);
  const name = formatCardName(slug, rarity);
  const base = RARITY_SCORE_BASE[rarity];
  return {
    id: `${theme.id}:${rarity}:${slug}`,
    themeId: theme.id,
    slug,
    file,
    name,
    title: cardTitle(rarity, index),
    rarity,
    quote: cardQuote(rarity, name),
    power: base + ((index * 7) % 43),
    jelly: base + 10 + ((index * 11) % 53),
    artImage: encodeURI(`/cards/${theme.id}/${RARITY_ASSET_FOLDER[rarity]}/${file}`),
  };
}

const CARDS: CollectibleCard[] = THEME_ORDER.flatMap((themeId) => {
  const theme = CARD_THEMES[themeId];
  return RARITY_ORDER.flatMap((rarity) =>
    theme.cards[rarity].map((file, index) => buildCard(theme, rarity, file, index)),
  );
});

const CARDS_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

const CARDS_BY_THEME: Record<ThemeId, CollectibleCard[]> = {
  spongebob: CARDS.filter((card) => card.themeId === "spongebob"),
};

const LEGACY_CARD_ID_MAP = new Map(
  CARDS.flatMap((card) => [
    [`${card.rarity}-${card.slug}`, card.id],
    [card.slug, card.id],
  ]),
);

function createDefaultGame(): StoredCardGame {
  return {
    version: 2,
    points: CARD_GAME_STARTING_POINTS,
    cards: {},
    packsOpened: 0,
    dupesSold: 0,
    lastFreePackAtByTheme: {},
  };
}

function normalizeCardCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const counts: Record<string, number> = {};
  for (const [rawId, rawCount] of Object.entries(raw as Record<string, unknown>)) {
    const count = Math.floor(Number(rawCount));
    const cardId = CARDS_BY_ID.has(rawId) ? rawId : LEGACY_CARD_ID_MAP.get(rawId);
    if (!cardId || !Number.isFinite(count) || count <= 0) continue;
    counts[cardId] = (counts[cardId] ?? 0) + count;
  }
  return counts;
}

function readStoredGame(): StoredCardGame {
  const fallback = createDefaultGame();
  try {
    const raw = window.localStorage.getItem(CARD_GAME_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as LegacyStoredCardGame;
    const lastFreePackAtByTheme: Partial<Record<ThemeId, number>> = {};

    for (const themeId of THEME_ORDER) {
      const themeValue = parsed.lastFreePackAtByTheme?.[themeId];
      const legacyValue = themeId === "spongebob" ? parsed.lastFreePackAt : null;
      const value = typeof themeValue === "number" ? themeValue : legacyValue;
      if (typeof value === "number" && Number.isFinite(value)) {
        lastFreePackAtByTheme[themeId] = value;
      }
    }

    return {
      version: 2,
      points: Number.isFinite(parsed.points) ? Number(parsed.points) : fallback.points,
      cards: normalizeCardCounts(parsed.cards ?? parsed.collection),
      packsOpened: Number.isFinite(parsed.packsOpened)
        ? Number(parsed.packsOpened)
        : fallback.packsOpened,
      dupesSold: Number.isFinite(parsed.dupesSold)
        ? Number(parsed.dupesSold)
        : fallback.dupesSold,
      lastFreePackAtByTheme,
    };
  } catch {
    return fallback;
  }
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function randomUnit() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0] / RANDOM_MAX;
  }
  return Math.random();
}

function pickRarity(odds: Record<Rarity, number>): Rarity {
  const total = RARITY_ORDER.reduce((sum, rarity) => sum + odds[rarity], 0);
  let roll = randomUnit() * total;
  for (const rarity of RARITY_ORDER) {
    roll -= odds[rarity];
    if (roll <= 0) return rarity;
  }
  return RARITY_ORDER[0];
}

function randomFromArray<T>(items: T[]) {
  return items[Math.floor(randomUnit() * items.length)] ?? items[0];
}

function randomCardOfRarity(themeId: ThemeId, rarity: Rarity) {
  const themeCards = CARDS_BY_THEME[themeId];
  const rarityCards = themeCards.filter((card) => card.rarity === rarity);
  return randomFromArray(rarityCards.length > 0 ? rarityCards : themeCards);
}

function rollPack(product: PackProduct) {
  return Array.from({ length: product.size }, () =>
    randomCardOfRarity(product.themeId, pickRarity(product.odds)),
  );
}

function pickOpeningAnimationType(): OpeningAnimationType {
  const roll = randomUnit();
  if (roll < 0.045) return "deep-wait";
  if (roll < 0.11) return "bunny-omen";
  return "standard";
}

function oddsLabel(product: PackProduct) {
  return RARITY_ORDER.map(
    (rarity) => `${RARITY_META[rarity].shortLabel} ${product.odds[rarity]}%`,
  ).join(" / ");
}

function rarityRank(rarity: Rarity) {
  return RARITY_ORDER.indexOf(rarity);
}

function getCollectionNumber(card: CollectibleCard) {
  return (
    CARDS_BY_THEME[card.themeId].findIndex((candidate) => candidate.id === card.id) + 1
  );
}

function countOwnedCards(
  cards: Record<string, number>,
  themeId: ThemeId,
) {
  return CARDS_BY_THEME[themeId].filter((card) => (cards[card.id] ?? 0) > 0)
    .length;
}

function getBestPullIndex(pulls: Pull[]) {
  return pulls.reduce((bestIndex, pull, index) => {
    const bestPull = pulls[bestIndex];
    const pullScore =
      rarityRank(pull.card.rarity) * 1000 + pull.card.power + pull.card.jelly;
    const bestScore =
      rarityRank(bestPull.card.rarity) * 1000 +
      bestPull.card.power +
      bestPull.card.jelly;
    return pullScore > bestScore ? index : bestIndex;
  }, 0);
}

function CardBack({
  theme,
  compact = false,
  priority = false,
}: {
  theme: CardTheme;
  compact?: boolean;
  priority?: boolean;
}) {
  const backArt = PACK_ART_BY_THEME[theme.id];

  return (
    <div
      className={`sponge-card-back-face absolute inset-0 grid place-items-center overflow-hidden rounded-[inherit] bg-gradient-to-br ${theme.gradient}`}
    >
      <div
        className="sponge-card-back-art"
        aria-hidden="true"
        style={{ position: "absolute" }}
      >
        <Image
          src={backArt.hero}
          alt=""
          fill
          sizes={compact ? "96px" : "(max-width: 640px) 62vw, 280px"}
          className="object-cover"
          priority={priority}
        />
      </div>
      <span className="sponge-card-back-foil" aria-hidden="true" />
      <span className="sponge-card-back-grid" />
      <span className="sponge-card-back-orbit" />
      <div className={`sponge-card-back-badge ${compact ? "is-compact" : ""}`}>
        <span>{theme.shortName}</span>
        {!compact && <strong>Krusty Cards</strong>}
      </div>
      {!compact && (
        <div className="sponge-card-back-cameos" aria-hidden="true">
          {backArt.cameo.map((src, index) => (
            <span
              key={src}
              className="sponge-card-back-cameo"
              style={
                {
                  position: "relative",
                  "--back-cameo-rotate": `${(index - 1) * 8}deg`,
                } as CSSProperties
              }
            >
              <Image src={src} alt="" fill sizes="54px" className="object-cover" />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CardArtwork({
  card,
  locked = false,
  compact = false,
  large = false,
}: {
  card: CollectibleCard;
  locked?: boolean;
  compact?: boolean;
  large?: boolean;
}) {
  const theme = CARD_THEMES[card.themeId];

  if (locked) {
    return <CardBack theme={theme} compact={compact} />;
  }

  return (
    <div
      className="absolute inset-0"
      role="img"
      aria-label={`${card.name} card artwork`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient}`} />
      <div
        className={`sponge-card-art-frame ${large ? "is-large" : ""}`}
        style={{ position: "absolute" }}
      >
        <Image
          src={card.artImage}
          alt=""
          fill
          sizes={
            large
              ? "(max-width: 640px) 72vw, 280px"
              : compact
                ? "(max-width: 640px) 30vw, 170px"
                : "(max-width: 640px) 70vw, 260px"
          }
          className="sponge-card-art-image"
          priority={large}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(255,255,255,0.24),transparent_34%),linear-gradient(180deg,transparent_54%,rgba(2,6,23,0.24))]" />
    </div>
  );
}

function CollectibleCardView({
  card,
  count,
  locked = false,
  compact = false,
  large = false,
}: {
  card: CollectibleCard;
  count?: number;
  locked?: boolean;
  compact?: boolean;
  large?: boolean;
}) {
  const displayName = locked ? "Undiscovered" : card.name;
  const displayTitle = locked ? "Vault Locked" : card.title;
  const powerLabel = compact ? "P" : "Power";
  const jellyLabel = compact ? "J" : "Jelly";

  return (
    <div
      className={`sponge-collectible-card ${compact ? "is-compact" : ""} ${
        large ? "is-large" : ""
      } ${locked ? "is-locked" : ""}`}
      data-rarity={card.rarity}
    >
      <div className="sponge-card-shell">
        <div className="sponge-card-topline">
          <div className="min-w-0">
            <p className="sponge-card-name">{displayName}</p>
            {!compact && <p className="sponge-card-title">{displayTitle}</p>}
          </div>
          <span className="sponge-rarity-chip">
            {RARITY_META[card.rarity].label}
          </span>
        </div>
        <div className="sponge-card-image-well">
          <CardArtwork card={card} locked={locked} compact={compact} large={large} />
          {locked && (
            <div className="sponge-card-lock-mark">
              ?
            </div>
          )}
        </div>
        <div className="sponge-card-footer">
          <span className="sponge-stat-chip">
            {powerLabel} {locked ? "?" : card.power}
          </span>
          <span className="sponge-stat-chip">
            {jellyLabel} {locked ? "?" : card.jelly}
          </span>
        </div>
        {typeof count === "number" && count > 1 && !locked && (
          <span className="sponge-copy-badge">
            x{count}
          </span>
        )}
      </div>
    </div>
  );
}

function SpongePackIcon({
  theme,
  dramatic = false,
}: {
  theme: CardTheme;
  dramatic?: boolean;
}) {
  return (
    <div
      className={`sponge-premium-pack relative mx-auto grid aspect-[3/4] w-full max-w-[13rem] place-items-center overflow-hidden rounded-[2rem] border-4 border-yellow-200 bg-gradient-to-br ${theme.gradient} p-5 shadow-[0_2rem_5rem_rgba(0,0,0,0.42)] ${
        dramatic ? "sponge-pack-theater-object" : ""
      }`}
    >
      <span className="sponge-pack-shine absolute inset-0" />
      <span className="sponge-pack-depth absolute inset-y-3 right-0 w-5 rounded-r-[1.7rem]" />
      <span className="absolute inset-4 rounded-[1.5rem] border border-white/25" />
      <span className="absolute left-5 top-5 h-9 w-9 rounded-full border border-yellow-200/60 bg-yellow-200/15" />
      <span className="absolute bottom-6 right-5 h-12 w-12 rounded-full border border-cyan-100/50 bg-cyan-100/10" />
      <span className="relative grid h-28 w-24 place-items-center rounded-3xl border-2 border-yellow-200 bg-black/30 text-center text-xl font-black uppercase leading-none tracking-[0.18em] text-yellow-200 shadow-[0_0_2rem_rgba(250,204,21,0.32)]">
        {theme.shortName}
      </span>
    </div>
  );
}

function BubbleField() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {Array.from({ length: 26 }, (_, index) => (
        <span
          key={index}
          className="sponge-card-bubble"
          style={
            {
              left: `${(index * 37) % 100}%`,
              width: `${10 + ((index * 17) % 38)}px`,
              height: `${10 + ((index * 17) % 38)}px`,
              animationDelay: `${(index % 12) * 0.7}s`,
              animationDuration: `${9 + (index % 7)}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function triggerHaptic(pattern: number | number[]) {
  if (typeof window === "undefined" || !window.navigator.vibrate) return;
  try {
    window.navigator.vibrate(pattern);
  } catch {
    // Vibration is best-effort and can be blocked by device/browser settings.
  }
}

function playPackSound(
  sound: PackSound,
  enabled: boolean,
  contextRef: { current: AudioContext | null },
) {
  if (!enabled || typeof window === "undefined") return;

  try {
    const WebAudioContext =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!WebAudioContext) return;

    const context = contextRef.current ?? new WebAudioContext();
    contextRef.current = context;
    const settings = PACK_SOUND_SETTINGS[sound];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(40, settings.frequency * 0.62),
      now + settings.duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.gain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + settings.duration + 0.02);
  } catch {
    // Audio feedback should never block the pack opening flow.
  }
}

function closePackAudioContext(contextRef: { current: AudioContext | null }) {
  const audioContext = contextRef.current;
  contextRef.current = null;
  audioContext?.close().catch(() => undefined);
}

function PackParticleField({ dense = false }: { dense?: boolean }) {
  return (
    <div className="sponge-cine-particles" aria-hidden>
      {Array.from({ length: dense ? 28 : 18 }, (_, index) => (
        <span
          key={index}
          style={
            {
              "--particle-x": `${(index * 29) % 100}%`,
              "--particle-y": `${(index * 47) % 100}%`,
              "--particle-delay": `${(index % 9) * 0.28}s`,
              "--particle-size": `${0.22 + (index % 4) * 0.08}rem`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function PackDisplay({
  theme,
  cardCount,
  state,
  holdProgress,
  animationType,
}: {
  theme: CardTheme;
  cardCount: number;
  state: PackOpeningState;
  holdProgress: number;
  animationType: OpeningAnimationType;
}) {
  const packArt = PACK_ART_BY_THEME[theme.id];
  const animation = OPENING_ANIMATION_REGISTRY[animationType];

  return (
    <div
      className={`sponge-cine-pack-scene ${animation.className}`}
      data-state={state}
      style={
        {
          "--hold-progress": holdProgress,
          "--hold-percent": `${Math.round(holdProgress * 100)}%`,
        } as CSSProperties
      }
    >
      <div className="sponge-cine-pack-aura" aria-hidden />
      <div className="sponge-cine-pack-shadow" aria-hidden />
      <div className="sponge-cine-secret-cue" aria-hidden>
        {animation.secret ? animation.cue : ""}
      </div>
      <div className="sponge-cine-pack-shell">
        <span className="sponge-cine-pack-ears" aria-hidden />
        <div className="sponge-cine-pack" aria-label={`${theme.packName} pack`}>
          <span className="sponge-cine-pack-seam" aria-hidden />
          <span className="sponge-cine-pack-crack one" aria-hidden />
          <span className="sponge-cine-pack-crack two" aria-hidden />
          <span className="sponge-cine-pack-crack three" aria-hidden />
          <div className="sponge-cine-pack-art">
            <Image
              src={packArt.hero}
              alt=""
              fill
              sizes="(max-width: 640px) 62vw, 260px"
              className="object-cover"
              priority
            />
          </div>
          <div className="sponge-cine-pack-glass" aria-hidden />
          <div className="sponge-cine-pack-title">
            <span>{theme.shortName}</span>
            <strong>Reef Rumble</strong>
          </div>
          <div className="sponge-cine-pack-count">
            <strong>{cardCount}</strong>
            <span>cards</span>
          </div>
          <div className="sponge-cine-pack-cameos" aria-hidden>
            {packArt.cameo.map((src, index) => (
              <span key={src}>
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="46px"
                  className="object-cover"
                  priority={index === 0}
                />
              </span>
            ))}
          </div>
          <span className="sponge-cine-pack-bottom-label">
            Broomer reef issue
          </span>
        </div>
      </div>
    </div>
  );
}

function HoldToOpen({
  disabled,
  opening,
  onComplete,
  onProgressChange,
  playSound,
}: {
  disabled: boolean;
  opening: boolean;
  onComplete: () => void;
  onProgressChange: (progress: number) => void;
  playSound: (sound: PackSound) => void;
}) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const holdStartedAtRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const hapticMarkRef = useRef(0);
  const holdingRef = useRef(false);

  function setNextProgress(nextProgress: number) {
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    onProgressChange(nextProgress);
  }

  function stopHold(reset = true) {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    holdingRef.current = false;
    setHolding(false);
    hapticMarkRef.current = 0;
    if (reset && progressRef.current < 1) {
      if (progressRef.current > 0.05) {
        triggerHaptic(8);
        playSound("cancel");
      }
      setNextProgress(0);
    }
  }

  function finishHold() {
    stopHold(false);
    setNextProgress(1);
    triggerHaptic([12, 18, 18, 28, 26, 58]);
    onComplete();
  }

  function tickHold() {
    const elapsed = performance.now() - holdStartedAtRef.current;
    const nextProgress = Math.min(1, elapsed / HOLD_TO_OPEN_MS);
    setNextProgress(nextProgress);

    while (
      hapticMarkRef.current < HOLD_HAPTIC_MARKS.length &&
      nextProgress >= HOLD_HAPTIC_MARKS[hapticMarkRef.current]
    ) {
      hapticMarkRef.current += 1;
      triggerHaptic(hapticMarkRef.current === HOLD_HAPTIC_MARKS.length ? 28 : 10);
    }

    if (nextProgress >= 1) {
      finishHold();
      return;
    }

    frameRef.current = window.requestAnimationFrame(tickHold);
  }

  function startHold() {
    if (disabled || opening || holdingRef.current) return;
    holdStartedAtRef.current = performance.now();
    hapticMarkRef.current = 0;
    holdingRef.current = true;
    setHolding(true);
    playSound("hold");
    triggerHaptic(8);
    frameRef.current = window.requestAnimationFrame(tickHold);
  }

  function isHoldKey(event: KeyboardEvent<HTMLButtonElement>) {
    return (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.code === "Space"
    );
  }

  useEffect(
    () => () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  return (
    <div
      className={`sponge-hold-panel ${holding ? "is-holding" : ""}`}
      style={{ "--hold-percent": `${Math.round(progress * 100)}%` } as CSSProperties}
    >
      <button
        type="button"
        className="sponge-hold-target"
        disabled={disabled}
        aria-label="Hold to open pack"
        aria-describedby="sponge-hold-progress-label"
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          startHold();
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          stopHold();
        }}
        onPointerCancel={() => stopHold()}
        onMouseDown={(event) => {
          if (event.button !== 0 || disabled) return;
          startHold();
        }}
        onMouseUp={() => stopHold()}
        onMouseLeave={() => stopHold()}
        onTouchStart={(event) => {
          if (disabled) return;
          event.preventDefault();
          startHold();
        }}
        onTouchEnd={(event) => {
          event.preventDefault();
          stopHold();
        }}
        onTouchCancel={() => stopHold()}
        onKeyDown={(event) => {
          if (event.repeat || disabled) return;
          if (isHoldKey(event)) {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(event) => {
          if (isHoldKey(event)) {
            event.preventDefault();
            stopHold();
          }
        }}
      >
        <span>{opening ? "Opening" : holding ? "Keep holding" : "Hold to open"}</span>
        <strong>{Math.round(progress * 100)}%</strong>
      </button>
      <div
        id="sponge-hold-progress-label"
        className="sponge-hold-progress"
        aria-hidden
      >
        <span />
      </div>
    </div>
  );
}

function CollectionProgressStrip({
  before,
  after,
  total,
}: {
  before: number;
  after: number;
  total: number;
}) {
  const beforePercent = Math.round((before / Math.max(1, total)) * 100);
  const afterPercent = Math.round((after / Math.max(1, total)) * 100);

  return (
    <div
      className="sponge-cine-collection-progress"
      style={
        {
          "--collection-before": `${beforePercent}%`,
          "--collection-after": `${afterPercent}%`,
        } as CSSProperties
      }
    >
      <div>
        <span>Collection</span>
        <strong>
          {after} / {total}
        </strong>
      </div>
      <div className="sponge-cine-progress-track" aria-hidden>
        <span />
      </div>
      <p>{afterPercent}%</p>
    </div>
  );
}

function OpeningRewardCard({
  pull,
  index,
  total,
  revealed,
  revealing,
  onReveal,
}: {
  pull: Pull;
  index: number;
  total: number;
  revealed: boolean;
  revealing: boolean;
  onReveal: (index: number) => void;
}) {
  const collectionNumber = getCollectionNumber(pull.card);

  return (
    <button
      type="button"
      className={`sponge-cine-reward-card ${revealed ? "is-revealed" : ""} ${
        revealing ? "is-revealing" : ""
      }`}
      data-rarity={revealed || revealing ? pull.card.rarity : undefined}
      disabled={revealed || revealing}
      aria-label={
        revealed
          ? `${pull.card.name}, ${RARITY_META[pull.card.rarity].label}`
          : `Reveal mystery card ${index + 1}`
      }
      onClick={() => onReveal(index)}
    >
      <span className="sponge-cine-card-depth">
        <span className="sponge-cine-card-face sponge-cine-card-back-face">
          <span className="sponge-cine-mystery-mark">?</span>
          <span className="sponge-cine-mystery-label">
            Card {index + 1}
          </span>
        </span>
        <span className="sponge-cine-card-face sponge-cine-card-front-face">
          <span className="sponge-cine-reward-rarity">
            {RARITY_META[pull.card.rarity].label}
          </span>
          <span className="sponge-cine-reward-art">
            <Image
              src={pull.card.artImage}
              alt=""
              fill
              sizes="(max-width: 640px) 38vw, 160px"
              className="object-cover"
              loading="eager"
            />
          </span>
          <span className="sponge-cine-reward-name">{pull.card.name}</span>
          <span className="sponge-cine-reward-title">{pull.card.title}</span>
          <span
            className={`sponge-cine-reward-badge ${
              pull.isNew ? "is-new" : "is-dupe"
            }`}
          >
            {pull.isNew ? "New!" : `Duplicate x${pull.copy}`}
          </span>
          <span className="sponge-cine-reward-number">
            #{collectionNumber} / {total}
          </span>
        </span>
      </span>
    </button>
  );
}

function PackSummary({
  session,
  canOpenAnother,
  onOpenAnother,
  onBackToCollection,
}: {
  session: OpeningSession;
  canOpenAnother: boolean;
  onOpenAnother: () => void;
  onBackToCollection: () => void;
}) {
  const bestPull = session.pulls[getBestPullIndex(session.pulls)];
  const newCount = session.pulls.filter((pull) => pull.isNew).length;
  const duplicateCount = session.pulls.length - newCount;

  return (
    <div className="sponge-pack-summary">
      <div className="sponge-pack-summary-hero">
        <p>Best pull</p>
        <CollectibleCardView card={bestPull.card} large />
        <div>
          <span>{RARITY_META[bestPull.card.rarity].label}</span>
          <strong>{bestPull.card.name}</strong>
          <em>
            {bestPull.isNew
              ? `New • #${getCollectionNumber(bestPull.card)} / ${
                  session.collectionTotal
                }`
              : `Duplicate x${bestPull.copy}`}
          </em>
        </div>
      </div>

      <div className="sponge-pack-summary-panel">
        <p className="sponge-pack-summary-kicker">Pack complete</p>
        <div className="sponge-pack-summary-stats">
          <span>
            <strong>{newCount}</strong>
            New
          </span>
          <span>
            <strong>{duplicateCount}</strong>
            Duplicates
          </span>
        </div>
        <CollectionProgressStrip
          before={session.collectionBefore}
          after={session.collectionAfter}
          total={session.collectionTotal}
        />
        <div className="sponge-pack-summary-actions">
          <button
            type="button"
            className="sponge-success-action"
            disabled={!canOpenAnother}
            onClick={onOpenAnother}
          >
            Open Another
          </button>
          <button
            type="button"
            className="sponge-ghost-action"
            onClick={onBackToCollection}
          >
            Back To Collection
          </button>
        </div>
      </div>
    </div>
  );
}

function RewardStage({
  session,
  turningCardIndex,
  autoRevealing,
  canOpenAnother,
  onReveal,
  onRevealNext,
  onRevealAll,
  onOpenAnother,
  onBackToCollection,
}: {
  session: OpeningSession;
  turningCardIndex: number | null;
  autoRevealing: boolean;
  canOpenAnother: boolean;
  onReveal: (index: number) => void;
  onRevealNext: () => void;
  onRevealAll: () => void;
  onOpenAnother: () => void;
  onBackToCollection: () => void;
}) {
  const revealedCount = session.revealed.filter(Boolean).length;
  const complete = session.revealed.every(Boolean);
  const cinematicPull =
    turningCardIndex != null ? session.pulls[turningCardIndex] : null;

  return (
    <div
      className="sponge-reward-stage"
      data-cinematic-rarity={cinematicPull?.card.rarity ?? ""}
      data-complete={complete ? "true" : "false"}
    >
      <div className="sponge-reward-stage-header">
        <div>
          <p>Pack results</p>
          <h3>
            {complete
              ? "Every card is awake"
              : cinematicPull?.card.rarity === "legendary"
                ? "The vault just went quiet"
                : cinematicPull?.card.rarity === "epic"
                ? "Something big is coming"
                : "Choose a mystery card"}
          </h3>
        </div>
        <span>
          {revealedCount}/{session.pulls.length}
        </span>
      </div>

      <div className="sponge-cine-reward-grid">
        {session.pulls.map((pull, index) => (
          <OpeningRewardCard
            key={`${session.id}-${pull.card.id}-${index}`}
            pull={pull}
            index={index}
            total={session.collectionTotal}
            revealed={session.revealed[index]}
            revealing={turningCardIndex === index}
            onReveal={onReveal}
          />
        ))}
      </div>

      {!complete && (
        <div className="sponge-reveal-actions">
          <button
            type="button"
            className="sponge-primary-action"
            disabled={turningCardIndex !== null || autoRevealing}
            onClick={onRevealNext}
          >
            Reveal Next
          </button>
          <button
            type="button"
            className="sponge-secondary-action"
            disabled={turningCardIndex !== null || autoRevealing}
            onClick={onRevealAll}
          >
            Reveal All
          </button>
        </div>
      )}

      {complete && (
        <PackSummary
          session={session}
          canOpenAnother={canOpenAnother}
          onOpenAnother={onOpenAnother}
          onBackToCollection={onBackToCollection}
        />
      )}
    </div>
  );
}

function PackOpeningFocus({
  session,
  theme,
  opening,
  holdProgress,
  turningCardIndex,
  autoRevealing,
  soundEnabled,
  canOpenAnother,
  onHoldProgress,
  onBeginOpening,
  onReveal,
  onRevealNext,
  onRevealAll,
  onOpenAnother,
  onBackToCollection,
  onToggleSound,
  playSound,
}: {
  session: OpeningSession;
  theme: CardTheme;
  opening: boolean;
  holdProgress: number;
  turningCardIndex: number | null;
  autoRevealing: boolean;
  soundEnabled: boolean;
  canOpenAnother: boolean;
  onHoldProgress: (progress: number) => void;
  onBeginOpening: () => void;
  onReveal: (index: number) => void;
  onRevealNext: () => void;
  onRevealAll: () => void;
  onOpenAnother: () => void;
  onBackToCollection: () => void;
  onToggleSound: () => void;
  playSound: (sound: PackSound) => void;
}) {
  const complete = session.revealed.every(Boolean);
  const state: PackOpeningState = opening
    ? "opening"
    : !session.packOpen
      ? holdProgress > 0
        ? "holding"
        : "idle"
      : complete
        ? "complete"
        : turningCardIndex != null || autoRevealing
          ? "revealing"
          : "rewards-ready";
  const animation = OPENING_ANIMATION_REGISTRY[session.animationType];

  return (
    <section
      className={`sponge-pack-focus ${animation.className}`}
      data-state={state}
      data-animation={session.animationType}
    >
      <PackParticleField dense={state !== "idle"} />
      <div className="sponge-pack-focus-glow" aria-hidden />

      <header className="sponge-pack-focus-header">
        <div>
          <p>{session.productName}</p>
          <h2>Pack Opening</h2>
        </div>
        <div className="sponge-pack-focus-tools">
          <button
            type="button"
            className="sponge-sound-toggle"
            aria-pressed={soundEnabled}
            onClick={onToggleSound}
          >
            Sound {soundEnabled ? "On" : "Off"}
          </button>
          <span className="sponge-focus-count">
            {session.revealed.filter(Boolean).length}/{session.pulls.length}
          </span>
        </div>
      </header>

      {!session.packOpen ? (
        <div className="sponge-pack-focus-intro">
          <PackDisplay
            theme={theme}
            cardCount={session.pulls.length}
            state={state}
            holdProgress={holdProgress}
            animationType={session.animationType}
          />
          <div className="sponge-pack-focus-controls">
            <p>{opening ? "Seal is breaking" : animation.cue}</p>
            <HoldToOpen
              disabled={opening}
              opening={opening}
              onComplete={onBeginOpening}
              onProgressChange={onHoldProgress}
              playSound={playSound}
            />
            <CollectionProgressStrip
              before={session.collectionBefore}
              after={session.collectionAfter}
              total={session.collectionTotal}
            />
          </div>
        </div>
      ) : (
        <RewardStage
          session={session}
          turningCardIndex={turningCardIndex}
          autoRevealing={autoRevealing}
          canOpenAnother={canOpenAnother}
          onReveal={onReveal}
          onRevealNext={onRevealNext}
          onRevealAll={onRevealAll}
          onOpenAnother={onOpenAnother}
          onBackToCollection={onBackToCollection}
        />
      )}
    </section>
  );
}

export function SpongeCardGame({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<StoredCardGame>(() => createDefaultGame());
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<GameView>("lobby");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>("spongebob");
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [openingSession, setOpeningSession] = useState<OpeningSession | null>(
    null,
  );
  const [packRipActive, setPackRipActive] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [turningCardIndex, setTurningCardIndex] = useState<number | null>(null);
  const [autoRevealing, setAutoRevealing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notice, setNotice] = useState("Vault ready.");
  const packRipTimerRef = useRef<number | null>(null);
  const cardTurnTimerRef = useRef<number | null>(null);
  const revealAllTimerRefs = useRef<number[]>([]);
  const completedSessionRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sceneRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGame(readStoredGame());
      const storedSound = window.localStorage.getItem(SOUND_PREF_KEY);
      if (storedSound != null) setSoundEnabled(storedSound === "on");
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (packRipTimerRef.current != null) {
        window.clearTimeout(packRipTimerRef.current);
      }
      if (cardTurnTimerRef.current != null) {
        window.clearTimeout(cardTurnTimerRef.current);
      }
      for (const timer of revealAllTimerRefs.current) {
        window.clearTimeout(timer);
      }
      closePackAudioContext(audioContextRef);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CARD_GAME_STORAGE_KEY, JSON.stringify(game));
  }, [game, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SOUND_PREF_KEY, soundEnabled ? "on" : "off");
  }, [hydrated, soundEnabled]);

  useEffect(() => {
    function syncStoredGame() {
      setGame(readStoredGame());
    }

    window.addEventListener("storage", syncStoredGame);
    window.addEventListener(CARD_GAME_PROGRESS_EVENT, syncStoredGame);
    return () => {
      window.removeEventListener("storage", syncStoredGame);
      window.removeEventListener(CARD_GAME_PROGRESS_EVENT, syncStoredGame);
    };
  }, []);

  function playSound(sound: PackSound) {
    playPackSound(sound, soundEnabled, audioContextRef);
  }

  function clearRevealAllTimers() {
    for (const timer of revealAllTimerRefs.current) {
      window.clearTimeout(timer);
    }
    revealAllTimerRefs.current = [];
    setAutoRevealing(false);
  }

  const selectedThemeMeta = CARD_THEMES[selectedTheme];
  const selectedThemeCards = useMemo(
    () => CARDS_BY_THEME[selectedTheme],
    [selectedTheme],
  );

  const selectedPacks = useMemo(
    () => PACK_PRODUCTS.filter((product) => product.themeId === selectedTheme),
    [selectedTheme],
  );

  const ownedCards = useMemo(
    () => selectedThemeCards.filter((card) => (game.cards[card.id] ?? 0) > 0),
    [game.cards, selectedThemeCards],
  );

  const uniqueOwned = ownedCards.length;

  const duplicateEntries = useMemo<DuplicateEntry[]>(
    () =>
      selectedThemeCards
        .map((card) => {
          const duplicateCount = Math.max(0, (game.cards[card.id] ?? 0) - 1);
          return {
            card,
            duplicateCount,
            value: duplicateCount * RARITY_META[card.rarity].sellValue,
          };
        })
        .filter((entry) => entry.duplicateCount > 0)
        .sort(
          (a, b) =>
            RARITY_ORDER.indexOf(b.card.rarity) -
              RARITY_ORDER.indexOf(a.card.rarity) ||
            b.duplicateCount - a.duplicateCount ||
            a.card.name.localeCompare(b.card.name),
        ),
    [game.cards, selectedThemeCards],
  );

  const duplicateCount = duplicateEntries.reduce(
    (sum, entry) => sum + entry.duplicateCount,
    0,
  );
  const duplicateValue = duplicateEntries.reduce(
    (sum, entry) => sum + entry.value,
    0,
  );
  const collectionProgress = Math.round(
    (uniqueOwned / Math.max(1, selectedThemeCards.length)) * 100,
  );
  const rarityProgress = useMemo(
    () =>
      RARITY_ORDER.map((rarity) => {
        const cards = selectedThemeCards.filter((card) => card.rarity === rarity);
        const owned = cards.filter((card) => (game.cards[card.id] ?? 0) > 0);
        return {
          rarity,
          total: cards.length,
          owned: owned.length,
        };
      }),
    [game.cards, selectedThemeCards],
  );

  const visibleCollectionCards = useMemo(
    () =>
      [...selectedThemeCards]
        .sort(
          (a, b) =>
            RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
            a.name.localeCompare(b.name),
        )
        .filter((card) => filter === "all" || card.rarity === filter),
    [filter, selectedThemeCards],
  );

  const freeReadyAt =
    (game.lastFreePackAtByTheme[selectedTheme] ?? 0) + FREE_COOLDOWN_MS;
  const hasClaimedFreePack = Boolean(game.lastFreePackAtByTheme[selectedTheme]);
  const freeReadyMs = hasClaimedFreePack ? freeReadyAt - now : 0;
  const freeReady = !hasClaimedFreePack || freeReadyMs <= 0;
  const starterPack = selectedPacks[0];

  function openPack(product: PackProduct, source: PackSource) {
    if (openingSession && view === "opening" && !openingSession.revealed.every(Boolean)) {
      setNotice("Finish the current pack first.");
      return;
    }
    if (!hydrated) {
      setNotice("Vault loading.");
      return;
    }
    if (source === "free" && !freeReady) {
      setNotice(`Free pack resets in ${formatCountdown(freeReadyMs)}.`);
      return;
    }
    if (source === "points" && game.points < product.cost) {
      setNotice(`${product.cost - game.points} more points needed.`);
      return;
    }

    clearRevealAllTimers();
    const openedAt = Date.now();
    const productThemeCards = CARDS_BY_THEME[product.themeId];
    const collectionBefore = countOwnedCards(game.cards, product.themeId);
    const rolledCards = rollPack(product);
    const nextCards = { ...game.cards };
    const pulls = rolledCards.map((card) => {
      const currentCount = nextCards[card.id] ?? 0;
      const copy = currentCount + 1;
      nextCards[card.id] = copy;
      return {
        card,
        isNew: currentCount === 0,
        copy,
        duplicateValue:
          currentCount === 0 ? 0 : RARITY_META[card.rarity].sellValue,
      };
    });
    const collectionAfter = countOwnedCards(nextCards, product.themeId);

    setGame((current) => ({
      ...current,
      cards: nextCards,
      points:
        source === "points"
          ? Math.max(0, current.points - product.cost)
          : current.points,
      packsOpened: current.packsOpened + 1,
      lastFreePackAtByTheme:
        source === "free"
          ? {
              ...current.lastFreePackAtByTheme,
              [product.themeId]: openedAt,
            }
          : current.lastFreePackAtByTheme,
    }));

    if (packRipTimerRef.current != null) {
      window.clearTimeout(packRipTimerRef.current);
      packRipTimerRef.current = null;
    }
    if (cardTurnTimerRef.current != null) {
      window.clearTimeout(cardTurnTimerRef.current);
      cardTurnTimerRef.current = null;
    }
    setOpeningSession({
      id: `${product.id}-${openedAt}`,
      productId: product.id,
      productName: product.name,
      themeId: product.themeId,
      source,
      animationType: pickOpeningAnimationType(),
      pulls,
      revealed: pulls.map(() => false),
      packOpen: false,
      collectionBefore,
      collectionAfter,
      collectionTotal: productThemeCards.length,
      createdAt: Date.now(),
    });
    setPackRipActive(false);
    setHoldProgress(0);
    setTurningCardIndex(null);
    completedSessionRef.current = null;
    setNotice(
      pulls.some((pull) => pull.isNew)
        ? "New card secured."
        : "Duplicate stack increased.",
    );
    setView("opening");
  }

  function revealCard(index: number) {
    if (turningCardIndex !== null || autoRevealing) return;
    if (
      !openingSession ||
      !openingSession.packOpen ||
      openingSession.revealed[index]
    ) {
      return;
    }

    const revealedPull = openingSession.pulls[index];
    setTurningCardIndex(index);
    setNotice(REVEAL_NOTICE_BY_RARITY[revealedPull.card.rarity]);
    playSound(REVEAL_SOUND_BY_RARITY[revealedPull.card.rarity]);
    triggerHaptic(REVEAL_HAPTIC_BY_RARITY[revealedPull.card.rarity]);
    if (cardTurnTimerRef.current != null) {
      window.clearTimeout(cardTurnTimerRef.current);
    }
    cardTurnTimerRef.current = window.setTimeout(() => {
      setOpeningSession((current) => {
        if (!current || current.revealed[index]) return current;
        const revealed = [...current.revealed];
        revealed[index] = true;
        return { ...current, revealed };
      });
      setTurningCardIndex(null);
      cardTurnTimerRef.current = null;
      if (revealedPull.isNew) playSound("new");
      setNotice(`${revealedPull.card.name} locked in.`);
    }, RARITY_REVEAL_MS[revealedPull.card.rarity]);
  }

  function revealNextCard() {
    if (!openingSession || !openingSession.packOpen) return;
    const nextIndex = openingSession.revealed.findIndex((revealed) => !revealed);
    if (nextIndex >= 0) revealCard(nextIndex);
  }

  function revealAllCards() {
    if (
      !openingSession ||
      !openingSession.packOpen ||
      turningCardIndex !== null ||
      autoRevealing
    ) {
      return;
    }

    const indexes = openingSession.revealed
      .map((revealed, index) => (revealed ? -1 : index))
      .filter((index) => index >= 0);
    if (indexes.length === 0) return;

    clearRevealAllTimers();
    setAutoRevealing(true);
    setNotice("Reef shelf opening.");

    let startDelay = 0;

    indexes.forEach((index, order) => {
      const pull = openingSession.pulls[index];
      const revealMs = REVEAL_ALL_MS[pull.card.rarity];
      const startTimer = window.setTimeout(() => {
        setTurningCardIndex(index);
        setNotice(REVEAL_NOTICE_BY_RARITY[pull.card.rarity]);
        playSound(REVEAL_SOUND_BY_RARITY[pull.card.rarity]);
        triggerHaptic(REVEAL_ALL_HAPTIC_BY_RARITY[pull.card.rarity]);

        const finishTimer = window.setTimeout(() => {
          setOpeningSession((current) => {
            if (!current || current.id !== openingSession.id) return current;
            const revealed = [...current.revealed];
            revealed[index] = true;
            return { ...current, revealed };
          });
          setTurningCardIndex(null);
          if (pull.isNew) playSound("new");

          if (order === indexes.length - 1) {
            setAutoRevealing(false);
            revealAllTimerRefs.current = [];
            setNotice("Pack complete.");
          }
        }, revealMs);
        revealAllTimerRefs.current.push(finishTimer);
      }, startDelay);
      revealAllTimerRefs.current.push(startTimer);
      startDelay += revealMs + 180;
    });
  }

  function crackPack() {
    if (!openingSession || openingSession.packOpen || packRipActive) return;

    setPackRipActive(true);
    setHoldProgress(1);
    playSound("open");
    setNotice("Pack seal tearing.");
    if (packRipTimerRef.current != null) {
      window.clearTimeout(packRipTimerRef.current);
    }
    packRipTimerRef.current = window.setTimeout(() => {
      setOpeningSession((current) =>
        current ? { ...current, packOpen: true } : current,
      );
      setPackRipActive(false);
      setHoldProgress(0);
      packRipTimerRef.current = null;
      triggerHaptic([14, 28, 14]);
      setNotice("Deck released.");
    }, PACK_OPENING_SEQUENCE_MS);
  }

  function tradeDuplicate(cardId: string, amount: number) {
    const card = CARDS_BY_ID.get(cardId);
    if (!card) return;
    const available = Math.max(0, (game.cards[cardId] ?? 0) - 1);
    const tradeAmount = Math.min(amount, available);
    if (tradeAmount <= 0) {
      setNotice("No duplicates for that card.");
      return;
    }

    const gained = tradeAmount * RARITY_META[card.rarity].sellValue;
    setGame((current) => ({
      ...current,
      points: current.points + gained,
      dupesSold: current.dupesSold + tradeAmount,
      cards: {
        ...current.cards,
        [cardId]: Math.max(1, (current.cards[cardId] ?? 1) - tradeAmount),
      },
    }));
    setNotice(`Traded ${tradeAmount} duplicate${tradeAmount > 1 ? "s" : ""}.`);
  }

  function tradeAllDuplicates() {
    if (duplicateCount <= 0) {
      setNotice("Duplicate vault is empty.");
      return;
    }

    setGame((current) => {
      const cards = { ...current.cards };
      for (const card of selectedThemeCards) {
        if ((cards[card.id] ?? 0) > 1) cards[card.id] = 1;
      }
      return {
        ...current,
        points: current.points + duplicateValue,
        dupesSold: current.dupesSold + duplicateCount,
        cards,
      };
    });
    setNotice(`Traded ${duplicateCount} duplicates for ${duplicateValue} points.`);
  }

  function backToCollection() {
    clearRevealAllTimers();
    if (packRipTimerRef.current != null) {
      window.clearTimeout(packRipTimerRef.current);
      packRipTimerRef.current = null;
    }
    if (cardTurnTimerRef.current != null) {
      window.clearTimeout(cardTurnTimerRef.current);
      cardTurnTimerRef.current = null;
    }
    setPackRipActive(false);
    setHoldProgress(0);
    setTurningCardIndex(null);
    setOpeningSession(null);
    setView("collections");
  }

  function openAnotherPack() {
    if (!openingSession) return;
    const product = PACK_PRODUCTS.find(
      (candidate) => candidate.id === openingSession.productId,
    );
    if (!product) {
      setNotice("Pack shelf missing.");
      setView("store");
      return;
    }
    if (game.points < product.cost) {
      setNotice(`${product.cost - game.points} more points needed.`);
      setView("store");
      return;
    }
    openPack(product, "points");
  }

  const openingComplete =
    openingSession != null && openingSession.revealed.every(Boolean);
  const openingFocusActive = view === "opening" && openingSession != null;
  const openingProduct = openingSession
    ? PACK_PRODUCTS.find((product) => product.id === openingSession.productId)
    : undefined;
  const canOpenAnother =
    openingProduct != null && hydrated && game.points >= openingProduct.cost;

  useEffect(() => {
    if (!openingFocusActive) return;
    const frame = window.requestAnimationFrame(() => {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.scrollTop = 0;
      scene.scrollLeft = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openingFocusActive, openingSession?.id]);

  useEffect(() => {
    if (!openingComplete || !openingSession) return;
    if (completedSessionRef.current === openingSession.id) return;
    completedSessionRef.current = openingSession.id;
    playPackSound("complete", soundEnabled, audioContextRef);
    triggerHaptic([14, 22, 14, 34]);
    setNotice("Pack complete.");
  }, [openingComplete, openingSession, soundEnabled]);

  return (
    <section
      ref={sceneRef}
      className={`sponge-card-game-scene fixed inset-0 z-[90] overflow-y-auto text-white ${
        openingFocusActive ? "is-opening-focus" : ""
      }`}
    >
      <BubbleField />

      <div className="sponge-vault-shell relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6">
        {!openingFocusActive && (
          <header className="sponge-vault-header">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.34em] text-cyan-100/70">
                hidden reef passage
              </p>
              <h1 className="sponge-vault-title mt-1 text-4xl font-black leading-none text-white sm:text-6xl">
                Krusty Vault
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <div className="sponge-points-card">
                <p className="text-2xl font-black text-white">{game.points}</p>
                <p className="text-[9px] font-black uppercase tracking-widest text-yellow-200">
                  Points
                </p>
              </div>
              <button
                type="button"
                onClick={onExit}
                className="sponge-vault-back-button"
              >
                Back
              </button>
            </div>
          </header>
        )}

        {!openingFocusActive && (
          <div className="sponge-vault-toolbar mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {THEME_ORDER.map((themeId) => {
                const theme = CARD_THEMES[themeId];
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSelectedTheme(theme.id)}
                    className={`sponge-theme-pill ${
                      selectedTheme === theme.id ? "is-active" : ""
                    }`}
                  >
                    {theme.name}
                  </button>
                );
              })}
              <button
                type="button"
                disabled
                className="sponge-theme-pill is-disabled"
              >
                Next Theme
              </button>
            </div>

            <nav className="sponge-card-tabs" aria-label="Card vault sections">
              {(
                [
                  ["lobby", "Lobby"],
                  ["store", "Store"],
                  ["inventory", "Inventory"],
                  ["collections", "Collections"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  className={view === key ? "is-active" : ""}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        )}

        <main className="mt-4 flex-1">
          {view === "lobby" && (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="sponge-lobby-hero">
                <div className="relative z-10 max-w-xl">
                  <p className="text-xs font-black uppercase tracking-[0.34em] text-yellow-200/70">
                    {selectedThemeMeta.packName}
                  </p>
                  <h2 className="mt-2 text-4xl font-black leading-none text-white sm:text-6xl">
                    Vault Lobby
                  </h2>
                  <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Owned", `${uniqueOwned}/${selectedThemeCards.length}`],
                      ["Dupes", duplicateCount],
                      ["Packs", game.packsOpened],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="sponge-lobby-stat"
                      >
                        <p className="text-2xl font-black text-yellow-200">
                          {value}
                        </p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/55">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="sponge-progress-block mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/58">
                        Collection scan
                      </p>
                      <p className="text-sm font-black text-yellow-200">
                        {collectionProgress}%
                      </p>
                    </div>
                    <div
                      className="sponge-progress-rail mt-2"
                      style={
                        {
                          "--sponge-progress": `${collectionProgress}%`,
                        } as CSSProperties
                      }
                    >
                      <span />
                    </div>
                  </div>
                </div>
                <div className="sponge-lobby-pack" aria-hidden>
                  <SpongePackIcon theme={selectedThemeMeta} />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {(
                  [
                    ["store", "Store", "Pack Counter", "Reef Shelf"],
                    ["inventory", "Inventory", "Dupe Vault", "Trade Locker"],
                    ["collections", "Collections", "Card Binder", "Mystery Wall"],
                  ] as const
                ).map(([targetView, title, eyebrow, stat]) => (
                  <button
                    key={targetView}
                    type="button"
                    onClick={() => setView(targetView)}
                    className="sponge-lobby-tile"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/55">
                      {eyebrow}
                    </span>
                    <span className="mt-1 text-2xl font-black text-white">
                      {title}
                    </span>
                    <span className="mt-2 text-xs font-bold uppercase tracking-widest text-yellow-100/65">
                      {stat}
                    </span>
                  </button>
                ))}
              </section>
            </div>
          )}

          {view === "store" && (
            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
              <section className="sponge-panel flex flex-col justify-between overflow-hidden">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-100/55">
                    Store
                  </p>
                  <h2 className="mt-1 text-3xl font-black text-white">
                    Pack Counter
                  </h2>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-yellow-100/60">
                    Reef Shelf
                  </p>
                </div>
                <div className="my-6">
                  <SpongePackIcon theme={selectedThemeMeta} />
                </div>
                {starterPack && (
                  <button
                    type="button"
                    disabled={!hydrated || !freeReady}
                    onClick={() => openPack(starterPack, "free")}
                    className="sponge-primary-action"
                  >
                    {!hydrated
                      ? "Loading"
                      : freeReady
                        ? "Claim Free Pack"
                        : `Free In ${formatCountdown(freeReadyMs)}`}
                  </button>
                )}
              </section>

              <section className="sponge-store-grid">
                {selectedPacks.map((product) => (
                  <article
                    key={product.id}
                    className={`sponge-store-pack ${product.featured ? "is-featured" : ""}`}
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/55">
                        {product.tier}
                      </p>
                      <h3 className="mt-2 text-2xl font-black leading-tight text-white">
                        {product.name}
                      </h3>
                      <p className="mt-2 text-xs font-black uppercase tracking-widest text-yellow-100/70">
                        {product.size} cards
                      </p>
                    </div>
                    <div className="sponge-odds-card my-5 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/45">
                        Odds
                      </p>
                      <p className="mt-1 text-xs font-black uppercase tracking-wider text-white">
                        {oddsLabel(product)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!hydrated || game.points < product.cost}
                      onClick={() => openPack(product, "points")}
                      className="sponge-secondary-action mt-auto"
                    >
                      Buy For {product.cost}
                    </button>
                  </article>
                ))}
              </section>
            </div>
          )}

          {view === "opening" && (
            <section className="sponge-opening-stage">
              {openingSession ? (
                <PackOpeningFocus
                  session={openingSession}
                  theme={CARD_THEMES[openingSession.themeId]}
                  opening={packRipActive}
                  holdProgress={holdProgress}
                  turningCardIndex={turningCardIndex}
                  autoRevealing={autoRevealing}
                  soundEnabled={soundEnabled}
                  canOpenAnother={canOpenAnother}
                  onHoldProgress={setHoldProgress}
                  onBeginOpening={crackPack}
                  onReveal={revealCard}
                  onRevealNext={revealNextCard}
                  onRevealAll={revealAllCards}
                  onOpenAnother={openAnotherPack}
                  onBackToCollection={backToCollection}
                  onToggleSound={() => setSoundEnabled((enabled) => !enabled)}
                  playSound={playSound}
                />
              ) : (
                <div className="grid min-h-[28rem] place-items-center text-center">
                  <div>
                    <h2 className="text-3xl font-black text-white">
                      No Active Pack
                    </h2>
                    <button
                      type="button"
                      onClick={() => setView("store")}
                      className="sponge-primary-action mt-4"
                    >
                      Store
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {view === "inventory" && (
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="sponge-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-100/55">
                      Inventory
                    </p>
                    <h2 className="mt-1 text-3xl font-black text-white">
                      Duplicate Vault
                    </h2>
                    <p className="mt-2 text-sm font-bold text-white/60">
                      {duplicateCount} duplicates / {duplicateValue} points
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={duplicateCount <= 0}
                    onClick={tradeAllDuplicates}
                    className="sponge-success-action"
                  >
                    Trade All
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  {duplicateEntries.length > 0 ? (
                    duplicateEntries.map((entry) => (
                      <article key={entry.card.id} className="sponge-dupe-row">
                        <div className="w-20 shrink-0">
                          <CollectibleCardView
                            card={entry.card}
                            count={entry.duplicateCount + 1}
                            compact
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-white">
                            {entry.card.name}
                          </p>
                          <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                            x{entry.duplicateCount} duplicates / {entry.value} points
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => tradeDuplicate(entry.card.id, 1)}
                              className="sponge-mini-action"
                            >
                              Trade One
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                tradeDuplicate(entry.card.id, entry.duplicateCount)
                              }
                              className="sponge-mini-action is-bright"
                            >
                              Trade Stack
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="sponge-empty-state">
                      <p className="text-lg font-black text-white">
                        Duplicate vault empty
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <section className="sponge-panel">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-100/55">
                      Inventory
                    </p>
                    <h2 className="mt-1 text-3xl font-black text-white">
                      Owned Cards
                    </h2>
                  </div>
                  <p className="text-xl font-black text-yellow-200">
                    {ownedCards.length}
                  </p>
                </div>
                <div className="sponge-owned-grid mt-4">
                  {ownedCards.length > 0 ? (
                    ownedCards.map((card) => (
                      <CollectibleCardView
                        key={card.id}
                        card={card}
                        count={game.cards[card.id]}
                        compact
                      />
                    ))
                  ) : (
                    <div className="sponge-empty-state col-span-full">
                      <p className="text-lg font-black text-white">
                        Inventory empty
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {view === "collections" && (
            <section className="sponge-panel">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-100/55">
                    Collections
                  </p>
                  <h2 className="mt-1 text-3xl font-black text-white">
                    {selectedThemeMeta.name}
                  </h2>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-yellow-200">
                    {uniqueOwned}/{selectedThemeCards.length}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/45">
                    Found
                  </p>
                </div>
              </div>

              <div className="sponge-collection-summary mt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/55">
                    Binder progress
                  </p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {collectionProgress}% collected
                  </p>
                </div>
                <div className="sponge-rarity-breakdown">
                  {rarityProgress.map((entry) => (
                    <span key={entry.rarity} data-rarity={entry.rarity}>
                      {RARITY_META[entry.rarity].label} {entry.owned}/{entry.total}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {(["all", ...RARITY_ORDER] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`sponge-filter-pill ${
                      filter === key ? "is-active" : ""
                    }`}
                  >
                    {key === "all" ? "All" : RARITY_META[key].label}
                  </button>
                ))}
              </div>

              <div className="sponge-collection-grid mt-4">
                {visibleCollectionCards.map((card) => {
                  const count = game.cards[card.id] ?? 0;
                  return (
                    <CollectibleCardView
                      key={card.id}
                      card={card}
                      count={count}
                      locked={count === 0}
                      compact
                    />
                  );
                })}
              </div>
            </section>
          )}
        </main>

        <p className="py-7 text-center text-[10px] font-black uppercase tracking-widest text-white/45">
          {notice}
        </p>
      </div>
    </section>
  );
}
