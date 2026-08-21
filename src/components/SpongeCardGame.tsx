"use client";

import { useEffect, useMemo, useState } from "react";

type Rarity = "common" | "rare" | "epic" | "legendary" | "gold";
type Motif =
  | "snail"
  | "microbe"
  | "clarinet"
  | "puffer"
  | "dome"
  | "claw"
  | "star"
  | "burger"
  | "sponge"
  | "ghost"
  | "house"
  | "jelly"
  | "spatula"
  | "boat"
  | "shell"
  | "crown";

type SpongeCard = {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  quote: string;
  power: number;
  jelly: number;
  motif: Motif;
  bg: string;
  floor: string;
  main: string;
  accent: string;
  glow: string;
};

type StoredCardGame = {
  points: number;
  collection: Record<string, number>;
  packsOpened: number;
  dupesSold: number;
  lastFreePackAt: number | null;
};

type Pull = {
  card: SpongeCard;
  isNew: boolean;
  copy: number;
};

const STORAGE_KEY = "broomer_krusty_card_game";
const PACK_SIZE = 5;
const PACK_COST = 150;
const FREE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const RARITY_ORDER: Rarity[] = [
  "common",
  "rare",
  "epic",
  "legendary",
  "gold",
];

const RARITY_META: Record<
  Rarity,
  {
    label: string;
    weight: number;
    sellValue: number;
    frame: string;
    chip: string;
    text: string;
  }
> = {
  common: {
    label: "Common",
    weight: 58,
    sellValue: 12,
    frame: "from-slate-400 via-stone-100 to-slate-500",
    chip: "bg-slate-200 text-slate-800",
    text: "text-slate-800",
  },
  rare: {
    label: "Rare",
    weight: 27,
    sellValue: 35,
    frame: "from-cyan-300 via-sky-100 to-blue-500",
    chip: "bg-cyan-200 text-cyan-950",
    text: "text-cyan-900",
  },
  epic: {
    label: "Epic",
    weight: 10,
    sellValue: 90,
    frame: "from-fuchsia-400 via-pink-100 to-violet-600",
    chip: "bg-fuchsia-200 text-fuchsia-950",
    text: "text-fuchsia-900",
  },
  legendary: {
    label: "Legendary",
    weight: 4,
    sellValue: 250,
    frame: "from-amber-300 via-yellow-100 to-orange-500",
    chip: "bg-amber-200 text-amber-950",
    text: "text-amber-900",
  },
  gold: {
    label: "Gold Foil",
    weight: 1,
    sellValue: 900,
    frame: "from-yellow-200 via-amber-500 to-yellow-100",
    chip: "bg-yellow-300 text-yellow-950",
    text: "text-yellow-950",
  },
};

const CARDS: SpongeCard[] = [
  {
    id: "gary",
    name: "Gary",
    title: "Snail Scout",
    rarity: "common",
    quote: "Meow from the deep.",
    power: 12,
    jelly: 40,
    motif: "snail",
    bg: "#3fd1d9",
    floor: "#0f766e",
    main: "#e879f9",
    accent: "#86efac",
    glow: "#ecfeff",
  },
  {
    id: "plankton",
    name: "Plankton",
    title: "Tiny Mastermind",
    rarity: "common",
    quote: "One eye on the formula.",
    power: 18,
    jelly: 22,
    motif: "microbe",
    bg: "#115e59",
    floor: "#052e2b",
    main: "#7ddf64",
    accent: "#f3ff7a",
    glow: "#a7f3d0",
  },
  {
    id: "squidward",
    name: "Squidward",
    title: "Clarinet Mood",
    rarity: "common",
    quote: "A bold and brassy day.",
    power: 21,
    jelly: 15,
    motif: "clarinet",
    bg: "#0ea5b7",
    floor: "#0f172a",
    main: "#e0f2fe",
    accent: "#312e81",
    glow: "#cffafe",
  },
  {
    id: "puff",
    name: "Mrs. Puff",
    title: "Boating Legend",
    rarity: "common",
    quote: "Brake before destiny.",
    power: 16,
    jelly: 31,
    motif: "puffer",
    bg: "#38bdf8",
    floor: "#0f766e",
    main: "#f8b4d9",
    accent: "#f97316",
    glow: "#fff7ad",
  },
  {
    id: "sandy",
    name: "Sandy Cheeks",
    title: "Dome Scientist",
    rarity: "rare",
    quote: "Karate under pressure.",
    power: 62,
    jelly: 58,
    motif: "dome",
    bg: "#0891b2",
    floor: "#854d0e",
    main: "#fbbf24",
    accent: "#d97706",
    glow: "#ecfeff",
  },
  {
    id: "krabs",
    name: "Mr. Krabs",
    title: "Claw Cashier",
    rarity: "rare",
    quote: "Coins sing in the tide.",
    power: 55,
    jelly: 71,
    motif: "claw",
    bg: "#0f7ea8",
    floor: "#7f1d1d",
    main: "#ef4444",
    accent: "#facc15",
    glow: "#fff7ad",
  },
  {
    id: "patrick",
    name: "Patrick Star",
    title: "Rock Philosopher",
    rarity: "epic",
    quote: "A brilliant idea waits.",
    power: 84,
    jelly: 88,
    motif: "star",
    bg: "#a855f7",
    floor: "#0e7490",
    main: "#fb7185",
    accent: "#86efac",
    glow: "#fce7f3",
  },
  {
    id: "patty",
    name: "Krabby Patty",
    title: "Secret Stack",
    rarity: "epic",
    quote: "Fresh from the grill.",
    power: 91,
    jelly: 95,
    motif: "burger",
    bg: "#0284c7",
    floor: "#166534",
    main: "#f59e0b",
    accent: "#84cc16",
    glow: "#fef3c7",
  },
  {
    id: "spongebob",
    name: "SpongeBob",
    title: "Ready Recruit",
    rarity: "legendary",
    quote: "The shift begins now.",
    power: 120,
    jelly: 130,
    motif: "sponge",
    bg: "#06b6d4",
    floor: "#0f766e",
    main: "#fde047",
    accent: "#22c55e",
    glow: "#fef9c3",
  },
  {
    id: "dutchman",
    name: "Flying Dutchman",
    title: "Ghost Tide",
    rarity: "legendary",
    quote: "The fog keeps score.",
    power: 133,
    jelly: 104,
    motif: "ghost",
    bg: "#0f172a",
    floor: "#065f46",
    main: "#5eead4",
    accent: "#22c55e",
    glow: "#ccfbf1",
  },
  {
    id: "pineapple-house",
    name: "Pineapple House",
    title: "Porous Home",
    rarity: "common",
    quote: "Lights on in the reef.",
    power: 20,
    jelly: 34,
    motif: "house",
    bg: "#0ea5e9",
    floor: "#166534",
    main: "#f59e0b",
    accent: "#22c55e",
    glow: "#fef3c7",
  },
  {
    id: "jellyfish",
    name: "Jellyfish",
    title: "Field Zapper",
    rarity: "common",
    quote: "A sting with style.",
    power: 26,
    jelly: 48,
    motif: "jelly",
    bg: "#0284c7",
    floor: "#0e7490",
    main: "#f0abfc",
    accent: "#fb7185",
    glow: "#fae8ff",
  },
  {
    id: "spatula",
    name: "Golden Spatula",
    title: "Grill Relic",
    rarity: "rare",
    quote: "Flip fate cleanly.",
    power: 68,
    jelly: 42,
    motif: "spatula",
    bg: "#0891b2",
    floor: "#0f766e",
    main: "#facc15",
    accent: "#94a3b8",
    glow: "#fef9c3",
  },
  {
    id: "boatmobile",
    name: "Boatmobile",
    title: "Road Reef",
    rarity: "rare",
    quote: "Turn before impact.",
    power: 72,
    jelly: 51,
    motif: "boat",
    bg: "#22d3ee",
    floor: "#0f766e",
    main: "#f97316",
    accent: "#1d4ed8",
    glow: "#cffafe",
  },
  {
    id: "magic-conch",
    name: "Magic Conch",
    title: "Shell Oracle",
    rarity: "legendary",
    quote: "The shell has spoken.",
    power: 145,
    jelly: 168,
    motif: "shell",
    bg: "#7c3aed",
    floor: "#0e7490",
    main: "#f9a8d4",
    accent: "#fde68a",
    glow: "#fae8ff",
  },
  {
    id: "gold-sponge",
    name: "SpongeBob",
    title: "24K Ready",
    rarity: "gold",
    quote: "Golden shift unlocked.",
    power: 240,
    jelly: 260,
    motif: "sponge",
    bg: "#b45309",
    floor: "#854d0e",
    main: "#fde047",
    accent: "#f59e0b",
    glow: "#fff7ad",
  },
  {
    id: "gold-crown",
    name: "King Neptune",
    title: "Royal Foil",
    rarity: "gold",
    quote: "By golden decree.",
    power: 280,
    jelly: 315,
    motif: "crown",
    bg: "#92400e",
    floor: "#78350f",
    main: "#fde68a",
    accent: "#22d3ee",
    glow: "#fff7ad",
  },
];

const DEFAULT_GAME: StoredCardGame = {
  points: PACK_COST * 5,
  collection: {},
  packsOpened: 0,
  dupesSold: 0,
  lastFreePackAt: null,
};

function readStoredGame(): StoredCardGame {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GAME;
    const parsed = JSON.parse(raw) as Partial<StoredCardGame>;
    return {
      points: Number.isFinite(parsed.points) ? Number(parsed.points) : DEFAULT_GAME.points,
      collection:
        parsed.collection && typeof parsed.collection === "object"
          ? Object.fromEntries(
              Object.entries(parsed.collection).filter(
                ([cardId, count]) =>
                  CARDS.some((card) => card.id === cardId) &&
                  Number.isFinite(count) &&
                  Number(count) > 0,
              ),
            )
          : {},
      packsOpened: Number.isFinite(parsed.packsOpened)
        ? Number(parsed.packsOpened)
        : 0,
      dupesSold: Number.isFinite(parsed.dupesSold) ? Number(parsed.dupesSold) : 0,
      lastFreePackAt:
        typeof parsed.lastFreePackAt === "number" ? parsed.lastFreePackAt : null,
    };
  } catch {
    return DEFAULT_GAME;
  }
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function pickRarity(minRarityIndex = 0): Rarity {
  const pool = RARITY_ORDER.slice(minRarityIndex);
  const total = pool.reduce((sum, rarity) => sum + RARITY_META[rarity].weight, 0);
  let roll = Math.random() * total;
  for (const rarity of pool) {
    roll -= RARITY_META[rarity].weight;
    if (roll <= 0) return rarity;
  }
  return pool[0];
}

function randomCardOfRarity(rarity: Rarity): SpongeCard {
  const pool = CARDS.filter((card) => card.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}

function rollPack() {
  return Array.from({ length: PACK_SIZE }, (_, index) => {
    const guaranteed = index === PACK_SIZE - 1;
    return randomCardOfRarity(pickRarity(guaranteed ? 1 : 0));
  });
}

function MotifShape({ card }: { card: SpongeCard }) {
  const stroke = "rgba(2,20,35,0.58)";
  const common = {
    stroke,
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (card.motif) {
    case "snail":
      return (
        <g>
          <ellipse cx="99" cy="94" rx="38" ry="31" fill={card.main} {...common} />
          <path d="M99 94c-16-5-21 16-7 23 19 9 40-14 25-33-18-22-55-7-57 26" fill="none" stroke={card.accent} strokeWidth="8" strokeLinecap="round" />
          <path d="M135 93c23-12 42-5 50 13 7 13-2 26-17 26h-49" fill={card.accent} {...common} />
          <path d="M165 84l10-22M181 87l18-18" fill="none" {...common} />
          <circle cx="176" cy="61" r="5" fill={card.glow} />
          <circle cx="201" cy="69" r="5" fill={card.glow} />
        </g>
      );
    case "microbe":
      return (
        <g>
          <ellipse cx="121" cy="93" rx="34" ry="56" fill={card.main} {...common} />
          <circle cx="121" cy="78" r="13" fill={card.glow} stroke={stroke} strokeWidth="4" />
          <circle cx="125" cy="78" r="5" fill={card.accent} />
          <path d="M85 72c-23-18-35-7-29 11M157 66c26-14 37 1 27 14M87 118c-27 10-29 29-8 32M154 120c29 9 28 29 5 35" fill="none" {...common} />
        </g>
      );
    case "clarinet":
      return (
        <g>
          <path d="M82 138L157 56" fill="none" stroke={card.accent} strokeWidth="18" strokeLinecap="round" />
          <path d="M66 143c-18 10-12 26 9 22 12-2 28-9 34-18" fill={card.main} {...common} />
          <circle cx="107" cy="112" r="4" fill={card.glow} />
          <circle cx="124" cy="94" r="4" fill={card.glow} />
          <circle cx="140" cy="77" r="4" fill={card.glow} />
        </g>
      );
    case "puffer":
      return (
        <g>
          <circle cx="120" cy="93" r="52" fill={card.main} {...common} />
          <path d="M71 77l-18-8M93 49l-9-18M126 41l2-20M153 55l17-15M170 84l24-2M161 119l19 14M121 145v23M84 126l-18 14" fill="none" stroke={card.accent} strokeWidth="5" strokeLinecap="round" />
          <circle cx="104" cy="83" r="6" fill={stroke} />
          <circle cx="136" cy="83" r="6" fill={stroke} />
          <path d="M107 107c10 9 22 9 32 0" fill="none" {...common} />
        </g>
      );
    case "dome":
      return (
        <g>
          <circle cx="120" cy="83" r="46" fill="rgba(236,254,255,0.58)" stroke={card.glow} strokeWidth="7" />
          <path d="M76 120c10 29 78 29 88 0" fill={card.main} {...common} />
          <path d="M96 84h48M120 60v47" fill="none" stroke={card.accent} strokeWidth="7" strokeLinecap="round" />
        </g>
      );
    case "claw":
      return (
        <g>
          <path d="M92 129c-26-20-29-54-5-78 25 21 21 48 0 58 22 2 37-16 43-39 32 19 34 61 7 80" fill={card.main} {...common} />
          <circle cx="106" cy="91" r="7" fill={card.glow} />
          <circle cx="129" cy="91" r="7" fill={card.glow} />
          <circle cx="118" cy="139" r="18" fill={card.accent} stroke={stroke} strokeWidth="5" />
        </g>
      );
    case "star":
      return <path d="M120 35l17 42 45 4-34 29 10 44-38-23-38 23 10-44-34-29 45-4z" fill={card.main} {...common} />;
    case "burger":
      return (
        <g>
          <path d="M66 87c8-37 100-40 111 0z" fill={card.main} {...common} />
          <path d="M57 105h126" fill="none" stroke={card.accent} strokeWidth="15" strokeLinecap="round" />
          <path d="M63 124c20 18 93 18 114 0z" fill={card.main} {...common} />
          <circle cx="91" cy="68" r="4" fill={card.glow} />
          <circle cx="122" cy="62" r="4" fill={card.glow} />
          <circle cx="148" cy="70" r="4" fill={card.glow} />
        </g>
      );
    case "sponge":
      return (
        <g>
          <rect x="73" y="45" width="94" height="98" rx="18" fill={card.main} {...common} />
          <circle cx="96" cy="75" r="7" fill={card.accent} opacity="0.55" />
          <circle cx="138" cy="66" r="5" fill={card.accent} opacity="0.5" />
          <circle cx="129" cy="111" r="8" fill={card.accent} opacity="0.42" />
          <circle cx="100" cy="103" r="4" fill={card.accent} opacity="0.55" />
          <rect x="88" y="137" width="64" height="18" rx="7" fill={card.accent} stroke={stroke} strokeWidth="5" />
        </g>
      );
    case "ghost":
      return (
        <g>
          <path d="M79 139V82c0-32 20-49 43-49s42 17 42 49v57l-16-12-14 14-15-14-17 13-11-13z" fill={card.main} {...common} />
          <path d="M70 61c-23 11-32 30-25 51M168 58c28 7 41 29 30 58" fill="none" stroke={card.accent} strokeWidth="8" strokeLinecap="round" opacity="0.7" />
          <circle cx="106" cy="84" r="6" fill={stroke} />
          <circle cx="137" cy="84" r="6" fill={stroke} />
        </g>
      );
    case "house":
      return (
        <g>
          <path d="M88 69c9-35 55-41 67-1 10 33-3 72-33 72-33 0-46-36-34-71z" fill={card.main} {...common} />
          <path d="M83 66c28-15 47-25 76-8M111 42c-12-17-6-32 8-38M131 42c15-17 13-30 3-40" fill="none" stroke={card.accent} strokeWidth="7" strokeLinecap="round" />
          <circle cx="109" cy="93" r="9" fill={card.glow} stroke={stroke} strokeWidth="4" />
          <rect x="122" y="112" width="23" height="28" rx="6" fill={card.accent} stroke={stroke} strokeWidth="4" />
        </g>
      );
    case "jelly":
      return (
        <g>
          <path d="M74 88c7-39 86-39 94 0 4 21-18 32-47 32S70 109 74 88z" fill={card.main} {...common} />
          <path d="M91 117c-17 20 5 26-8 43M118 119c-14 18 10 29-2 45M145 117c-18 19 3 26-12 44" fill="none" stroke={card.accent} strokeWidth="7" strokeLinecap="round" />
        </g>
      );
    case "spatula":
      return (
        <g>
          <rect x="73" y="50" width="60" height="50" rx="12" fill={card.main} {...common} />
          <path d="M132 96l45 50" fill="none" stroke={card.accent} strokeWidth="16" strokeLinecap="round" />
          <path d="M87 66h32M87 83h32" fill="none" stroke={card.glow} strokeWidth="5" strokeLinecap="round" />
        </g>
      );
    case "boat":
      return (
        <g>
          <path d="M54 113c18 28 113 30 139 0l-18 32H75z" fill={card.main} {...common} />
          <circle cx="91" cy="114" r="10" fill={card.accent} stroke={stroke} strokeWidth="5" />
          <circle cx="153" cy="114" r="10" fill={card.accent} stroke={stroke} strokeWidth="5" />
          <path d="M92 81h58l22 31H72z" fill={card.glow} stroke={stroke} strokeWidth="5" />
        </g>
      );
    case "shell":
      return (
        <g>
          <path d="M65 131c9-65 31-94 58-94 28 0 49 30 58 94z" fill={card.main} {...common} />
          <path d="M83 126c8-37 18-59 36-87M121 129V39M158 126c-7-37-17-60-36-87" fill="none" stroke={card.accent} strokeWidth="6" strokeLinecap="round" />
          <circle cx="121" cy="126" r="11" fill={card.glow} stroke={stroke} strokeWidth="4" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M70 130h101l-12-71-27 35-14-47-19 47-24-35z" fill={card.main} {...common} />
          <path d="M84 130h72M120 54v-24" fill="none" stroke={card.accent} strokeWidth="7" strokeLinecap="round" />
          <circle cx="120" cy="28" r="10" fill={card.glow} stroke={stroke} strokeWidth="4" />
        </g>
      );
  }
}

function CardArtwork({ card, locked = false }: { card: SpongeCard; locked?: boolean }) {
  const gradientId = `sponge-card-art-${card.id}`;

  return (
    <svg
      className={`absolute inset-0 h-full w-full ${locked ? "grayscale brightness-50" : ""}`}
      viewBox="0 0 240 180"
      role="img"
      aria-label={`${card.name} original artwork`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={card.bg} />
          <stop offset="56%" stopColor={card.glow} stopOpacity="0.48" />
          <stop offset="100%" stopColor={card.floor} />
        </linearGradient>
      </defs>
      <rect width="240" height="180" fill={`url(#${gradientId})`} />
      <path d="M0 142c26-17 54-18 86-8 39 13 75 10 114-10 17-9 31-12 40-10v66H0z" fill={card.floor} opacity="0.74" />
      <path d="M18 141c22-23 46-24 70-4M164 130c17-18 36-18 55-2" fill="none" stroke={card.accent} strokeLinecap="round" strokeWidth="7" opacity="0.55" />
      <circle cx="28" cy="34" r="5" fill={card.glow} opacity="0.5" />
      <circle cx="58" cy="22" r="3" fill={card.glow} opacity="0.35" />
      <circle cx="202" cy="38" r="7" fill={card.glow} opacity="0.35" />
      <circle cx="216" cy="76" r="3.5" fill={card.glow} opacity="0.45" />
      <MotifShape card={card} />
      <path d="M0 0h240v180H0z" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="7" />
    </svg>
  );
}

function SpongeCardView({
  card,
  count,
  locked = false,
  compact = false,
}: {
  card: SpongeCard;
  count?: number;
  locked?: boolean;
  compact?: boolean;
}) {
  const meta = RARITY_META[card.rarity];

  return (
    <div className={`relative aspect-[3/4] w-full rounded-2xl bg-gradient-to-br p-[3px] shadow-xl ${meta.frame}`}>
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[13px] bg-[#fffaf0]">
        <div className="flex items-center justify-between gap-1 px-2 pt-1.5">
          <span className={`truncate text-[10px] font-black leading-tight ${meta.text}`}>
            {card.name}
          </span>
          <span className={`shrink-0 rounded-full px-1.5 py-[1px] text-[7px] font-black uppercase ${meta.chip}`}>
            {meta.label}
          </span>
        </div>
        <div className="relative mx-1.5 mt-1 flex-1 overflow-hidden rounded-lg border-2 border-[#f2e3bd] bg-sky-200">
          <CardArtwork card={card} locked={locked} />
          {card.rarity === "gold" && !locked && (
            <div className="sponge-card-foil pointer-events-none absolute inset-0" />
          )}
          {locked && (
            <div className="absolute inset-0 grid place-items-center bg-slate-950/40 text-xl">
              ?
            </div>
          )}
        </div>
        {!compact && (
          <p className="line-clamp-1 px-2 pt-1 text-[8px] italic text-slate-500">
            &ldquo;{card.quote}&rdquo;
          </p>
        )}
        <div className="flex items-center justify-between gap-1 px-2 pb-1.5 pt-1 text-[8px] font-black text-slate-700">
          <span className="rounded bg-orange-100 px-1 py-[1px] text-orange-700">
            P {card.power}
          </span>
          <span className="rounded bg-pink-100 px-1 py-[1px] text-pink-700">
            J {card.jelly}
          </span>
        </div>
        {typeof count === "number" && count > 1 && (
          <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-slate-950 px-1 text-[10px] font-black text-white">
            x{count}
          </span>
        )}
      </div>
    </div>
  );
}

function SpongePackIcon() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className="h-full w-full">
      <path
        d="M31 18h55c9 0 16 8 14 17l-7 50c-2 10-10 17-20 17H33c-10 0-18-8-17-18l4-49c1-10 9-17 11-17z"
        fill="#facc15"
        stroke="#083344"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="40" r="8" fill="#84cc16" opacity="0.65" />
      <circle cx="75" cy="34" r="6" fill="#84cc16" opacity="0.55" />
      <circle cx="67" cy="73" r="10" fill="#84cc16" opacity="0.5" />
      <circle cx="42" cy="78" r="5" fill="#84cc16" opacity="0.65" />
      <path d="M40 95h39" fill="none" stroke="#dc2626" strokeLinecap="round" strokeWidth="8" />
    </svg>
  );
}

export function SpongeCardGame({ onExit }: { onExit: () => void }) {
  const [game, setGame] = useState<StoredCardGame>(DEFAULT_GAME);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<Rarity | "all">("all");
  const [pulls, setPulls] = useState<Pull[]>([]);
  const [notice, setNotice] = useState("Follow the tide. Open packs. Keep the rare ones.");

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
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
  }, [game, hydrated]);

  const uniqueOwned = useMemo(
    () => CARDS.filter((card) => (game.collection[card.id] ?? 0) > 0).length,
    [game.collection],
  );

  const freeReadyAt = game.lastFreePackAt
    ? game.lastFreePackAt + FREE_COOLDOWN_MS
    : 0;
  const freeReadyMs = freeReadyAt - now;
  const freeReady = !game.lastFreePackAt || freeReadyMs <= 0;

  const dupeValue = useMemo(
    () =>
      CARDS.reduce((sum, card) => {
        const extra = Math.max(0, (game.collection[card.id] ?? 0) - 1);
        return sum + extra * RARITY_META[card.rarity].sellValue;
      }, 0),
    [game.collection],
  );

  const dupeCount = useMemo(
    () =>
      CARDS.reduce(
        (sum, card) => sum + Math.max(0, (game.collection[card.id] ?? 0) - 1),
        0,
      ),
    [game.collection],
  );

  const visibleCards = useMemo(
    () =>
      [...CARDS]
        .sort(
          (a, b) =>
            RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity) ||
            a.name.localeCompare(b.name),
        )
        .filter((card) => filter === "all" || card.rarity === filter),
    [filter],
  );

  function openPack(source: "free" | "points") {
    if (!hydrated) return;
    if (source === "free" && !freeReady) {
      setNotice("The free pack is still sleeping in the tide.");
      return;
    }
    if (source === "points" && game.points < PACK_COST) {
      setNotice(`You need ${PACK_COST - game.points} more Krabby Points.`);
      return;
    }

    const rolled = rollPack();
    const nextCollection = { ...game.collection };
    const nextPulls = rolled.map((card) => {
      const currentCount = nextCollection[card.id] ?? 0;
      nextCollection[card.id] = currentCount + 1;
      return {
        card,
        isNew: currentCount === 0,
        copy: currentCount + 1,
      };
    });

    setGame((current) => ({
      ...current,
      collection: nextCollection,
      points: source === "points" ? current.points - PACK_COST : current.points,
      packsOpened: current.packsOpened + 1,
      lastFreePackAt: source === "free" ? Date.now() : current.lastFreePackAt,
    }));
    setPulls(nextPulls);
    setNotice(
      nextPulls.some((pull) => pull.isNew)
        ? "New card found in the reef."
        : "All dupes. Trade them for points.",
    );
  }

  function sellDupes() {
    if (dupeCount <= 0) {
      setNotice("No dupes to trade yet.");
      return;
    }

    const nextCollection = { ...game.collection };
    for (const card of CARDS) {
      if ((nextCollection[card.id] ?? 0) > 1) {
        nextCollection[card.id] = 1;
      }
    }

    setGame((current) => ({
      ...current,
      collection: nextCollection,
      points: current.points + dupeValue,
      dupesSold: current.dupesSold + dupeCount,
    }));
    setNotice(`Traded ${dupeCount} dupes for ${dupeValue} Krabby Points.`);
  }

  return (
    <section className="sponge-card-game-scene fixed inset-0 z-[90] overflow-y-auto text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 22 }, (_, index) => (
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
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-100/70">
              hidden reef passage
            </p>
            <h1 className="mt-1 text-4xl font-black leading-none text-yellow-300 drop-shadow-[0_0.25rem_0_rgba(8,47,73,0.85)] sm:text-6xl">
              KRUSTY CARDS
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border-2 border-yellow-300/70 bg-blue-950/50 px-4 py-2 text-center backdrop-blur">
              <p className="text-2xl font-black text-white">{game.points}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-yellow-200">
                Krabby Points
              </p>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="rounded-2xl border border-white/25 bg-black/35 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/75 backdrop-blur transition hover:bg-black/55"
            >
              Back to door
            </button>
          </div>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border-4 border-yellow-300 bg-gradient-to-b from-sky-400 via-blue-600 to-indigo-900 p-5 shadow-[0_0_4rem_rgba(56,189,248,0.35)]">
              <div className="sponge-pack-shine pointer-events-none absolute inset-0" />
              <div className="relative mx-auto h-44 w-32 rounded-3xl border-4 border-yellow-200 bg-gradient-to-b from-sky-300 via-cyan-600 to-blue-900 p-5 shadow-2xl">
                <SpongePackIcon />
              </div>
              <div className="relative mt-4 grid gap-2">
                <button
                  type="button"
                  disabled={!hydrated || !freeReady}
                  onClick={() => openPack("free")}
                  className="rounded-2xl bg-yellow-300 px-4 py-3 text-sm font-black uppercase tracking-wide text-blue-950 shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
                >
                  {!hydrated
                    ? "Loading..."
                    : freeReady
                      ? "Open free pack"
                      : `Free in ${formatCountdown(freeReadyMs)}`}
                </button>
                <button
                  type="button"
                  disabled={!hydrated || game.points < PACK_COST}
                  onClick={() => openPack("points")}
                  className="rounded-2xl bg-pink-300 px-4 py-3 text-sm font-black uppercase tracking-wide text-purple-950 shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/50"
                >
                  Buy pack for {PACK_COST}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-blue-950/45 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-yellow-200">Dupe Exchange</h2>
                  <p className="text-xs font-bold text-white/65">
                    {dupeCount} dupes worth {dupeValue} points
                  </p>
                </div>
                <button
                  type="button"
                  disabled={dupeCount <= 0}
                  onClick={sellDupes}
                  className="rounded-xl bg-lime-300 px-4 py-2 text-xs font-black uppercase text-lime-950 transition active:scale-95 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                >
                  Trade
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["Packs", game.packsOpened],
                ["Traded", game.dupesSold],
                ["Found", `${uniqueOwned}/${CARDS.length}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-blue-950/45 p-3 backdrop-blur">
                  <p className="text-xl font-black text-yellow-200">{value}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/55">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/20 bg-blue-950/45 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-white">Pack Results</h2>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-100/65">
                    {notice}
                  </p>
                </div>
                {pulls.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPulls([])}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {pulls.length > 0
                  ? pulls.map((pull, index) => (
                      <div
                        key={`${pull.card.id}-${index}-${pull.copy}`}
                        className="sponge-card-reveal relative"
                        style={{ animationDelay: `${index * 80}ms` }}
                      >
                        <SpongeCardView card={pull.card} compact />
                        <span
                          className={`absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-[1px] text-[8px] font-black uppercase ${
                            pull.isNew
                              ? "bg-lime-300 text-lime-950"
                              : "bg-amber-300 text-amber-950"
                          }`}
                        >
                          {pull.isNew
                            ? "New"
                            : `Dupe +${RARITY_META[pull.card.rarity].sellValue}`}
                        </span>
                      </div>
                    ))
                  : CARDS.slice(0, 5).map((card) => (
                      <SpongeCardView key={card.id} card={card} locked compact />
                    ))}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-2xl font-black text-white">
                  Collection{" "}
                  <span className="text-yellow-300">
                    {uniqueOwned}/{CARDS.length}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", ...RARITY_ORDER] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide transition ${
                        filter === key
                          ? "bg-yellow-300 text-blue-950"
                          : "bg-white/15 text-white/75 hover:bg-white/25"
                      }`}
                    >
                      {key === "all" ? "All" : RARITY_META[key].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {visibleCards.map((card) => {
                  const count = game.collection[card.id] ?? 0;
                  return (
                    <SpongeCardView
                      key={card.id}
                      card={card}
                      count={count}
                      locked={count === 0}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p className="py-7 text-center text-[10px] font-black uppercase tracking-widest text-white/45">
          SpongeBob-themed fan card game with original SVG artwork
        </p>
      </div>
    </section>
  );
}
