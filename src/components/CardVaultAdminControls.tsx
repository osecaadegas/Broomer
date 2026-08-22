"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CARD_GAME_PROGRESS_EVENT,
  readCardGameProgress,
  writeCardGameProgress,
  type CardGameProgress,
} from "@/lib/card-game-rewards";
import { CheckIcon, PlusIcon, SparklesIcon } from "@/components/icons";

const SPONGEBOB_THEME_ID = "spongebob";
const FREE_PACK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function parsePointInput(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function formatPoints(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(
    seconds,
  ).padStart(2, "0")}s`;
}

function readThemeTimer(progress: CardGameProgress) {
  return progress.lastFreePackAtByTheme[SPONGEBOB_THEME_ID];
}

function getTimerLabel(progress: CardGameProgress, now: number) {
  const lastClaim = readThemeTimer(progress);
  if (!lastClaim) return "Ready now";

  const remaining = lastClaim + FREE_PACK_COOLDOWN_MS - now;
  return remaining <= 0 ? "Ready now" : formatCountdown(remaining);
}

export function CardVaultAdminControls() {
  const [progress, setProgress] = useState<CardGameProgress | null>(null);
  const [addAmount, setAddAmount] = useState("1000");
  const [setAmount, setSetAmount] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("Card vault loaded.");

  useEffect(() => {
    const syncProgress = () => setProgress(readCardGameProgress());
    syncProgress();

    window.addEventListener("storage", syncProgress);
    window.addEventListener(CARD_GAME_PROGRESS_EVENT, syncProgress);
    return () => {
      window.removeEventListener("storage", syncProgress);
      window.removeEventListener(CARD_GAME_PROGRESS_EVENT, syncProgress);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const timerLabel = useMemo(
    () => (progress ? getTimerLabel(progress, now) : "Loading"),
    [now, progress],
  );

  function commitProgress(
    updater: (current: CardGameProgress) => CardGameProgress,
    successMessage: string,
  ) {
    const current = readCardGameProgress();
    const next = updater(current);
    writeCardGameProgress(next);
    setProgress(next);
    setMessage(successMessage);
  }

  function handleAddPoints(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parsePointInput(addAmount);
    if (!amount) {
      setMessage("Enter a point amount above 0.");
      return;
    }

    commitProgress(
      (current) => ({
        ...current,
        points: current.points + amount,
      }),
      `Added ${formatPoints(amount)} points.`,
    );
  }

  function handleSetBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = parsePointInput(setAmount);
    if (amount === null) {
      setMessage("Enter a valid point balance.");
      return;
    }

    commitProgress(
      (current) => ({
        ...current,
        points: amount,
      }),
      `Set balance to ${formatPoints(amount)} points.`,
    );
  }

  function makeFreePackReady() {
    commitProgress(
      (current) => {
        const lastFreePackAtByTheme = { ...current.lastFreePackAtByTheme };
        delete lastFreePackAtByTheme[SPONGEBOB_THEME_ID];
        return {
          ...current,
          lastFreePackAtByTheme,
        };
      },
      "Free pack is ready now.",
    );
  }

  function restartFreePackTimer() {
    commitProgress(
      (current) => ({
        ...current,
        lastFreePackAtByTheme: {
          ...current.lastFreePackAtByTheme,
          [SPONGEBOB_THEME_ID]: Date.now(),
        },
      }),
      "Free pack timer restarted.",
    );
  }

  const points = progress?.points ?? 0;
  const packsOpened = progress?.packsOpened ?? 0;
  const cardsOwned = progress
    ? Object.values(progress.cards).filter((count) => count > 0).length
    : 0;
  const duplicates = progress
    ? Object.values(progress.cards).reduce(
        (total, count) => total + Math.max(0, count - 1),
        0,
      )
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Card vault
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Current browser balance
            </h3>
          </div>
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <SparklesIcon className="h-5 w-5" />
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-950 p-5 text-white shadow-inner">
          <p className="text-4xl font-black tracking-tight">
            {formatPoints(points)}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
            available points
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Packs", packsOpened],
            ["Cards", cardsOwned],
            ["Dupes", duplicates],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                {label}
              </dt>
              <dd className="mt-1 text-xl font-bold text-slate-950">
                {formatPoints(Number(value))}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900">
          {message}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <form
          onSubmit={handleAddPoints}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <PlusIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-950">Give points</h3>
              <p className="mt-1 text-sm text-slate-600">
                Adds points to the card vault save on this browser.
              </p>
            </div>
          </div>
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            Amount
            <input
              value={addAmount}
              onChange={(event) => setAddAmount(event.target.value)}
              inputMode="numeric"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-indigo-700 active:scale-[0.99]"
          >
            Add points
          </button>
        </form>

        <form
          onSubmit={handleSetBalance}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-100 text-sky-700">
              <CheckIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-950">Set balance</h3>
              <p className="mt-1 text-sm text-slate-600">
                Replaces the current point balance with an exact value.
              </p>
            </div>
          </div>
          <label className="mt-5 block text-sm font-semibold text-slate-700">
            New balance
            <input
              value={setAmount}
              onChange={(event) => setSetAmount(event.target.value)}
              inputMode="numeric"
              placeholder={String(points)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-950 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </label>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99]"
          >
            Set points
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-950">Free pack timer</h3>
              <p className="mt-1 text-sm text-slate-600">
                SpongeBob pack cooldown:{" "}
                <span className="font-bold text-slate-950">{timerLabel}</span>
              </p>
            </div>
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-amber-700">
              24 hours
            </span>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={makeFreePackReady}
              className="rounded-lg bg-amber-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-amber-950 transition hover:bg-amber-200 active:scale-[0.99]"
            >
              Make ready now
            </button>
            <button
              type="button"
              onClick={restartFreePackTimer}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.99]"
            >
              Restart timer
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
