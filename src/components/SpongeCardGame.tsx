"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import {
  CARD_GAME_PROGRESS_EVENT,
  CARD_GAME_STARTING_POINTS,
  CARD_GAME_STORAGE_KEY,
} from "@/lib/card-game-rewards";

type ThemeId = "spongebob";
type Rarity = "common" | "rare" | "epic";
type GameView = "lobby" | "store" | "opening" | "inventory" | "collections";
type PackSource = "free" | "points";

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
  productName: string;
  themeId: ThemeId;
  source: PackSource;
  pulls: Pull[];
  revealed: boolean[];
  packOpen: boolean;
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
const PACK_RIP_ANIMATION_MS = 3200;
const CARD_TURN_ANIMATION_MS = 1280;
const PACK_RIP_DRAG_THRESHOLD = 310;
const PACK_RIP_RELEASE_PROGRESS = 0.88;
const PACK_RIP_HAPTIC_MARKS = [0.16, 0.38, 0.64, 0.86];

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

const RARITY_ORDER: Rarity[] = ["common", "rare", "epic"];

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
    odds: { common: 73, rare: 22, epic: 5 },
    featured: true,
  },
  {
    id: "deep-current",
    themeId: "spongebob",
    name: "Deep Current Pack",
    tier: "Premium",
    cost: 420,
    size: 5,
    odds: { common: 48, rare: 38, epic: 14 },
  },
  {
    id: "neptune-vault",
    themeId: "spongebob",
    name: "Neptune Vault Pack",
    tier: "Elite",
    cost: 850,
    size: 7,
    odds: { common: 30, rare: 45, epic: 25 },
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

const RARITY_SCORE_BASE: Record<Rarity, number> = {
  common: 12,
  rare: 72,
  epic: 150,
};

const RARITY_TITLES: Record<Rarity, string[]> = {
  common: ["Reef Regular", "Shift Pull", "Daily Catch", "Dock Card"],
  rare: ["Vault Pull", "Deep Current", "Collector Cut", "Prize Catch"],
  epic: ["Headliner", "Neptune Cut", "Deep-Sea Crown", "Vault Star"],
};

function slugFromFile(file: string) {
  return file.replace(/\.[^.]+$/, "");
}

function formatCardName(slug: string) {
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
  const name = formatCardName(slug);
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
    artImage: `/cards/${theme.id}/${rarity}/${file}`,
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

function oddsLabel(product: PackProduct) {
  return RARITY_ORDER.map(
    (rarity) => `${RARITY_META[rarity].shortLabel} ${product.odds[rarity]}%`,
  ).join(" / ");
}

function CardBack({
  theme,
  compact = false,
}: {
  theme: CardTheme;
  compact?: boolean;
}) {
  return (
    <div
      className={`sponge-card-back-face absolute inset-0 grid place-items-center overflow-hidden rounded-[inherit] bg-gradient-to-br ${theme.gradient}`}
    >
      <span className="sponge-card-back-grid" />
      <span className="sponge-card-back-orbit" />
      <span
        className={`relative grid place-items-center rounded-2xl border border-yellow-200/70 bg-black/30 font-black uppercase tracking-[0.22em] text-yellow-200 shadow-[0_0_2rem_rgba(250,204,21,0.28)] ${
          compact ? "h-16 w-12 text-[8px]" : "h-24 w-20 text-[10px]"
        }`}
      >
        {theme.shortName}
      </span>
    </div>
  );
}

function CardArtwork({
  card,
  locked = false,
  compact = false,
}: {
  card: CollectibleCard;
  locked?: boolean;
  compact?: boolean;
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
      <div className="absolute inset-x-2 bottom-1 top-1">
        <Image
          src={card.artImage}
          alt=""
          fill
          sizes={
            compact
              ? "(max-width: 640px) 30vw, 170px"
              : "(max-width: 640px) 70vw, 260px"
          }
          className="object-contain drop-shadow-[0_0.9rem_0.9rem_rgba(2,8,23,0.58)]"
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
  const meta = RARITY_META[card.rarity];
  const displayName = locked ? "Undiscovered" : card.name;
  const displayTitle = locked ? "Vault Locked" : card.title;

  return (
    <div
      className={`relative aspect-[3/4] w-full rounded-2xl bg-gradient-to-br p-[3px] shadow-xl ring-1 ${meta.frame} ${meta.ring} ${
        large ? "max-w-[18rem]" : ""
      }`}
    >
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[13px] bg-[#fffaf0]">
        <div className="flex min-h-9 items-center justify-between gap-1 px-2 pt-1.5">
          <span
            className={`min-w-0 truncate font-black leading-tight ${meta.text} ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            {displayName}
          </span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-[1px] text-[7px] font-black uppercase ${meta.chip}`}
          >
            {meta.label}
          </span>
        </div>
        <div className="relative mx-1.5 mt-1 flex-1 overflow-hidden rounded-lg border-2 border-[#f2e3bd] bg-sky-200">
          <CardArtwork card={card} locked={locked} compact={compact} />
          {locked && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/30 text-2xl font-black text-white/80">
              ?
            </div>
          )}
        </div>
        {!compact && (
          <p className="line-clamp-1 px-2 pt-1 text-[9px] font-bold text-slate-500">
            {displayTitle}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 px-2 pb-1.5 pt-1 text-[8px] font-black text-slate-700">
          <span className="rounded bg-orange-100 px-1 py-[1px] text-orange-700">
            {locked ? "P ?" : `P ${card.power}`}
          </span>
          <span className="rounded bg-pink-100 px-1 py-[1px] text-pink-700">
            {locked ? "J ?" : `J ${card.jelly}`}
          </span>
        </div>
        {typeof count === "number" && count > 1 && !locked && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-slate-950 px-1 text-[10px] font-black text-white">
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

function PackRipStage({
  theme,
  cardCount,
  ripping,
  onRip,
}: {
  theme: CardTheme;
  cardCount: number;
  ripping: boolean;
  onRip: () => void;
}) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragProgress, setDragProgress] = useState(0);
  const dragProgressRef = useRef(0);
  const hapticMarkRef = useRef(0);
  const dragging = dragStart !== null && !ripping;
  const packArt = PACK_ART_BY_THEME[theme.id];

  function resetDrag() {
    setDragStart(null);
    setDragProgress(0);
    dragProgressRef.current = 0;
    hapticMarkRef.current = 0;
  }

  function releasePack() {
    if (ripping) return;
    setDragProgress(1);
    dragProgressRef.current = 1;
    setDragStart(null);
    hapticMarkRef.current = PACK_RIP_HAPTIC_MARKS.length;
    triggerHaptic([10, 18, 10, 28, 16, 42, 24, 74]);
    onRip();
  }

  function updateDragProgress(clientX: number, clientY: number) {
    if (!dragStart || ripping) return;
    const pullX = Math.max(0, clientX - dragStart.x);
    const pullLift = Math.max(0, dragStart.y - clientY) * 0.42;
    const nextProgress = Math.min(
      1,
      (pullX + pullLift) / PACK_RIP_DRAG_THRESHOLD,
    );
    dragProgressRef.current = nextProgress;
    setDragProgress(nextProgress);

    while (
      hapticMarkRef.current < PACK_RIP_HAPTIC_MARKS.length &&
      nextProgress >= PACK_RIP_HAPTIC_MARKS[hapticMarkRef.current]
    ) {
      hapticMarkRef.current += 1;
      triggerHaptic(hapticMarkRef.current === 4 ? 34 : 14);
    }
  }

  const packStyle = {
    "--pack-rip-progress": dragProgress,
    "--pack-rip-tab-x": `${dragProgress * 8.4}rem`,
    "--pack-rip-tab-y": `${dragProgress * -1.1}rem`,
    "--pack-rip-model-transform": `rotateX(${9 + dragProgress * 8}deg) rotateY(${-18 + dragProgress * 10}deg) rotateZ(${-3 + dragProgress * 4}deg) translate3d(${dragProgress * 0.28}rem, ${dragProgress * -0.6}rem, ${2.8 + dragProgress * 2.4}rem) scale(${1 + dragProgress * 0.035})`,
    "--pack-rip-sleeve-transform": `translate3d(${-dragProgress * 0.05}rem, ${dragProgress * 0.1}rem, 1.8rem) rotateX(${dragProgress * 2.4}deg) rotateZ(${-dragProgress * 0.9}deg) skewX(${-dragProgress * 0.8}deg)`,
    "--pack-rip-top-crimp-transform": `translate3d(${dragProgress * 0.2}rem, ${dragProgress * -0.42}rem, ${4.2 + dragProgress * 1.1}rem) rotateX(${-dragProgress * 18}deg) rotateY(${dragProgress * 7}deg) rotateZ(${dragProgress * 4}deg)`,
    "--pack-rip-strip-transform": `translate3d(${dragProgress * 7.4}rem, ${dragProgress * -0.85}rem, 7.8rem) rotateZ(${dragProgress * 18}deg) rotateY(${dragProgress * 26}deg) rotateX(${dragProgress * 8}deg)`,
    "--pack-rip-left-flap-transform": `translate3d(${-dragProgress * 1.08}rem, ${dragProgress * -0.82}rem, ${5.6 + dragProgress * 3.2}rem) rotateX(${-dragProgress * 62}deg) rotateY(${-dragProgress * 44}deg) rotateZ(${-dragProgress * 14}deg)`,
    "--pack-rip-right-flap-transform": `translate3d(${dragProgress * 1.22}rem, ${dragProgress * -0.84}rem, ${5.65 + dragProgress * 3.35}rem) rotateX(${-dragProgress * 60}deg) rotateY(${dragProgress * 48}deg) rotateZ(${dragProgress * 15}deg)`,
    "--pack-rip-mouth-scale": 0.78 + dragProgress * 1.62,
    "--pack-rip-mouth-opacity": 0.02 + dragProgress * 0.98,
    "--pack-rip-aura-opacity": 0.22 + dragProgress * 0.7,
    "--pack-rip-aura-scale": 0.88 + dragProgress * 0.26,
    "--pack-rip-thread-opacity": 0.45 + dragProgress * 0.55,
    "--pack-rip-crease-opacity": 0.18 + dragProgress * 0.62,
    "--pack-rip-tear-width": `${Math.max(4, dragProgress * 100)}%`,
    "--pack-rip-open-height": `${0.1 + dragProgress * 1.9}rem`,
    "--pack-rip-open-y": `${dragProgress * 0.45}rem`,
    "--pack-rip-tear-shadow-opacity": 0.1 + dragProgress * 0.82,
    "--pack-rip-fiber-opacity": Math.min(1, dragProgress * 1.4),
    "--pack-rip-meter": `${Math.round(dragProgress * 100)}%`,
  } as CSSProperties;

  return (
    <div
      className={`sponge-pack-rip-stage ${dragging ? "is-dragging" : ""} ${
        ripping ? "is-ripping" : ""
      }`}
      style={packStyle}
    >
      <div className="sponge-pack-rip-light" />
      <div className="sponge-pack-rip-model">
        <div className="sponge-pack-rip-aura" aria-hidden />
        <div className="sponge-pack-showcase-floor" aria-hidden />
        <div className="sponge-pack-inner-stack" aria-hidden>
          {Array.from({ length: Math.min(cardCount, 5) }, (_, index) => (
            <span
              key={index}
              style={
                {
                  "--rip-card": index,
                  "--rip-rest-y": `${index * 0.22}rem`,
                  "--rip-rest-rotate": `${(index - 2) * 3}deg`,
                  "--rip-x": `${(index - 2) * 1.18}rem`,
                  "--rip-y": `${-4.7 - index * 0.48}rem`,
                  "--rip-rotate": `${(index - 2) * 5}deg`,
                  "--rip-delay": `${980 + index * 130}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="sponge-pack-rip-mouth" aria-hidden>
          <span />
        </div>
        <div className="sponge-pack-rip-slit" aria-hidden>
          <span />
          <span />
        </div>
        <div className="sponge-pack-tear-line" aria-hidden>
          <span />
        </div>
        <div className="sponge-pack-sleeve" aria-hidden>
          <span className="sponge-pack-half-gloss" />
          <span className="sponge-pack-foil-grain" />
          <span className="sponge-pack-foil-field" />
          <span className="sponge-pack-art-glow" />
          <span className="sponge-pack-crimp sponge-pack-crimp-bottom" />
          <span className="sponge-pack-cutout sponge-pack-cutout-left" />
          <span className="sponge-pack-cutout sponge-pack-cutout-right" />
          <span className="sponge-pack-side-rail sponge-pack-side-rail-left" />
          <span className="sponge-pack-side-rail sponge-pack-side-rail-right" />
          <span className="sponge-pack-center-seam" />
          <div className="sponge-pack-cover-art">
            <Image
              src={packArt.hero}
              alt=""
              fill
              sizes="(max-width: 640px) 54vw, 230px"
              className="sponge-pack-cover-image object-cover"
            />
            <span className="sponge-pack-cover-art-glass" />
          </div>
          <div className="sponge-pack-lockup">
            <span>{theme.shortName}</span>
            <strong>Reef Rumble</strong>
          </div>
          <span className="sponge-pack-series">Trading card game</span>
          <div className="sponge-pack-card-count">
            <strong>{cardCount}</strong>
            <span>card booster</span>
          </div>
          <div className="sponge-pack-cameos">
            {packArt.cameo.map((src, index) => (
              <span
                key={src}
                className="sponge-pack-cameo"
                style={
                  {
                    "--cameo-rotate": `${(index - 1) * 7}deg`,
                  } as CSSProperties
                }
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </span>
            ))}
          </div>
          <div className="sponge-pack-edition">
            <span>Collector foil</span>
            <span>{theme.packName}</span>
          </div>
        </div>
        <div className="sponge-pack-top-crimp" aria-hidden>
          <span className="sponge-pack-crimp sponge-pack-crimp-top" />
          <span className="sponge-pack-rip-notch" />
          <span className="sponge-pack-rip-thread" />
          <span className="sponge-pack-crimp-label">Tear seal</span>
        </div>
        <div
          className="sponge-pack-tear-flap sponge-pack-tear-flap-left"
          aria-hidden
        >
          <span className="sponge-pack-tear-shadow" />
          <span className="sponge-pack-foil-curl" />
          <span className="sponge-pack-foil-grain" />
        </div>
        <div
          className="sponge-pack-tear-flap sponge-pack-tear-flap-right"
          aria-hidden
        >
          <span className="sponge-pack-tear-shadow" />
          <span className="sponge-pack-foil-curl" />
          <span className="sponge-pack-foil-grain" />
        </div>
        <div className="sponge-pack-rip-strip" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="sponge-pack-top-teeth" aria-hidden>
          {Array.from({ length: 11 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div className="sponge-pack-rip-sparks" aria-hidden>
          {Array.from({ length: 12 }, (_, index) => (
            <span
              key={index}
              style={
                {
                  "--spark-x": `${(index % 6) * 16}%`,
                  "--spark-y": `${(index % 3) * 30}%`,
                  "--spark-delay": `${180 + index * 34}ms`,
                  "--spark-drift-x": `${(index - 5.5) * 0.52}rem`,
                  "--spark-drift-y": `${-2.4 - (index % 4) * 0.42}rem`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <button
          type="button"
          disabled={ripping}
          aria-label="Pull the top seal open"
          className="sponge-pack-pull-tab"
          onPointerDown={(event) => {
            if (ripping) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragStart({ x: event.clientX, y: event.clientY });
            setDragProgress(0.04);
            hapticMarkRef.current = 0;
            triggerHaptic(10);
          }}
          onPointerMove={(event) => updateDragProgress(event.clientX, event.clientY)}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            if (dragProgressRef.current >= PACK_RIP_RELEASE_PROGRESS) {
              releasePack();
            } else {
              triggerHaptic(8);
              resetDrag();
            }
          }}
          onPointerCancel={resetDrag}
          onKeyDown={(event) => {
            if (ripping) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              releasePack();
            }
          }}
        >
          Pull
        </button>
      </div>
      <div className="sponge-pack-theater-controls">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-100/55">
            {ripping ? "Seal breached" : "Top seal armed"}
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {cardCount} cards loaded
          </p>
        </div>
        <div className="sponge-pack-rip-meter" aria-hidden>
          <span />
        </div>
        <button
          type="button"
          disabled={ripping}
          onClick={releasePack}
          className="sponge-pack-rip-button"
        >
          {ripping ? "Ripping" : "Auto Rip"}
        </button>
      </div>
    </div>
  );
}

function StackedRevealDeck({
  session,
  activeIndex,
  turningIndex,
  settledIndex,
  onReveal,
  onAdvance,
}: {
  session: OpeningSession;
  activeIndex: number;
  turningIndex: number | null;
  settledIndex: number | null;
  onReveal: (index: number) => void;
  onAdvance: () => void;
}) {
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const theme = CARD_THEMES[session.themeId];
  const displayIndex = settledIndex ?? activeIndex;
  const displayPull =
    displayIndex >= 0 ? session.pulls[displayIndex] : undefined;
  const remainingStartIndex =
    settledIndex !== null
      ? activeIndex >= 0
        ? activeIndex
        : session.pulls.length
      : displayIndex >= 0
        ? displayIndex + 1
        : session.pulls.length;
  const remainingBacks = session.pulls.slice(
    remainingStartIndex,
    remainingStartIndex + 5,
  );
  const cardIsSettled = settledIndex !== null && settledIndex === displayIndex;
  const cardIsTurning = turningIndex !== null && turningIndex === displayIndex;

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!displayPull || turningIndex !== null) return;
    setStartPoint({ x: event.clientX, y: event.clientY });
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!displayPull || turningIndex !== null) return;
    const moved =
      startPoint != null
        ? Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y)
        : 0;
    if (moved >= 0) {
      if (cardIsSettled) {
        onAdvance();
      } else {
        onReveal(displayIndex);
      }
    }
    setStartPoint(null);
  }

  return (
    <div className="sponge-stack-opening">
      <div className="sponge-stack-spotlight" />
      <div className="sponge-stack-stage">
        <div className="sponge-stack-status">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-100/55">
            {cardIsSettled ? "Revealed" : "Next pull"}
          </p>
          <p className="text-2xl font-black text-white">
            {displayPull ? displayPull.card.rarity : "Complete"}
          </p>
        </div>
        <div className="sponge-card-stack">
          {remainingBacks.map((pull, index) => (
            <div
              key={`${pull.card.id}-${index}`}
              className="sponge-stacked-card-back"
              style={
                {
                  "--stack-opacity": 0.92 - index * 0.1,
                  "--stack-x": `${index * -0.55}rem`,
                  "--stack-y": `${index * 0.52}rem`,
                  "--stack-z": `${index * -1.2}rem`,
                  "--stack-rotation": `${index * -2}deg`,
                  "--stack-scale": 1 - index * 0.035,
                } as CSSProperties
              }
            >
              <CardBack theme={theme} />
            </div>
          ))}
          {displayPull ? (
            <button
              type="button"
              aria-label={
                cardIsSettled
                  ? `Continue after ${displayPull.card.name}`
                  : `Reveal card ${displayIndex + 1}`
              }
              aria-disabled={turningIndex !== null}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => setStartPoint(null)}
              onKeyDown={(event) => {
                if (turningIndex !== null) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (cardIsSettled) {
                    onAdvance();
                  } else {
                    onReveal(displayIndex);
                  }
                }
              }}
              data-rarity={displayPull.card.rarity}
              className={`sponge-card-stack-top ${
                cardIsTurning ? "is-turning" : ""
              } ${cardIsSettled ? "is-revealed" : ""}`}
            >
              <span className="sponge-card-stack-inner">
                <span className="sponge-card-stack-side sponge-card-stack-back">
                  <CardBack theme={theme} />
                </span>
                <span className="sponge-card-stack-side sponge-card-stack-front">
                  <CollectibleCardView card={displayPull.card} large />
                  <span
                    className={`absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase shadow-lg ${
                      displayPull.isNew
                        ? "bg-lime-300 text-lime-950"
                        : "bg-amber-300 text-amber-950"
                    }`}
                  >
                    {displayPull.isNew
                      ? "New"
                      : `Dupe +${displayPull.duplicateValue}`}
                  </span>
                </span>
              </span>
            </button>
          ) : (
            <div className="sponge-card-stack-complete">
              <p>Pack complete</p>
            </div>
          )}
        </div>
      </div>

    </div>
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
  const [turningCardIndex, setTurningCardIndex] = useState<number | null>(null);
  const [focusedRevealIndex, setFocusedRevealIndex] = useState<number | null>(
    null,
  );
  const [notice, setNotice] = useState("Vault ready.");
  const packRipTimerRef = useRef<number | null>(null);
  const cardTurnTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGame(readStoredGame());
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
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CARD_GAME_STORAGE_KEY, JSON.stringify(game));
  }, [game, hydrated]);

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
              [product.themeId]: Date.now(),
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
      id: `${product.id}-${Date.now()}`,
      productName: product.name,
      themeId: product.themeId,
      source,
      pulls,
      revealed: pulls.map(() => false),
      packOpen: false,
      createdAt: Date.now(),
    });
    setPackRipActive(false);
    setTurningCardIndex(null);
    setFocusedRevealIndex(null);
    setNotice(
      pulls.some((pull) => pull.isNew)
        ? "New card secured."
        : "Duplicate stack increased.",
    );
    setView("opening");
  }

  function revealCard(index: number) {
    if (turningCardIndex !== null || focusedRevealIndex !== null) return;
    if (
      !openingSession ||
      !openingSession.packOpen ||
      openingSession.revealed[index]
    ) {
      return;
    }

    const nextRevealIndex = openingSession.revealed.findIndex(
      (revealed) => !revealed,
    );
    if (index !== nextRevealIndex) return;

    const revealedPull = openingSession.pulls[index];
    setTurningCardIndex(index);
    setNotice("Card pressure rising.");
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
      setFocusedRevealIndex(index);
      setTurningCardIndex(null);
      cardTurnTimerRef.current = null;
      setNotice(`${revealedPull.card.name} locked in.`);
    }, CARD_TURN_ANIMATION_MS);
  }

  function advanceRevealedCard() {
    if (turningCardIndex !== null) return;
    setFocusedRevealIndex(null);
  }

  function crackPack() {
    if (!openingSession || openingSession.packOpen || packRipActive) return;

    setPackRipActive(true);
    setNotice("Pack seal tearing.");
    if (packRipTimerRef.current != null) {
      window.clearTimeout(packRipTimerRef.current);
    }
    packRipTimerRef.current = window.setTimeout(() => {
      setOpeningSession((current) =>
        current ? { ...current, packOpen: true } : current,
      );
      setPackRipActive(false);
      packRipTimerRef.current = null;
      setNotice("Deck released.");
    }, PACK_RIP_ANIMATION_MS);
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

  const openingRevealIndex =
    openingSession?.packOpen
      ? (openingSession.revealed.findIndex((revealed) => !revealed) ?? -1)
      : -1;
  const openingComplete =
    openingSession != null && openingSession.revealed.every(Boolean);
  const openingDisplayIndex =
    openingSession?.packOpen ? (focusedRevealIndex ?? openingRevealIndex) : -1;

  return (
    <section className="sponge-card-game-scene fixed inset-0 z-[90] overflow-y-auto text-white">
      <BubbleField />

      <div className="sponge-vault-shell relative z-10 mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6">
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

              <section className="grid gap-3 md:grid-cols-3">
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
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.34em] text-yellow-200/65">
                        {openingSession.productName}
                      </p>
                      <h2 className="mt-1 text-3xl font-black text-white sm:text-5xl">
                        Pack Opening
                      </h2>
                    </div>
                    <div className="sponge-opening-counter">
                      <p className="text-2xl font-black text-yellow-200">
                        {openingSession.revealed.filter(Boolean).length}/
                        {openingSession.pulls.length}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/45">
                        Revealed
                      </p>
                    </div>
                  </div>

                  {!openingSession.packOpen ? (
                    <PackRipStage
                      theme={selectedThemeMeta}
                      cardCount={openingSession.pulls.length}
                      ripping={packRipActive}
                      onRip={crackPack}
                    />
                  ) : (
                    <>
                      <div className="sponge-opening-drama-bar">
                        <span className="sponge-opening-drama-scan" />
                        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-100/55">
                          Card{" "}
                          {openingDisplayIndex >= 0
                            ? openingDisplayIndex + 1
                            : openingSession.pulls.length}
                        </p>
                        <p className="text-sm font-black text-yellow-100">
                          {openingComplete
                            ? "Pack complete"
                            : "Reef lights locked"}
                        </p>
                      </div>

                      <StackedRevealDeck
                        key={openingSession.id}
                        session={openingSession}
                        activeIndex={openingRevealIndex}
                        turningIndex={turningCardIndex}
                        settledIndex={focusedRevealIndex}
                        onReveal={revealCard}
                        onAdvance={advanceRevealedCard}
                      />

                      {openingComplete && (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => setView("inventory")}
                            className="sponge-success-action"
                          >
                            Inventory
                          </button>
                          <button
                            type="button"
                            onClick={() => setView("store")}
                            className="sponge-ghost-action"
                          >
                            Store
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
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
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
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

              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
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
