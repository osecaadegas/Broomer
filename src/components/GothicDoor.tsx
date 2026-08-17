"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { PlaneAnswerReveal } from "@/components/PlaneAnswerReveal";
import type { PlaneAnswer } from "@/lib/supabase/types";

interface Props {
  onOpen: () => void;
  onUno: () => void;
  onPrepareMusic: () => void;
  onStartMusic: () => void;
}

const rides = [
  {
    value: "uno",
    char: null,
    image: "/UNO_reverse_icon.png",
    label: "UNO reverse card",
  },
  { value: "✈️", char: "✈️", image: null, label: "plane" },
  { value: "🚲", char: "🚲", image: null, label: "bike" },
  { value: "🧹", char: "🧹", image: null, label: "broom" },
];

const secretRide = {
  value: "moon",
  char: "🌙",
  image: null,
  label: "moonlit passage",
};

const SYMBOL_SEQUENCE = ["upper", "lower", "upper", "lower", "upper"] as const;
type DoorSymbol = (typeof SYMBOL_SEQUENCE)[number];

const PLANE_QUOTE_DELAY_MS = 3100;
const PLANE_QUOTE_TYPE_MS = 2100;
const PLANE_FLIGHT_MS = 5400;
const IDLE_MESSAGES = [
  "A shadow crosses the other side.",
  "The door exhales.",
  "Something has been waiting politely.",
] as const;

function getIdleEventClass(index: number): string {
  if (index === 0) return "door-idle-shadow";
  if (index === 1) return "door-idle-breath";
  return "door-idle-listen";
}

function DoorIdleEvent({ active, index }: Readonly<{ active: boolean; index: number }>) {
  if (!active || index < 0) return null;

  return (
    <>
      <div
        key={index}
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-30 ${getIdleEventClass(index)}`}
      />
      <p
        aria-live="polite"
        className="door-idle-message pointer-events-none absolute left-1/2 top-[22%] z-40 -translate-x-1/2 whitespace-nowrap font-serif text-xs italic text-[#9f895d]/70"
      >
        {IDLE_MESSAGES[index]}
      </p>
    </>
  );
}

function isEntryRide(value: string): boolean {
  return (
    value === "🧹" || value === "✈️" || value === "uno" || value === "moon"
  );
}

function getRideSelectionClass(isValid: boolean, isWrong: boolean): string {
  if (isWrong) {
    return "border-red-900/50 bg-red-950/30 text-2xl sm:text-3xl";
  }
  if (isValid) {
    return "border-[#c9a84c]/25 bg-[#0c060a] text-2xl hover:border-[#c9a84c]/60 hover:bg-[#140e10] hover:shadow-[0_0_20px_rgba(201,168,76,0.12)] sm:text-3xl";
  }
  return "border-[#2a1a10]/40 bg-[#0c060a] text-2xl hover:border-[#3a2a1a]/60 hover:bg-[#140e10] sm:text-3xl";
}

function beginRideSelection(
  value: string,
  sliding: boolean,
  setPicked: (value: string) => void,
  setSliding: (value: boolean) => void,
  setDoorsOpen: (value: boolean) => void,
  onUno: () => void,
  onOpen: () => void,
) {
  if (sliding) return;
  setPicked(value);
  if (!isEntryRide(value)) return;

  setSliding(true);
  setTimeout(() => {
    if (value === "uno") onUno();
    else if (value === "moon") onOpen();
    else setDoorsOpen(true);
  }, 900);
}

export function GothicDoor({
  onOpen,
  onUno,
  onPrepareMusic,
  onStartMusic,
}: Readonly<Props>) {
  const [picked, setPicked] = useState<string | null>(null);
  const [sliding, setSliding] = useState(false);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [toxicInput, setToxicInput] = useState("");
  const [toxicWrong, setToxicWrong] = useState(false);
  const [planePassword, setPlanePassword] = useState("");
  const [planeError, setPlaneError] = useState<string | null>(null);
  const [planeLoading, setPlaneLoading] = useState(false);
  const [planeQuote, setPlaneQuote] = useState<string | null>(null);
  const [planeAnswers, setPlaneAnswers] = useState<PlaneAnswer[]>([]);
  const [typedPlaneQuote, setTypedPlaneQuote] = useState("");
  const [planeFlightDone, setPlaneFlightDone] = useState(false);
  const [broomFlying, setBroomFlying] = useState(false);
  const [smoke, setSmoke] = useState(false);
  const [gone, setGone] = useState(false);
  const [symbolProgress, setSymbolProgress] = useState(0);
  const [symbolsAwake, setSymbolsAwake] = useState(false);
  const [idleEventIndex, setIdleEventIndex] = useState(-1);
  const [idleEventActive, setIdleEventActive] = useState(false);

  function handlePick(char: string) {
    beginRideSelection(
      char,
      sliding,
      setPicked,
      setSliding,
      setDoorsOpen,
      onUno,
      onOpen,
    );
  }

  function handleSymbolTap(symbol: DoorSymbol) {
    if (sliding || symbolsAwake) return;

    if (symbol === SYMBOL_SEQUENCE[symbolProgress]) {
      const nextProgress = symbolProgress + 1;
      setSymbolProgress(nextProgress);
      if (nextProgress === SYMBOL_SEQUENCE.length) setSymbolsAwake(true);
      return;
    }

    setSymbolProgress(symbol === SYMBOL_SEQUENCE[0] ? 1 : 0);
  }

  async function handlePlaneSubmit() {
    if (!/^\d{3}$/.test(planePassword)) {
      setPlaneError("Enter all three digits");
      return;
    }

    setPlaneLoading(true);
    setPlaneError(null);
    try {
      const response = await fetch("/api/plane-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: planePassword }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to unlock the gate");
      setTypedPlaneQuote("");
      setPlaneFlightDone(false);
      setPlaneAnswers(Array.isArray(data.answers) ? data.answers : []);
      setPlaneQuote(data.quote);
    } catch (error_) {
      setPlanePassword("");
      setPlaneError(
        error_ instanceof Error ? error_.message : "Unable to unlock the gate",
      );
    } finally {
      setPlaneLoading(false);
    }
  }

  function handleToxicSubmit() {
    if (toxicInput.trim().toLowerCase() === "toxic") {
      onPrepareMusic();
      setBroomFlying(true);
      setTimeout(() => {
        setSmoke(true);
        onStartMusic();
      }, 3050);
      setTimeout(() => setGone(true), 4450);
      setTimeout(() => onOpen(), 4550);
    } else {
      setToxicWrong(true);
      setToxicInput("");
    }
  }

  useEffect(() => {
    if (!gone) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [gone]);

  useEffect(() => {
    if (sliding) return;

    let idleTimer = 0;
    let clearTimer = 0;

    const revealIdleEvent = () => {
      setIdleEventIndex((current) => (current + 1) % IDLE_MESSAGES.length);
      setIdleEventActive(true);
      clearTimer = window.setTimeout(() => {
        setIdleEventActive(false);
        idleTimer = window.setTimeout(revealIdleEvent, 10000);
      }, 4000);
    };

    const markActive = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(clearTimer);
      setIdleEventActive(false);
      idleTimer = window.setTimeout(revealIdleEvent, 8000);
    };

    idleTimer = window.setTimeout(revealIdleEvent, 8000);
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);

    return () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(clearTimer);
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
    };
  }, [sliding]);

  useEffect(() => {
    if (!planeQuote) return;

    let animationFrame = 0;
    let typingStartedAt: number | null = null;

    const typingTimer = window.setTimeout(() => {
      typingStartedAt = performance.now();
      const typeQuote = (now: number) => {
        const elapsed = now - (typingStartedAt ?? now);
        const progress = Math.min(1, elapsed / PLANE_QUOTE_TYPE_MS);
        const characterCount = Math.ceil(progress * planeQuote.length);
        setTypedPlaneQuote(planeQuote.slice(0, characterCount));
        if (progress < 1) animationFrame = requestAnimationFrame(typeQuote);
      };
      animationFrame = requestAnimationFrame(typeQuote);
    }, PLANE_QUOTE_DELAY_MS);

    const flightTimer = window.setTimeout(() => {
      setTypedPlaneQuote(planeQuote);
      setPlaneFlightDone(true);
    }, PLANE_FLIGHT_MS);

    return () => {
      window.clearTimeout(typingTimer);
      window.clearTimeout(flightTimer);
      cancelAnimationFrame(animationFrame);
    };
  }, [planeQuote]);

  if (gone) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#05030a]">
      {/* Ambient light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(180,140,60,0.15) 0%, transparent 60%)",
        }}
      />
      <DoorIdleEvent active={idleEventActive} index={idleEventIndex} />

      {/* LEFT DOOR */}
      <div
        className={`absolute inset-y-0 left-0 z-20 flex w-1/2 ${
          sliding ? "animate-slide-left" : ""
        }`}
      >
        <div className="relative h-full w-full overflow-hidden border-r border-[#2a1a10] bg-gradient-to-b from-[#10090c] via-[#0c0609] to-[#080407]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(200,170,120,0.5) 0px, transparent 1px, transparent 3px)",
            }}
          />
          <div className="pointer-events-none absolute -top-px left-0 right-0 h-40">
            <svg
              viewBox="0 0 400 160"
              fill="none"
              className="absolute bottom-0 left-0 h-full w-full"
              preserveAspectRatio="none"
            >
              <path
                d="M0 160 L0 80 Q0 20 80 10 Q140 0 200 40 Q260 0 320 10 Q400 20 400 80 L400 160 Z"
                fill="#0c0609"
                stroke="rgba(140,110,50,0.12)"
                strokeWidth="1.5"
              />
              <path
                d="M200 40 L200 120"
                stroke="rgba(140,110,50,0.08)"
                strokeWidth="1"
              />
              <path
                d="M140 25 Q200 80 260 25"
                stroke="rgba(140,110,50,0.06)"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[20%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[50%] h-[3px] bg-gradient-to-r from-[#2a1a10]/30 via-[#3a2a1a]/40 to-[#2a1a10]/30" />
          <div className="pointer-events-none absolute inset-x-0 top-[80%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          {[20, 50, 80].map((top) => (
            <div
              key={top}
              className="pointer-events-none absolute left-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]"
              style={{ top: `${top}%` }}
            />
          ))}
          {[20, 50, 80].map((top) => (
            <div
              key={top}
              className="pointer-events-none absolute right-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]"
              style={{ top: `${top}%` }}
            />
          ))}
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <div className="h-14 w-14 rounded-full border-2 border-[#3a2a1a]/50 bg-transparent shadow-[inset_0_2px_8px_rgba(0,0,0,0.6),0_0_16px_rgba(0,0,0,0.4)]" />
            <div className="absolute bottom-0 left-1/2 h-6 w-3 -translate-x-1/2 translate-y-1 rounded-b-sm bg-gradient-to-b from-[#2a1a10] to-[#1a0f0a] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
          </div>
          <div className="pointer-events-none absolute inset-x-6 bottom-8 top-[85%] rounded-sm border border-[#2a1a10]/30 bg-[#0a0608]/50" />
        </div>
      </div>

      {/* RIGHT DOOR */}
      <div
        className={`absolute inset-y-0 right-0 z-20 flex w-1/2 ${
          sliding ? "animate-slide-right" : ""
        }`}
      >
        <div className="relative h-full w-full overflow-hidden border-l border-[#2a1a10] bg-gradient-to-b from-[#10090c] via-[#0c0609] to-[#080407]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(200,170,120,0.5) 0px, transparent 1px, transparent 3px)",
            }}
          />
          <div className="pointer-events-none absolute -top-px left-0 right-0 h-40">
            <svg
              viewBox="0 0 400 160"
              fill="none"
              className="absolute bottom-0 left-0 h-full w-full"
              preserveAspectRatio="none"
            >
              <path
                d="M0 160 L0 80 Q0 20 80 10 Q140 0 200 40 Q260 0 320 10 Q400 20 400 80 L400 160 Z"
                fill="#0c0609"
                stroke="rgba(140,110,50,0.12)"
                strokeWidth="1.5"
              />
              <path
                d="M200 40 L200 120"
                stroke="rgba(140,110,50,0.08)"
                strokeWidth="1"
              />
              <path
                d="M140 25 Q200 80 260 25"
                stroke="rgba(140,110,50,0.06)"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[20%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[50%] h-[3px] bg-gradient-to-r from-[#2a1a10]/30 via-[#3a2a1a]/40 to-[#2a1a10]/30" />
          <div className="pointer-events-none absolute inset-x-0 top-[80%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          {[20, 50, 80].map((top) => (
            <div
              key={top}
              className="pointer-events-none absolute left-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]"
              style={{ top: `${top}%` }}
            />
          ))}
          {[20, 50, 80].map((top) => (
            <div
              key={top}
              className="pointer-events-none absolute right-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]"
              style={{ top: `${top}%` }}
            />
          ))}
          <div className="absolute left-6 top-1/2 -translate-y-1/2">
            <div className="h-14 w-14 rounded-full border-2 border-[#3a2a1a]/50 bg-transparent shadow-[inset_0_2px_8px_rgba(0,0,0,0.6),0_0_16px_rgba(0,0,0,0.4)]" />
            <div className="absolute bottom-0 left-1/2 h-6 w-3 -translate-x-1/2 translate-y-1 rounded-b-sm bg-gradient-to-b from-[#2a1a10] to-[#1a0f0a] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
          </div>
          <div className="pointer-events-none absolute inset-x-6 bottom-8 top-[85%] rounded-sm border border-[#2a1a10]/30 bg-[#0a0608]/50" />
        </div>
      </div>

      {/* CENTER SEAM */}
      <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center">
        <button
          type="button"
          onClick={() => handleSymbolTap("upper")}
          aria-label="Upper door sigil"
          className="pointer-events-auto mt-4 flex h-10 w-10 items-center justify-center rounded-full transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
          style={{
            filter: `drop-shadow(0 0 ${symbolsAwake ? 12 : symbolProgress * 2}px rgba(223,199,125,${symbolsAwake ? 0.9 : 0.35}))`,
          }}
        >
          <svg viewBox="0 0 40 50" className="h-10 w-10" fill="none">
            <path
              d="M20 2 L26 18 L38 22 L26 26 L28 42 L20 34 L12 42 L14 26 L2 22 L14 18 Z"
              fill="rgba(180,140,60,0.15)"
              stroke="rgba(180,140,60,0.25)"
              strokeWidth="1"
            />
            <circle
              cx="20"
              cy="22"
              r="4"
              fill="rgba(180,140,60,0.1)"
              stroke="rgba(180,140,60,0.2)"
              strokeWidth="0.8"
            />
          </svg>
        </button>
        <div className="h-28 w-px bg-gradient-to-b from-[#c9a84c]/15 via-[#c9a84c]/25 to-[#c9a84c]/10" />
        <button
          type="button"
          onClick={() => window.location.assign("/admin")}
          aria-label="Open admin dashboard"
          title="Admin dashboard"
          tabIndex={sliding ? -1 : 0}
          className={`grid h-14 w-14 place-items-center rounded-full border border-[#c9a84c]/20 bg-[#0c0609] shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(201,168,76,0.1)] transition hover:border-[#c9a84c]/50 hover:bg-[#17100c] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c9a84c] ${sliding ? "pointer-events-none" : "pointer-events-auto"}`}
        >
          <span className="text-xl">⚜️</span>
        </button>
        <div className="h-28 w-px bg-gradient-to-b from-[#c9a84c]/10 via-[#c9a84c]/25 to-[#c9a84c]/15" />
        <button
          type="button"
          onClick={() => handleSymbolTap("lower")}
          aria-label="Lower door sigil"
          className="pointer-events-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
          style={{
            filter: `drop-shadow(0 0 ${symbolsAwake ? 12 : symbolProgress * 2}px rgba(223,199,125,${symbolsAwake ? 0.9 : 0.35}))`,
          }}
        >
          <svg viewBox="0 0 40 50" className="h-10 w-10 rotate-180" fill="none">
            <path
              d="M20 2 L26 18 L38 22 L26 26 L28 42 L20 34 L12 42 L14 26 L2 22 L14 18 Z"
              fill="rgba(180,140,60,0.15)"
              stroke="rgba(180,140,60,0.25)"
              strokeWidth="1"
            />
            <circle
              cx="20"
              cy="22"
              r="4"
              fill="rgba(180,140,60,0.1)"
              stroke="rgba(180,140,60,0.2)"
              strokeWidth="0.8"
            />
          </svg>
        </button>
      </div>

      {/* EMOJI SELECTION (phase 1) */}
      {!sliding && (
        <div className="pointer-events-auto relative z-40 flex flex-col items-center gap-5">
          <p className="text-xs uppercase tracking-[0.25em] text-[#8a7a60]">
            Choose your ride
          </p>
          {symbolProgress > 0 && !symbolsAwake && (
            <p className="animate-card-in font-serif text-xs italic text-[#9f895d]/70">
              {symbolProgress < 3
                ? "A faint pulse answers."
                : "The pattern is listening."}
            </p>
          )}
          {symbolsAwake && (
            <p className="animate-card-in font-serif text-sm italic text-[#dfc77d]">
              A fifth path wakes.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {(symbolsAwake ? [...rides, secretRide] : rides).map((ride) => {
              const isValid = isEntryRide(ride.value);
              const isWrong = picked === ride.value && !isValid;
              const selectionClass = getRideSelectionClass(isValid, isWrong);
              return (
                <button
                  key={ride.value}
                  type="button"
                  onClick={() => handlePick(ride.value)}
                  aria-label={ride.label}
                  className={`group relative flex h-16 w-16 items-center justify-center rounded-lg border transition-all duration-200 sm:h-20 sm:w-20 ${selectionClass}`}
                >
                  {ride.image ? (
                    <Image
                      src={ride.image}
                      alt=""
                      width={404}
                      height={608}
                      loading="eager"
                      sizes="40px"
                      className="pointer-events-none h-9 w-auto object-contain sm:h-10"
                    />
                  ) : (
                    ride.char
                  )}
                  {isValid && !sliding && (
                    <span className="pointer-events-none absolute inset-0 rounded-lg bg-[#c9a84c]/[0.03] animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
          {picked !== null &&
            picked !== "🧹" &&
            picked !== "✈️" &&
            picked !== "uno" && (
              <p className="animate-card-in text-xs font-medium text-red-800/80">
                Wrong pick… Try again
              </p>
            )}
        </div>
      )}

      {/* TOXIC WORD INPUT (phase 2 — after doors open) */}
      {doorsOpen && picked === "🧹" && !broomFlying && !smoke && (
        <div className="pointer-events-auto relative z-40 flex flex-col items-center gap-4 animate-card-in">
          <p className="text-lg font-semibold tracking-wide text-stone-200">
            Stay .....
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleToxicSubmit();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              autoFocus
              value={toxicInput}
              onChange={(e) => {
                setToxicInput(e.target.value);
                setToxicWrong(false);
              }}
              placeholder="type here..."
              className="w-48 rounded-lg border border-[#3a5c3a]/40 bg-[#0a120a]/80 px-4 py-2.5 text-center text-sm text-stone-200 placeholder:text-stone-600 shadow-inner shadow-black/30 outline-none transition focus:border-[#5a9a5a]/60 focus:ring-2 focus:ring-[#3a5c3a]/30 sm:w-56"
            />
            <button
              type="submit"
              className="rounded-lg border border-[#3a5c3a]/40 bg-[#1a2e1a]/60 px-4 py-2.5 text-sm font-medium text-stone-300 transition hover:border-[#5a9a5a]/50 hover:bg-[#243a24]/60 hover:text-stone-100"
            >
              Go
            </button>
          </form>
          {toxicWrong && (
            <p className="animate-card-in text-xs font-medium text-red-700/80">
              Nope, try again…
            </p>
          )}
        </div>
      )}

      {doorsOpen && picked === "✈️" && (
        <div className="pointer-events-auto relative z-40 flex w-[min(90vw,36rem)] flex-col items-center gap-4 text-center animate-card-in">
          {planeQuote ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
              >
                <div className="animate-plane-quote-flight absolute left-0 top-1/2">
                  <Image
                    src="/plane.png"
                    alt=""
                    width={1536}
                    height={1024}
                    priority
                    sizes="(max-width: 640px) 56vw, 360px"
                    className="h-auto w-[min(56vw,22rem)] object-contain drop-shadow-[0_1rem_1.5rem_rgba(0,0,0,0.55)]"
                  />
                </div>
              </div>
              <p
                className={`text-xs uppercase tracking-[0.25em] text-[#8a7a60] transition-opacity duration-500 ${typedPlaneQuote ? "opacity-100" : "opacity-0"}`}
              >
                Quote of the day
              </p>
              <blockquote
                aria-live="polite"
                aria-label={
                  planeFlightDone ? planeQuote : "Quote is being revealed"
                }
                className={`min-h-24 text-xl font-medium leading-relaxed text-stone-200 transition-opacity duration-300 sm:text-2xl ${typedPlaneQuote ? "opacity-100" : "opacity-0"}`}
              >
                <span aria-hidden>&ldquo;{typedPlaneQuote}</span>
                {!planeFlightDone && typedPlaneQuote && (
                  <span
                    aria-hidden
                    className="ml-0.5 inline-block h-[1.1em] w-px animate-pulse bg-[#dfc77d] align-[-0.15em]"
                  />
                )}
                <span aria-hidden>{planeFlightDone ? "”" : ""}</span>
              </blockquote>
              {planeFlightDone && (
                <PlaneAnswerReveal
                  answers={planeAnswers}
                  onDone={() => window.location.reload()}
                />
              )}
            </>
          ) : (
            <>
              <p className="text-lg font-semibold tracking-wide text-stone-200">
                Enter the flight code
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePlaneSubmit();
                }}
                className="flex flex-col items-center gap-3"
              >
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  maxLength={3}
                  pattern="[0-9]{3}"
                  aria-label="Three-digit flight code"
                  value={planePassword}
                  onChange={(event) => {
                    setPlanePassword(
                      event.target.value.replace(/\D/g, "").slice(0, 3),
                    );
                    setPlaneError(null);
                  }}
                  className="w-40 rounded-lg border border-[#c9a84c]/35 bg-[#100c08]/85 px-4 py-3 text-center font-mono text-lg tracking-[0.6em] text-stone-100 shadow-inner shadow-black/40 outline-none transition focus:border-[#c9a84c]/70 focus:ring-2 focus:ring-[#c9a84c]/20"
                />
                <button
                  type="submit"
                  disabled={planeLoading}
                  className="rounded-lg border border-[#c9a84c]/40 bg-[#20180e]/70 px-5 py-2.5 text-sm font-semibold text-[#dfc77d] transition hover:border-[#c9a84c]/70 hover:bg-[#2a2012] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {planeLoading ? "Checking..." : "Unlock"}
                </button>
              </form>
              {planeError && (
                <p className="animate-card-in text-xs font-medium text-red-700/90">
                  {planeError}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* FLYING BROOM (phase 3) */}
      {broomFlying && !smoke && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
        >
          <div className="animate-broom-flight absolute top-1/2">
            <div className="animate-broom-jiggle">
              <Image
                src="/broomer.png"
                alt=""
                width={768}
                height={1152}
                priority
                sizes="(max-width: 640px) 42vw, 300px"
                className="h-auto w-[min(42vw,18rem)] object-contain drop-shadow-[0_1.2rem_1.4rem_rgba(0,0,0,0.55)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* TOXIC SMOKE (phase 4) */}
      {smoke && (
        <div className="pointer-events-none absolute inset-0 z-50">
          <div
            className="animate-smoke absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(20,35,20,0.95) 0%, rgba(30,50,30,0.8) 30%, rgba(25,40,35,0.6) 60%, transparent 100%)",
            }}
          />
          <div
            className="animate-smoke absolute -bottom-24 left-[15%] h-[30rem] w-[30rem] rounded-full bg-[#1a2e1a]/50 blur-[100px]"
            style={{ animationDelay: "0.05s" }}
          />
          <div
            className="animate-smoke absolute -bottom-16 right-[10%] h-[28rem] w-[28rem] rounded-full bg-[#1e321e]/50 blur-[90px]"
            style={{ animationDelay: "0.12s" }}
          />
          <div
            className="animate-smoke absolute bottom-0 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[#223828]/40 blur-[80px]"
            style={{ animationDelay: "0.08s" }}
          />
          <div
            className="animate-smoke absolute bottom-10 left-[35%] h-64 w-64 rounded-full bg-[#1a2e1a]/30 blur-[60px]"
            style={{ animationDelay: "0.18s" }}
          />
        </div>
      )}
    </div>
  );
}
