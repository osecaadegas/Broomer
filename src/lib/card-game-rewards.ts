export type CardGameProgress = {
  version: 2;
  points: number;
  cards: Record<string, number>;
  packsOpened: number;
  dupesSold: number;
  lastFreePackAtByTheme: Record<string, number | undefined>;
};

export const CARD_GAME_STORAGE_KEY = "broomer_krusty_card_game";
export const CARD_GAME_PROGRESS_EVENT = "broomer-card-game-progress";
export const CARD_GAME_STARTING_POINTS = 750;
export const CHESS_WIN_POINTS = 1000;
export const QUIZ_ANSWER_POINTS = 50;

type LegacyProgress = Partial<CardGameProgress> & {
  collection?: Record<string, unknown>;
  lastFreePackAt?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readCardCounts(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};

  const cards: Record<string, number> = {};
  for (const [id, rawCount] of Object.entries(value)) {
    const count = Math.floor(Number(rawCount));
    if (Number.isFinite(count) && count > 0) cards[id] = count;
  }
  return cards;
}

function readFreePackTimes(
  value: unknown,
  legacySpongebobTime: unknown,
): Record<string, number | undefined> {
  const times: Record<string, number | undefined> = {};

  if (isRecord(value)) {
    for (const [themeId, rawTime] of Object.entries(value)) {
      const time = Number(rawTime);
      if (Number.isFinite(time) && time > 0) times[themeId] = time;
    }
  }

  const legacyTime = Number(legacySpongebobTime);
  if (!times.spongebob && Number.isFinite(legacyTime) && legacyTime > 0) {
    times.spongebob = legacyTime;
  }

  return times;
}

export function createDefaultCardGameProgress(): CardGameProgress {
  return {
    version: 2,
    points: CARD_GAME_STARTING_POINTS,
    cards: {},
    packsOpened: 0,
    dupesSold: 0,
    lastFreePackAtByTheme: {},
  };
}

export function readCardGameProgress(): CardGameProgress {
  const fallback = createDefaultCardGameProgress();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(CARD_GAME_STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as LegacyProgress;
    return {
      version: 2,
      points: readNumber(parsed.points, fallback.points),
      cards: readCardCounts(parsed.cards ?? parsed.collection),
      packsOpened: readNumber(parsed.packsOpened, fallback.packsOpened),
      dupesSold: readNumber(parsed.dupesSold, fallback.dupesSold),
      lastFreePackAtByTheme: readFreePackTimes(
        parsed.lastFreePackAtByTheme,
        parsed.lastFreePackAt,
      ),
    };
  } catch {
    return fallback;
  }
}

export function writeCardGameProgress(progress: CardGameProgress) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(CARD_GAME_STORAGE_KEY, JSON.stringify(progress));
  window.dispatchEvent(
    new CustomEvent<CardGameProgress>(CARD_GAME_PROGRESS_EVENT, {
      detail: progress,
    }),
  );
}

export function updateCardGameProgress(
  updater: (current: CardGameProgress) => CardGameProgress,
) {
  const next = updater(readCardGameProgress());
  writeCardGameProgress(next);
  return next;
}

export function awardCardGamePoints(points: number) {
  const amount = Math.max(0, Math.floor(points));
  if (amount <= 0) return readCardGameProgress();

  return updateCardGameProgress((current) => ({
    ...current,
    points: current.points + amount,
  }));
}
