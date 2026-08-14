"use client";

import { useState } from "react";
import type { Question } from "@/lib/questionnaire";
import { DiabolicalLights } from "@/components/DiabolicalLights";
import { GothicDoor } from "@/components/GothicDoor";
import { GothicDoorClose } from "@/components/GothicDoorClose";
import { Questionnaire } from "@/components/Questionnaire";

interface Props {
  questions: Question[];
}

export function QuestionnaireEntrance({ questions }: Readonly<Props>) {
  const [stage, setStage] = useState<"door" | "lights" | "questions">("door");
  const [lightsOn, setLightsOn] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loopKey, setLoopKey] = useState(0);

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
      {lightsOn && (
        <div aria-hidden className="candle-lighting fixed inset-0 z-[1]" />
      )}
      {stage === "door" && (
        <GothicDoor key={`door-${loopKey}`} onOpen={() => setStage("lights")} />
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
