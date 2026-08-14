"use client";

import Image from "next/image";
import type { MouseEvent, PointerEvent } from "react";

interface Props {
  onChoose: (enabled: boolean) => void;
}

export function DiabolicalLights({ onChoose }: Readonly<Props>) {
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
