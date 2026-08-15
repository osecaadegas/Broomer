"use client";

import { useEffect, useState } from "react";

interface EmojiParticle {
  id: number;
  char: string;
  left: number;
  duration: number;
  delay: number;
  size: number;
}

interface Props {
  mode: "happy" | "sad" | "none";
}

const SAD_EMOJIS = ["😢", "😭", "🥺", "😞", "💔", "😔", "😿", "😦"];
const HAPPY_EMOJIS = ["😂", "🤣", "🥳", "😆", "😍", "🤩", "😹", "🎉"];

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function FlyingEmojis({ mode }: Props) {
  const [particles, setParticles] = useState<EmojiParticle[]>([]);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (mode === "none") {
      setParticles([]);
      return;
    }

    const pool = mode === "happy" ? HAPPY_EMOJIS : SAD_EMOJIS;
    const next: EmojiParticle[] = [];

    for (let i = 0; i < 20; i++) {
      next.push({
        id: i,
        char: pool[i % pool.length],
        left: randomBetween(4, 96),
        duration: randomBetween(2, 4.5),
        delay: randomBetween(0, 1.5),
        size: randomBetween(1.4, 2.8),
      });
    }

    setParticles(next);
    setKey((prev) => prev + 1);
  }, [mode]);

  if (mode === "none" || particles.length === 0) return null;

  return (
    <div
      key={key}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="absolute bottom-0 animate-[fly-up_var(--duration)_ease-out_forwards]"
          style={
            {
              left: `${particle.left}%`,
              fontSize: `${particle.size}rem`,
              animationDelay: `${particle.delay}s`,
              "--duration": `${particle.duration}s`,
            } as React.CSSProperties
          }
        >
          {particle.char}
        </span>
      ))}
    </div>
  );
}
