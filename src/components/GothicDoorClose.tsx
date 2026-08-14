"use client";

import { useEffect } from "react";

interface Props {
  onDone: () => void;
}

export function GothicDoorClose({ onDone }: Props) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const timer = setTimeout(onDone, 2600);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = "";
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      {/* Toxic smoke rises first */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="animate-smoke absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(20,35,20,0.95) 0%, rgba(30,50,30,0.8) 30%, rgba(25,40,35,0.6) 60%, transparent 100%)",
          }}
        />
        <div className="animate-smoke absolute -bottom-24 left-[15%] h-[30rem] w-[30rem] rounded-full bg-[#1a2e1a]/50 blur-[100px]" style={{ animationDelay: "0.05s" }} />
        <div className="animate-smoke absolute -bottom-16 right-[10%] h-[28rem] w-[28rem] rounded-full bg-[#1e321e]/50 blur-[90px]" style={{ animationDelay: "0.12s" }} />
        <div className="animate-smoke absolute bottom-0 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[#223828]/40 blur-[80px]" style={{ animationDelay: "0.08s" }} />
      </div>

      {/* LEFT DOOR slides in from the left */}
      <div className="animate-slide-close-left absolute inset-y-0 left-0 flex w-1/2">
        <div className="relative h-full w-full overflow-hidden border-r border-[#2a1a10] bg-gradient-to-b from-[#10090c] via-[#0c0609] to-[#080407]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(200,170,120,0.5) 0px, transparent 1px, transparent 3px)",
            }}
          />
          <div className="pointer-events-none absolute -top-px left-0 right-0 h-40">
            <svg viewBox="0 0 400 160" fill="none" className="absolute bottom-0 left-0 h-full w-full" preserveAspectRatio="none">
              <path d="M0 160 L0 80 Q0 20 80 10 Q140 0 200 40 Q260 0 320 10 Q400 20 400 80 L400 160 Z" fill="#0c0609" stroke="rgba(140,110,50,0.12)" strokeWidth="1.5" />
              <path d="M200 40 L200 120" stroke="rgba(140,110,50,0.08)" strokeWidth="1" />
              <path d="M140 25 Q200 80 260 25" stroke="rgba(140,110,50,0.06)" strokeWidth="1" fill="none" />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[20%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[50%] h-[3px] bg-gradient-to-r from-[#2a1a10]/30 via-[#3a2a1a]/40 to-[#2a1a10]/30" />
          <div className="pointer-events-none absolute inset-x-0 top-[80%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          {[20, 50, 80].map((top) => (
            <div key={top} className="pointer-events-none absolute left-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]" style={{ top: `${top}%` }} />
          ))}
          {[20, 50, 80].map((top) => (
            <div key={top} className="pointer-events-none absolute right-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]" style={{ top: `${top}%` }} />
          ))}
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <div className="h-14 w-14 rounded-full border-2 border-[#3a2a1a]/50 bg-transparent shadow-[inset_0_2px_8px_rgba(0,0,0,0.6),0_0_16px_rgba(0,0,0,0.4)]" />
            <div className="absolute bottom-0 left-1/2 h-6 w-3 -translate-x-1/2 translate-y-1 rounded-b-sm bg-gradient-to-b from-[#2a1a10] to-[#1a0f0a] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
          </div>
        </div>
      </div>

      {/* RIGHT DOOR slides in from the right */}
      <div className="animate-slide-close-right absolute inset-y-0 right-0 flex w-1/2">
        <div className="relative h-full w-full overflow-hidden border-l border-[#2a1a10] bg-gradient-to-b from-[#10090c] via-[#0c0609] to-[#080407]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(200,170,120,0.5) 0px, transparent 1px, transparent 3px)",
            }}
          />
          <div className="pointer-events-none absolute -top-px left-0 right-0 h-40">
            <svg viewBox="0 0 400 160" fill="none" className="absolute bottom-0 left-0 h-full w-full" preserveAspectRatio="none">
              <path d="M0 160 L0 80 Q0 20 80 10 Q140 0 200 40 Q260 0 320 10 Q400 20 400 80 L400 160 Z" fill="#0c0609" stroke="rgba(140,110,50,0.12)" strokeWidth="1.5" />
              <path d="M200 40 L200 120" stroke="rgba(140,110,50,0.08)" strokeWidth="1" />
              <path d="M140 25 Q200 80 260 25" stroke="rgba(140,110,50,0.06)" strokeWidth="1" fill="none" />
            </svg>
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-[15%] w-[3px] bg-gradient-to-b from-transparent via-[#2a1a10]/30 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[20%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-[50%] h-[3px] bg-gradient-to-r from-[#2a1a10]/30 via-[#3a2a1a]/40 to-[#2a1a10]/30" />
          <div className="pointer-events-none absolute inset-x-0 top-[80%] h-[3px] bg-gradient-to-r from-transparent via-[#2a1a10]/25 to-transparent" />
          {[20, 50, 80].map((top) => (
            <div key={top} className="pointer-events-none absolute left-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]" style={{ top: `${top}%` }} />
          ))}
          {[20, 50, 80].map((top) => (
            <div key={top} className="pointer-events-none absolute right-[15%] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#3a2a1a]/40 bg-[#1a100a]" style={{ top: `${top}%` }} />
          ))}
          <div className="absolute left-6 top-1/2 -translate-y-1/2">
            <div className="h-14 w-14 rounded-full border-2 border-[#3a2a1a]/50 bg-transparent shadow-[inset_0_2px_8px_rgba(0,0,0,0.6),0_0_16px_rgba(0,0,0,0.4)]" />
            <div className="absolute bottom-0 left-1/2 h-6 w-3 -translate-x-1/2 translate-y-1 rounded-b-sm bg-gradient-to-b from-[#2a1a10] to-[#1a0f0a] shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
          </div>
        </div>
      </div>

      {/* Center seam fades in once doors meet */}
      <div className="animate-seam-fade-in pointer-events-none absolute inset-y-0 left-1/2 flex -translate-x-1/2 flex-col items-center justify-center">
        <div className="h-28 w-px bg-gradient-to-b from-[#c9a84c]/10 via-[#c9a84c]/25 to-[#c9a84c]/15" />
        <div className="my-2 grid h-14 w-14 place-items-center rounded-full border border-[#c9a84c]/20 bg-[#0c0609] shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(201,168,76,0.1)]">
          <span className="text-xl">⚜️</span>
        </div>
        <div className="h-28 w-px bg-gradient-to-b from-[#c9a84c]/15 via-[#c9a84c]/25 to-[#c9a84c]/10" />
      </div>
    </div>
  );
}
