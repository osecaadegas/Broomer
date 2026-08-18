"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PlaneAnswerReveal } from "@/components/PlaneAnswerReveal";
import type { PlaneAnswer } from "@/lib/supabase/types";

interface Props {
  onOpen: () => void;
  onUno: () => void;
  onChess: () => void;
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
  { value: "hint", char: "❓", image: null, label: "Reveal a cryptic clue" },
  { value: "🧹", char: "🧹", image: null, label: "broom" },
];

type DoorSymbol = "upper" | "lower";
type GhostMode = "cross" | "center" | "peek";

const SIGIL_STEP_DEGREES = 45;
const UPPER_SIGIL_TARGET = 180;
const LOWER_SIGIL_TARGET = 360;

function isAligned(rotation: number, target: number): boolean {
  return rotation % 360 === target % 360;
}

const PLANE_QUOTE_DELAY_MS = 3100;
const PLANE_QUOTE_TYPE_MS = 2100;
const PLANE_FLIGHT_MS = 5400;
const GATE_REVEAL_MS = 3100;
const ADMIN_PRESS_MS = 1400;
const ADMIN_CLICK_WINDOW_MS = 1800;
const IDLE_MESSAGES = [
  "A shadow crosses the other side.",
  "The door exhales.",
  "Something has been waiting politely.",
  "The seam remembers your hand.",
  "Iron teeth settle in the dark.",
] as const;

function getIdleEventClass(index: number): string {
  if (index === 0) return "door-idle-shadow";
  if (index === 1) return "door-idle-breath";
  if (index === 3) return "door-idle-fingers";
  return "door-idle-listen";
}

function DoorIdleEvent({
  active,
  index,
  ghostMode,
}: Readonly<{
  active: boolean;
  index: number;
  ghostMode: GhostMode;
}>) {
  if (!active || index < 0) return null;

  return (
    <>
      <div
        key={index}
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-[58] ${getIdleEventClass(index)}`}
      >
        {index === 0 && (
          <div
            className={`dutchman-figure ${
              ghostMode === "center"
                ? "dutchman-center"
                : ghostMode === "peek"
                  ? "dutchman-peek"
                  : "dutchman-crossing"
            }`}
          >
            <div className="dutchman-ghost">
              <span className="ghost-smoke ghost-smoke-one" />
              <span className="ghost-smoke ghost-smoke-two" />
              <span className="ghost-smoke ghost-smoke-three" />
              <span className="ghost-aura" />
              <Image
                src="/flyingshadow.png"
                alt=""
                fill
                sizes="(max-width: 640px) 58vw, 24rem"
                className="ghost-character object-contain"
              />
            </div>
          </div>
        )}
      </div>
      <p
        aria-live="polite"
        className="door-idle-message pointer-events-none absolute left-1/2 top-[22%] z-[64] -translate-x-1/2 whitespace-nowrap font-serif text-xs italic text-[#8a7138]/65"
      >
        {IDLE_MESSAGES[index]}
      </p>
    </>
  );
}

function isEntryRide(value: string): boolean {
  return value === "🧹" || value === "✈️" || value === "uno";
}

function getRideSelectionClass(isValid: boolean, isWrong: boolean): string {
  if (isWrong) {
    return "gate-seal-wrong";
  }
  if (isValid) {
    return "gate-seal-valid";
  }
  return "gate-seal-muted";
}

type AudioContextConstructor = new () => AudioContext;

let gateAudioContext: AudioContext | null = null;

function getGateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const audioWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const AudioConstructor =
    window.AudioContext ?? audioWindow.webkitAudioContext;
  if (!AudioConstructor) return null;
  gateAudioContext ??= new AudioConstructor();
  return gateAudioContext;
}

function envelope(gain: GainNode, time: number, peak: number, end: number) {
  gain.gain.cancelScheduledValues(time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + end);
}

function playGateAtmosphere() {
  const context = getGateAudioContext();
  if (!context) return;

  void context.resume();
  const now = context.currentTime;
  const output = context.createGain();
  output.gain.setValueAtTime(0.08, now);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
  output.connect(context.destination);

  const rumble = context.createOscillator();
  const rumbleGain = context.createGain();
  rumble.type = "sine";
  rumble.frequency.setValueAtTime(38, now);
  rumble.frequency.linearRampToValueAtTime(31, now + 2.8);
  envelope(rumbleGain, now + 0.45, 0.46, 2.7);
  rumble.connect(rumbleGain).connect(output);
  rumble.start(now + 0.45);
  rumble.stop(now + 3.25);

  const thump = context.createOscillator();
  const thumpGain = context.createGain();
  thump.type = "triangle";
  thump.frequency.setValueAtTime(92, now + 0.42);
  thump.frequency.exponentialRampToValueAtTime(44, now + 0.82);
  envelope(thumpGain, now + 0.42, 0.58, 0.74);
  thump.connect(thumpGain).connect(output);
  thump.start(now + 0.42);
  thump.stop(now + 1.15);

  const creak = context.createOscillator();
  const creakGain = context.createGain();
  const creakFilter = context.createBiquadFilter();
  creak.type = "sawtooth";
  creak.frequency.setValueAtTime(128, now + 1.2);
  creak.frequency.linearRampToValueAtTime(73, now + 2.9);
  creakFilter.type = "bandpass";
  creakFilter.frequency.setValueAtTime(650, now + 1.2);
  creakFilter.frequency.linearRampToValueAtTime(310, now + 2.9);
  creakFilter.Q.setValueAtTime(8, now + 1.2);
  envelope(creakGain, now + 1.2, 0.12, 1.85);
  creak.connect(creakFilter).connect(creakGain).connect(output);
  creak.start(now + 1.2);
  creak.stop(now + 3.15);

  const noiseLength = Math.floor(context.sampleRate * 2.4);
  const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseLength; index += 1) {
    noiseData[index] = (Math.random() * 2 - 1) * 0.24;
  }
  const wind = context.createBufferSource();
  const windGain = context.createGain();
  const windFilter = context.createBiquadFilter();
  wind.buffer = noiseBuffer;
  windFilter.type = "lowpass";
  windFilter.frequency.setValueAtTime(520, now + 0.92);
  windFilter.frequency.linearRampToValueAtTime(190, now + 2.8);
  envelope(windGain, now + 0.92, 0.13, 2.1);
  wind.connect(windFilter).connect(windGain).connect(output);
  wind.start(now + 0.92);
}

function playIdleDoorCreak() {
  const context = getGateAudioContext();
  if (!context) return;

  void context.resume().catch(() => undefined);
  const now = context.currentTime;
  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.045, now + 0.08);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);
  output.connect(context.destination);

  const groan = context.createOscillator();
  const groanGain = context.createGain();
  const groanFilter = context.createBiquadFilter();
  groan.type = "sawtooth";
  groan.frequency.setValueAtTime(66, now);
  groan.frequency.linearRampToValueAtTime(41, now + 1.55);
  groanFilter.type = "bandpass";
  groanFilter.frequency.setValueAtTime(360, now);
  groanFilter.frequency.linearRampToValueAtTime(190, now + 1.55);
  groanFilter.Q.setValueAtTime(9, now);
  envelope(groanGain, now + 0.12, 0.16, 1.55);
  groan.connect(groanFilter).connect(groanGain).connect(output);
  groan.start(now + 0.05);
  groan.stop(now + 1.85);

  const scrapeLength = Math.floor(context.sampleRate * 1.6);
  const scrapeBuffer = context.createBuffer(
    1,
    scrapeLength,
    context.sampleRate,
  );
  const scrapeData = scrapeBuffer.getChannelData(0);
  for (let index = 0; index < scrapeLength; index += 1) {
    scrapeData[index] = (Math.random() * 2 - 1) * 0.16;
  }
  const scrape = context.createBufferSource();
  const scrapeGain = context.createGain();
  const scrapeFilter = context.createBiquadFilter();
  scrape.buffer = scrapeBuffer;
  scrapeFilter.type = "highpass";
  scrapeFilter.frequency.setValueAtTime(840, now);
  scrapeFilter.frequency.linearRampToValueAtTime(460, now + 1.45);
  envelope(scrapeGain, now + 0.26, 0.035, 1.2);
  scrape.connect(scrapeFilter).connect(scrapeGain).connect(output);
  scrape.start(now + 0.24);
}

export function GothicDoor({
  onOpen,
  onUno,
  onChess,
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
  const [upperSigilRotation, setUpperSigilRotation] = useState(45);
  const [lowerSigilRotation, setLowerSigilRotation] = useState(225);
  const [symbolsAwake, setSymbolsAwake] = useState(false);
  const [idleEventIndex, setIdleEventIndex] = useState(-1);
  const [idleEventActive, setIdleEventActive] = useState(false);
  const [idleGhostMode, setIdleGhostMode] = useState<GhostMode>("center");
  const adminPressTimerRef = useRef<number | null>(null);
  const adminClicksRef = useRef({ count: 0, firstAt: 0 });

  function handlePick(char: string) {
    if (sliding) return;
    setPicked(char);
    if (!isEntryRide(char)) return;

    playGateAtmosphere();
    setSliding(true);
    window.setTimeout(() => {
      if (char === "uno") onUno();
      else setDoorsOpen(true);
    }, GATE_REVEAL_MS);
  }

  function handleSymbolRotate(symbol: DoorSymbol) {
    if (sliding || symbolsAwake) return;

    const nextUpperRotation =
      symbol === "upper"
        ? upperSigilRotation + SIGIL_STEP_DEGREES
        : upperSigilRotation;
    const nextLowerRotation =
      symbol === "lower"
        ? lowerSigilRotation + SIGIL_STEP_DEGREES
        : lowerSigilRotation;

    setUpperSigilRotation(nextUpperRotation);
    setLowerSigilRotation(nextLowerRotation);

    if (
      isAligned(nextUpperRotation, UPPER_SIGIL_TARGET) &&
      isAligned(nextLowerRotation, LOWER_SIGIL_TARGET)
    ) {
      setSymbolsAwake(true);
      setSliding(true);
      playGateAtmosphere();
      if (navigator.userActivation?.isActive) {
        navigator.vibrate?.([40, 50, 90]);
      }
      window.setTimeout(onChess, GATE_REVEAL_MS);
    }
  }

  function clearAdminPressTimer() {
    if (adminPressTimerRef.current == null) return;
    window.clearTimeout(adminPressTimerRef.current);
    adminPressTimerRef.current = null;
  }

  function openAdminGate() {
    window.location.assign("/admin");
  }

  function handleFleurPointerDown() {
    if (sliding) return;
    clearAdminPressTimer();
    adminPressTimerRef.current = window.setTimeout(
      openAdminGate,
      ADMIN_PRESS_MS,
    );
  }

  function handleFleurPointerUp() {
    clearAdminPressTimer();
    const now = performance.now();
    const clicks = adminClicksRef.current;
    if (now - clicks.firstAt > ADMIN_CLICK_WINDOW_MS) {
      clicks.count = 0;
      clicks.firstAt = now;
    }

    clicks.count += 1;
    if (clicks.count >= 5) {
      openAdminGate();
    }
  }

  function handleFleurKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleFleurPointerUp();
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
      if (adminPressTimerRef.current != null) {
        window.clearTimeout(adminPressTimerRef.current);
        adminPressTimerRef.current = null;
      }
    };
  }, [gone]);

  useEffect(() => {
    if (sliding) return;

    let idleTimer = 0;
    let clearTimer = 0;
    let previousEventIndex = -1;

    const pickIdleEvent = () => {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      let nextIndex = buffer[0] % IDLE_MESSAGES.length;
      if (nextIndex === previousEventIndex) {
        nextIndex = (nextIndex + 1) % IDLE_MESSAGES.length;
      }
      previousEventIndex = nextIndex;
      return nextIndex;
    };

    const pickGhostMode = (): GhostMode => {
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      const modes: GhostMode[] = ["center", "center", "cross", "peek"];
      return modes[buffer[0] % modes.length];
    };

    const nextDelay = (isFirst = false) => {
      if (isFirst) return 1800;
      const buffer = new Uint32Array(1);
      crypto.getRandomValues(buffer);
      return 6500 + (buffer[0] % 9000);
    };

    let shouldShowDutchmanFirst = true;
    const revealIdleEvent = () => {
      const eventIndex = shouldShowDutchmanFirst ? 0 : pickIdleEvent();
      shouldShowDutchmanFirst = false;
      if (eventIndex === 0) {
        const nextGhostMode = pickGhostMode();
        setIdleGhostMode(nextGhostMode);
        if (nextGhostMode === "peek") {
          playIdleDoorCreak();
        }
      }
      setIdleEventIndex(eventIndex);
      setIdleEventActive(true);
      clearTimer = window.setTimeout(
        () => {
          setIdleEventActive(false);
          idleTimer = window.setTimeout(revealIdleEvent, nextDelay());
        },
        eventIndex === 0 ? 9400 : 4000,
      );
    };

    const markActive = () => {
      window.clearTimeout(idleTimer);
      window.clearTimeout(clearTimer);
      shouldShowDutchmanFirst = false;
      void getGateAudioContext()?.resume().catch(() => undefined);
      setIdleEventActive(false);
      idleTimer = window.setTimeout(revealIdleEvent, nextDelay());
    };

    idleTimer = window.setTimeout(revealIdleEvent, nextDelay(true));
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
    <div
      className={`cursed-gate fixed inset-0 z-50 flex items-center justify-center bg-[#05030a] ${
        sliding ? "gate-opening" : ""
      } ${doorsOpen ? "gate-destination-visible" : ""} ${
        idleEventActive && idleEventIndex === 0 && idleGhostMode === "peek"
          ? "gate-idle-peek"
          : ""
      }`}
    >
      <div aria-hidden className="gate-beyond pointer-events-none absolute inset-0" />
      <div aria-hidden className="gate-ambient pointer-events-none absolute inset-0" />
      <div aria-hidden className="gate-film-grain pointer-events-none absolute inset-0" />
      <div aria-hidden className="gate-heavy-vignette pointer-events-none absolute inset-0" />
      <div aria-hidden className="gate-edge-smoke pointer-events-none absolute inset-0" />
      <DoorIdleEvent
        active={idleEventActive}
        index={idleEventIndex}
        ghostMode={idleGhostMode}
      />

      {/* LEFT DOOR */}
      <div
        className={`gate-door gate-door-left absolute inset-y-0 left-0 z-20 flex w-1/2 ${
          sliding ? "animate-slide-left" : ""
        }`}
      >
        <div className="gate-door-surface gate-door-surface-left relative h-full w-full overflow-hidden border-r border-[#0a0705] bg-gradient-to-b from-[#10090c] via-[#0c0609] to-[#080407]">
          <div
            aria-hidden
            className="gate-door-grain pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(200,170,120,0.5) 0px, transparent 1px, transparent 3px)",
            }}
          />
          <div aria-hidden className="gate-door-engraving gate-door-engraving-left" />
          <div className="gate-door-arch pointer-events-none absolute -top-px left-0 right-0 h-40">
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
          <span aria-hidden className="gate-scratch gate-scratch-one" />
          <span aria-hidden className="gate-scratch gate-scratch-two" />
        </div>
      </div>

      {/* RIGHT DOOR */}
      <div
        className={`gate-door gate-door-right absolute inset-y-0 right-0 z-20 flex w-1/2 ${
          sliding ? "animate-slide-right" : ""
        }`}
      >
        <div className="gate-door-surface gate-door-surface-right relative h-full w-full overflow-hidden border-l border-[#0a0705] bg-gradient-to-b from-[#10090c] via-[#0c0609] to-[#080407]">
          <div
            aria-hidden
            className="gate-door-grain pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(200,170,120,0.5) 0px, transparent 1px, transparent 3px)",
            }}
          />
          <div aria-hidden className="gate-door-engraving gate-door-engraving-right" />
          <div className="gate-door-arch pointer-events-none absolute -top-px left-0 right-0 h-40">
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
          <span aria-hidden className="gate-scratch gate-scratch-three" />
          <span aria-hidden className="gate-scratch gate-scratch-four" />
        </div>
      </div>

      {/* CENTER SEAM */}
      <div className="gate-seam-layer pointer-events-none absolute inset-0 z-50">
        <div
          aria-hidden
          className={`gate-center-crack ${
            sliding || symbolsAwake ? "gate-center-crack-awake" : ""
          }`}
        >
          <span className="gate-seam-fog gate-seam-fog-one" />
          <span className="gate-seam-fog gate-seam-fog-two" />
          <span className="gate-seam-fog gate-seam-fog-three" />
        </div>
        <button
          type="button"
          onClick={() => handleSymbolRotate("upper")}
          aria-label="Rotate upper door sigil clockwise"
          aria-pressed={isAligned(upperSigilRotation, UPPER_SIGIL_TARGET)}
          className="door-sigil-upper gate-lock-sigil pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a7138]"
          style={{
            filter: `drop-shadow(0 0 ${isAligned(upperSigilRotation, UPPER_SIGIL_TARGET) ? 8 : 1}px rgba(217,188,101,${symbolsAwake ? 0.55 : 0.22}))`,
          }}
        >
          <svg
            viewBox="0 0 40 50"
            className="h-10 w-10 transition-transform duration-500 ease-out"
            fill="none"
            style={{ transform: `rotate(${upperSigilRotation}deg)` }}
          >
            <path
              d="M20 2 L26 18 L38 22 L26 26 L28 42 L20 34 L12 42 L14 26 L2 22 L14 18 Z"
              fill="rgba(107,85,40,0.16)"
              stroke="rgba(138,113,56,0.42)"
              strokeWidth="1"
            />
            <circle
              cx="20"
              cy="22"
              r="4"
              fill="rgba(24,17,10,0.55)"
              stroke="rgba(138,113,56,0.28)"
              strokeWidth="0.8"
            />
          </svg>
        </button>
        <button
          type="button"
          onPointerDown={handleFleurPointerDown}
          onPointerUp={handleFleurPointerUp}
          onPointerCancel={clearAdminPressTimer}
          onPointerLeave={clearAdminPressTimer}
          onKeyDown={handleFleurKeyDown}
          aria-label="Dormant fleur-de-lis seal"
          tabIndex={sliding ? -1 : 0}
          className={`gate-fleur pointer-events-auto grid h-14 w-14 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8a7138] ${sliding ? "pointer-events-none" : ""}`}
        >
          <span className="text-xl">⚜️</span>
        </button>
        <button
          type="button"
          onClick={() => handleSymbolRotate("lower")}
          aria-label="Rotate lower door sigil clockwise"
          aria-pressed={isAligned(lowerSigilRotation, LOWER_SIGIL_TARGET)}
          className="door-sigil-lower gate-lock-sigil pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full transition duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a7138]"
          style={{
            filter: `drop-shadow(0 0 ${isAligned(lowerSigilRotation, LOWER_SIGIL_TARGET) ? 8 : 1}px rgba(217,188,101,${symbolsAwake ? 0.55 : 0.22}))`,
          }}
        >
          <svg
            viewBox="0 0 40 50"
            className="h-10 w-10 transition-transform duration-500 ease-out"
            fill="none"
            style={{ transform: `rotate(${lowerSigilRotation}deg)` }}
          >
            <path
              d="M20 2 L26 18 L38 22 L26 26 L28 42 L20 34 L12 42 L14 26 L2 22 L14 18 Z"
              fill="rgba(107,85,40,0.16)"
              stroke="rgba(138,113,56,0.42)"
              strokeWidth="1"
            />
            <circle
              cx="20"
              cy="22"
              r="4"
              fill="rgba(24,17,10,0.55)"
              stroke="rgba(138,113,56,0.28)"
              strokeWidth="0.8"
            />
          </svg>
        </button>
      </div>

      {/* PASSAGE SEALS (phase 1) */}
      {!doorsOpen && (
        <div
          className={`gate-choice-panel pointer-events-auto relative z-40 flex flex-col items-center gap-5 ${
            sliding ? "gate-choice-panel-opening" : ""
          }`}
        >
          <p className="gate-choice-title text-xs uppercase tracking-[0.25em]">
            Choose your passage
          </p>
          {(isAligned(upperSigilRotation, UPPER_SIGIL_TARGET) ||
            isAligned(lowerSigilRotation, LOWER_SIGIL_TARGET)) &&
            !symbolsAwake && (
            <p className="animate-card-in font-serif text-xs italic text-[#9f895d]/70">
              One seal holds its gaze.
            </p>
          )}
          {symbolsAwake && (
            <p className="animate-card-in font-serif text-sm italic text-[#8a7138]">
              A rival answers.
            </p>
          )}
          <div className="gate-seal-grid grid grid-cols-2">
            {rides.map((ride) => {
              const isValid = isEntryRide(ride.value);
              const isWrong =
                picked === ride.value && !isValid && ride.value !== "hint";
              const selectionClass = getRideSelectionClass(isValid, isWrong);
              return (
                <button
                  key={ride.value}
                  type="button"
                  onClick={() => handlePick(ride.value)}
                  aria-label={ride.label}
                  disabled={sliding}
                  className={`gate-seal group relative flex h-16 w-16 items-center justify-center transition-all duration-300 sm:h-20 sm:w-20 ${selectionClass} ${
                    picked === ride.value ? "gate-seal-picked" : ""
                  }`}
                >
                  {ride.image ? (
                    <Image
                      src={ride.image}
                      alt=""
                      width={404}
                      height={608}
                      loading="eager"
                      sizes="40px"
                      className="gate-seal-image pointer-events-none h-9 w-auto object-contain sm:h-10"
                    />
                  ) : (
                    <span className="gate-seal-symbol">{ride.char}</span>
                  )}
                  {isValid && !sliding && (
                    <span className="gate-seal-dormant-pulse pointer-events-none absolute inset-0" />
                  )}
                </button>
              );
            })}
          </div>
          {picked === "hint" && (
            <p className="animate-card-in max-w-52 text-center font-serif text-xs italic leading-relaxed text-[#8a7138]/80">
              Two seals guard the fleur. Turn their longest points toward its
              heart.
            </p>
          )}
          {picked !== null &&
            picked !== "hint" &&
            picked !== "🧹" &&
            picked !== "✈️" &&
            picked !== "uno" && (
              <p className="animate-card-in text-xs font-medium text-red-800/70">
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
