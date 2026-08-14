"use client";

interface Props {
  onChoose: (enabled: boolean) => void;
}

export function DiabolicalLights({ onChoose }: Readonly<Props>) {
  return (
    <section
      aria-labelledby="lights-question"
      className="animate-lights-prelude relative z-10 flex min-h-72 flex-col items-center justify-center text-center"
    >
      <h1
        id="lights-question"
        className="diabolical-title max-w-sm text-3xl leading-tight sm:text-4xl"
      >
        Starting diabolically, lights?
      </h1>

      <div
        className="diabolical-switch mt-10"
        role="group"
        aria-label="Turn candle lighting off or on"
      >
        <button
          type="button"
          className="diabolical-switch-side diabolical-switch-off"
          onClick={() => onChoose(false)}
        >
          OFF
        </button>
        <button
          type="button"
          className="diabolical-switch-side diabolical-switch-on"
          onClick={() => onChoose(true)}
        >
          ON
        </button>
      </div>
    </section>
  );
}
