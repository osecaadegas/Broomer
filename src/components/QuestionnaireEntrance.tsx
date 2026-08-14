"use client";

import { useState } from "react";
import type { Question } from "@/lib/questionnaire";
import { GothicDoor } from "@/components/GothicDoor";
import { GothicDoorClose } from "@/components/GothicDoorClose";
import { Questionnaire } from "@/components/Questionnaire";

interface Props {
  questions: Question[];
}

export function QuestionnaireEntrance({ questions }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [closing, setClosing] = useState(false);
  const [loopKey, setLoopKey] = useState(0);

  function handleSubmitted() {
    // Let the ending animation play, then close the doors for the loop.
    setTimeout(() => setClosing(true), 5000);
  }

  function handleClosed() {
    setClosing(false);
    setUnlocked(false);
    setLoopKey((prev) => prev + 1);
  }

  return (
    <>
      {!unlocked && (
        <GothicDoor key={`door-${loopKey}`} onOpen={() => setUnlocked(true)} />
      )}
      <div
        className={`w-full ${
          unlocked ? "animate-question-reveal" : "opacity-0"
        }`}
      >
        <Questionnaire
          key={loopKey}
          questions={questions}
          onSubmitted={handleSubmitted}
        />
      </div>
      {closing && <GothicDoorClose onDone={handleClosed} />}
    </>
  );
}
