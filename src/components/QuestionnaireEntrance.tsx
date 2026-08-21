"use client";

import { useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/questionnaire";
import { DiabolicalLights } from "@/components/DiabolicalLights";
import { GothicDoor } from "@/components/GothicDoor";
import { GothicDoorClose } from "@/components/GothicDoorClose";
import { KissFinale } from "@/components/KissFinale";
import { ChessGame } from "@/components/ChessGame";
import { Questionnaire } from "@/components/Questionnaire";
import { SpongeCardGame } from "@/components/SpongeCardGame";
import { UnoQuestionBuilder } from "@/components/UnoQuestionBuilder";

interface Props {
  questions: Question[];
}

const CHESS_TRANSITION_MS = 4300;

const CHESS_BUBBLES = Array.from({ length: 184 }, (_, index) => ({
  id: index,
  left: (index * 29 + (index % 13) * 7) % 100,
  bottom: -18 - ((index * 11) % 46),
  size: 3 + ((index * 17) % 34),
  delay: (index % 42) * 0.034,
  duration: 2.65 + ((index * 19) % 24) * 0.05,
  drift: ((index * 23) % 150) - 75,
  opacity: 0.34 + ((index * 7) % 28) / 100,
  startScale: 0.24 + ((index * 5) % 18) / 100,
  endScale: 0.92 + ((index * 3) % 24) / 100,
}));

function ChessBubbleTransition() {
  return (
    <div
      aria-hidden
      className="chess-bubble-transition pointer-events-none fixed inset-0 z-[100] overflow-hidden"
    >
      <div className="chess-bubble-water absolute inset-0" />
      {CHESS_BUBBLES.map((bubble) => (
        <span
          key={bubble.id}
          className="chess-transition-bubble absolute rounded-full"
          style={
            {
              left: `${bubble.left}%`,
              bottom: `${bubble.bottom}px`,
              width: bubble.size,
              height: bubble.size,
              animationDelay: `${bubble.delay}s`,
              animationDuration: `${bubble.duration}s`,
              "--bubble-drift": `${bubble.drift}px`,
              "--bubble-opacity": bubble.opacity,
              "--bubble-start-scale": bubble.startScale,
              "--bubble-end-scale": bubble.endScale,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function QuestionnaireEntrance({ questions }: Readonly<Props>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const kissAudioRef = useRef<HTMLAudioElement>(null);
  const finaleAnimationDoneRef = useRef(false);
  const finaleSoundDoneRef = useRef(false);
  const finaleStartedRef = useRef(false);
  const [stage, setStage] = useState<
    "door" | "lights" | "questions" | "author" | "chess" | "cards"
  >("door");
  const [lightsOn, setLightsOn] = useState(false);
  const [closing, setClosing] = useState(false);
  const [finale, setFinale] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  const [musicStarted, setMusicStarted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [enchanted, setEnchanted] = useState(false);
  const [chessRevealing, setChessRevealing] = useState(false);

  useEffect(() => {
    if (!chessRevealing) return;
    const timer = window.setTimeout(
      () => setChessRevealing(false),
      CHESS_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [chessRevealing]);

  function revealChess() {
    setChessRevealing(true);
    setStage("chess");
  }

  function prepareMusic() {
    const audio = audioRef.current;
    if (!audio || musicStarted) return;

    audio.volume = 0.01;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        // Playback can still be started from the music control if blocked.
      });
  }

  function startMusic() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.01;
    audio.muted = false;
    void audio
      .play()
      .then(() => {
        setMusicStarted(true);
        setMusicMuted(false);
      })
      .catch(() => {
        // Browsers may still block playback when user media settings forbid it.
      });
  }

  function toggleMusic() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!musicStarted) {
      startMusic();
      return;
    }

    audio.muted = !audio.muted;
    setMusicMuted(audio.muted);
  }

  function prepareFinale() {
    const audio = kissAudioRef.current;
    if (!audio) return;

    finaleStartedRef.current = false;
    audio.volume = 0.55;
    audio.muted = true;
    void audio
      .play()
      .then(() => {
        if (finaleStartedRef.current) return;
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      })
      .catch(() => {
        // The visual finale still completes if media playback is unavailable.
      });
  }

  function completeFinalePart(part: "animation" | "sound") {
    if (part === "animation") finaleAnimationDoneRef.current = true;
    if (part === "sound") finaleSoundDoneRef.current = true;
    if (!finaleAnimationDoneRef.current || !finaleSoundDoneRef.current) return;

    setFinale(false);
    setClosing(true);
  }

  function handleSubmitted() {
    const audio = kissAudioRef.current;
    finaleStartedRef.current = true;
    finaleAnimationDoneRef.current = false;
    finaleSoundDoneRef.current = false;
    setFinale(true);

    if (!audio) {
      completeFinalePart("sound");
      return;
    }

    audio.currentTime = 0;
    audio.volume = 0.55;
    audio.muted = false;
    void audio.play().catch(() => completeFinalePart("sound"));
  }

  function handleClosed() {
    finaleStartedRef.current = false;
    setClosing(false);
    setStage("door");
    setLightsOn(false);
    setEnchanted(false);
    setLoopKey((prev) => prev + 1);
  }

  function handleLights(enabled: boolean, spellAwake = false) {
    setLightsOn(enabled);
    setEnchanted(spellAwake);
    if (spellAwake) startMusic();
    setStage("questions");
  }

  return (
    <>
      <audio
        ref={audioRef}
        src="/Mozart%20-%20Symphony%20No.%2040%20(Molto%20Allegro).mp3"
        loop
        preload="auto"
      />
      <audio
        ref={kissAudioRef}
        src="/Kiss%20Sound%20Effect.mp3"
        preload="auto"
        onEnded={() => completeFinalePart("sound")}
        onError={() => completeFinalePart("sound")}
      />
      {musicStarted && (
        <button
          type="button"
          onClick={toggleMusic}
          aria-label={
            musicMuted ? "Turn background music on" : "Mute background music"
          }
          title={musicMuted ? "Turn music on" : "Mute music"}
          className="fixed bottom-4 right-4 z-[70] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/55 text-base text-stone-200 shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-white/30 hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
        >
          <span aria-hidden>{musicMuted ? "🔇" : "🔊"}</span>
        </button>
      )}
      {lightsOn && (
        <div
          aria-hidden
          className={`candle-lighting fixed inset-0 z-[1] ${
            enchanted ? "candle-lighting-enchanted" : ""
          }`}
        />
      )}
      {stage === "questions" && !lightsOn && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_25%,rgba(83,46,104,0.12),transparent_32%),linear-gradient(115deg,rgba(0,0,0,0.24),transparent_42%,rgba(0,0,0,0.3))]"
        />
      )}
      {stage === "door" && (
        <GothicDoor
          key={`door-${loopKey}`}
          onOpen={() => setStage("lights")}
          onUno={() => setStage("author")}
          onChess={revealChess}
          onCards={() => setStage("cards")}
          onPrepareMusic={prepareMusic}
          onStartMusic={startMusic}
        />
      )}
      {stage === "lights" && (
        <DiabolicalLights
          onChoose={handleLights}
          candleQuestionCounts={[1, 2, 3, 4, 5].map(
            (gate) =>
              questions.filter((question) => question.candleGate === gate)
                .length,
          )}
        />
      )}
      {stage === "author" && (
        <UnoQuestionBuilder onCancel={() => window.location.reload()} />
      )}
      {stage === "chess" && (
        <ChessGame
          onExit={() => {
            setChessRevealing(false);
            setStage("door");
          }}
        />
      )}
      {stage === "chess" && chessRevealing && <ChessBubbleTransition />}
      {stage === "cards" && <SpongeCardGame onExit={() => setStage("door")} />}
      {stage === "questions" && (
        <div className="relative z-10 w-full animate-question-reveal">
          <Questionnaire
            key={loopKey}
            questions={questions}
            lightsOn={lightsOn}
            enchanted={enchanted}
            onPrepareFinale={prepareFinale}
            onSubmitted={handleSubmitted}
          />
        </div>
      )}
      {finale && (
        <KissFinale onAnimationDone={() => completeFinalePart("animation")} />
      )}
      {closing && <GothicDoorClose onDone={handleClosed} />}
    </>
  );
}
