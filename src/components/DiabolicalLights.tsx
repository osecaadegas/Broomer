"use client";

import Image from "next/image";
import { useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

interface Props {
  onChoose: (enabled: boolean, enchanted?: boolean) => void;
}

const SPELL_SEQUENCE = [2, 1, 3, 0, 4] as const;
const CANDLE_HEIGHTS = [3.25, 3.8, 4.5, 3.8, 3.25] as const;

export function DiabolicalLights({ onChoose }: Readonly<Props>) {
  const [litCandles, setLitCandles] = useState<number[]>([]);
  const [spellAwake, setSpellAwake] = useState(false);
  const [spellMessage, setSpellMessage] = useState<string | null>(null);

  function lightCandle(index: number) {
    if (spellAwake || litCandles.includes(index)) return;

    const expected = SPELL_SEQUENCE[litCandles.length];
    if (index !== expected) {
      setLitCandles(index === SPELL_SEQUENCE[0] ? [index] : []);
      setSpellMessage("The flames forget the pattern.");
      return;
    }

    const next = [...litCandles, index];
    setLitCandles(next);
    setSpellMessage(
      next.length < SPELL_SEQUENCE.length
        ? "The next flame is listening."
        : "The room remembers your name.",
    );

    if (next.length === SPELL_SEQUENCE.length) {
      setSpellAwake(true);
      window.setTimeout(() => onChoose(true, true), 1100);
    }
  }

  function chooseWithPointer(
    enabled: boolean,
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) return;
    onChoose(enabled);
  }

  function chooseWithKeyboard(
    enabled: boolean,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    if (event.detail === 0) onChoose(enabled);
  }

  return (
    <section
      aria-labelledby="lights-question"
      className="animate-lights-prelude relative z-10 flex min-h-[min(32rem,calc(100svh-5rem))] w-full flex-col items-center justify-center px-2 py-6 text-center"
    >
      <h1
        id="lights-question"
        className="diabolical-title max-w-sm text-3xl leading-tight sm:text-4xl"
      >
        Starting diabolically, lights?
      </h1>

      <fieldset className="diabolical-switch mt-8">
        <legend className="sr-only">Turn candle lighting off or on</legend>
        <button
          type="button"
          className="diabolical-switch-side diabolical-switch-off"
          onPointerDown={(event) => chooseWithPointer(false, event)}
          onClick={(event) => chooseWithKeyboard(false, event)}
        >
          OFF
        </button>
        <button
          type="button"
          className="diabolical-switch-side diabolical-switch-on"
          onPointerDown={(event) => chooseWithPointer(true, event)}
          onClick={(event) => chooseWithKeyboard(true, event)}
        >
          ON
        </button>
      </fieldset>

      <div
        className="mt-7 flex h-20 w-full max-w-sm items-end justify-center gap-3 sm:gap-5"
        aria-label="Five ritual candles"
      >
        {[0, 1, 2, 3, 4].map((index) => {
          const lit = litCandles.includes(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => lightCandle(index)}
              aria-label={`${lit ? "Lit" : "Unlit"} ritual candle ${index + 1}`}
              aria-pressed={lit}
              className={`ritual-candle ${lit ? "ritual-candle-lit" : ""} ${
                spellAwake ? "ritual-candle-awake" : ""
              }`}
              style={{ height: `${CANDLE_HEIGHTS[index]}rem` }}
            >
              <span className="ritual-flame" aria-hidden />
              <span className="ritual-wick" aria-hidden />
            </button>
          );
        })}
      </div>

      <p
        aria-live="polite"
        className={`mt-3 min-h-5 font-serif text-xs italic transition-colors ${
          spellAwake ? "text-[#f0d586]" : "text-[#9f895d]/75"
        }`}
      >
        {spellMessage}
      </p>

      <Image
        src="/spongebob.png"
        alt="SpongeBob presenting a gift"
        width={1200}
        height={713}
        priority
        sizes="(max-width: 640px) 62vw, 256px"
        className="diabolical-spongebob mt-8 h-auto w-[min(62vw,16rem)] object-contain"
      />
    </section>
  );
}
