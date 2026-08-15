"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export function SessionLock({ children }: Readonly<{ children: ReactNode }>) {
  const [locking, setLocking] = useState(false);
  const timeoutMsRef = useRef(INACTIVITY_TIMEOUT_MS);

  useEffect(() => {
    let timeoutId: number;

    async function lock() {
      setLocking(true);
      try {
        await fetch("/admin/logout", { method: "POST", cache: "no-store" });
      } finally {
        window.location.replace("/admin/login");
      }
    }

    function resetTimer() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => void lock(), timeoutMsRef.current);
    }

    function updateTimeout(event: Event) {
      const timeoutMs = (event as CustomEvent<number>).detail;
      if ([60_000, 300_000, 900_000].includes(timeoutMs)) {
        timeoutMsRef.current = timeoutMs;
        resetTimer();
      }
    }

    const events: (keyof WindowEventMap)[] = [
      "keydown",
      "pointerdown",
      "scroll",
      "touchstart",
    ];
    events.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer, { passive: true }),
    );
    window.addEventListener("broomer:lock", lock);
    window.addEventListener("broomer:set-lock-timeout", updateTimeout);
    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((eventName) =>
        window.removeEventListener(eventName, resetTimer),
      );
      window.removeEventListener("broomer:lock", lock);
      window.removeEventListener("broomer:set-lock-timeout", updateTimeout);
    };
  }, []);

  if (locking) {
    return (
      <main className="grid min-h-svh place-items-center bg-[#f3f1eb] px-5 text-[#20231f]">
        <p role="status" className="font-serif text-2xl">
          Locking...
        </p>
      </main>
    );
  }

  return children;
}