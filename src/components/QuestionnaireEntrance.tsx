"use client";

import { useRef, useState } from "react";
import type { Question } from "@/lib/questionnaire";
import { DiabolicalLights } from "@/components/DiabolicalLights";
import { GothicDoor } from "@/components/GothicDoor";
import { GothicDoorClose } from "@/components/GothicDoorClose";
import { Questionnaire } from "@/components/Questionnaire";

interface Props {
  questions: Question[];
}

export function QuestionnaireEntrance({ questions }: Readonly<Props>) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [stage, setStage] = useState<"door" | "lights" | "questions">("door");
  const [lightsOn, setLightsOn] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  const [musicStarted, setMusicStarted] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);

  function prepareMusic() {
    const audio = audioRef.current;
    if (!audio || musicStarted) return;

    audio.volume = 0.01;
    audio.muted = true;
    void audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    }).catch(() => {
      // Playback can still be started from the music control if blocked.
    });
  }

  function startMusic() {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.01;
    audio.muted = false;
    void audio.play().then(() => {
      setMusicStarted(true);
      setMusicMuted(false);
    }).catch(() => {
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

  function handleSubmitted() {
    // Let the ending animation play, then close the doors for the loop.
    setTimeout(() => setClosing(true), 5000);
  }

  function handleClosed() {
    setClosing(false);
    setStage("door");
    setLightsOn(false);
    setLoopKey((prev) => prev + 1);
  }

  function handleLights(enabled: boolean) {
    setLightsOn(enabled);
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
      {musicStarted && (
        <button
          type="button"
          onClick={toggleMusic}
          aria-label={musicMuted ? "Turn background music on" : "Mute background music"}
          title={musicMuted ? "Turn music on" : "Mute music"}
          className="fixed bottom-4 right-4 z-[70] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/55 text-base text-stone-200 shadow-lg shadow-black/30 backdrop-blur-md transition hover:border-white/30 hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c9a84c]"
        >
          <span aria-hidden>{musicMuted ? "🔇" : "🔊"}</span>
        </button>
      )}
      {lightsOn && (
        <div aria-hidden className="candle-lighting fixed inset-0 z-[1]" />
      )}
      {stage === "door" && (
        <GothicDoor
          key={`door-${loopKey}`}
          onOpen={() => setStage("lights")}
          onPrepareMusic={prepareMusic}
          onStartMusic={startMusic}
        />
      )}
      {stage === "lights" && <DiabolicalLights onChoose={handleLights} />}
      {stage === "questions" && (
        <div className="relative z-10 w-full animate-question-reveal">
          <Questionnaire
            key={loopKey}
            questions={questions}
            onSubmitted={handleSubmitted}
          />
        </div>
      )}
      {closing && <GothicDoorClose onDone={handleClosed} />}
    </>
  );
}
