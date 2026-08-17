"use client";

import type { PlaneAnswer } from "@/lib/supabase/types";

interface Props {
  answers: PlaneAnswer[];
  onDone: () => void;
}

function formatAnswer(item: PlaneAnswer): string {
  if (Array.isArray(item.answer)) {
    return item.answer.length > 0 ? item.answer.join(", ") : "No answer yet";
  }
  if (item.type === "rating" && item.answer) return `${item.answer} / 5`;
  if (item.type === "datetime" && item.answer) {
    const date = new Date(item.answer);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return item.answer.trim() || "No answer yet";
}

export function PlaneAnswerReveal({ answers, onDone }: Readonly<Props>) {
  return (
    <div className="mt-1 w-full animate-card-in">
      <div className="mx-auto max-h-[42dvh] w-full max-w-lg overflow-y-auto overscroll-contain border-y border-[#c9a84c]/15 py-1">
        {answers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-stone-400">
            No answers have been saved yet.
          </p>
        ) : (
          <dl className="divide-y divide-white/8 text-left">
            {answers.map((item) => (
              <div key={item.id} className="px-3 py-4 sm:px-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a98a4d]">
                  {item.question}
                </dt>
                <dd className="mt-1.5 whitespace-pre-wrap break-words text-base leading-relaxed text-stone-200">
                  {formatAnswer(item)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <button
        type="button"
        onClick={onDone}
        className="mt-5 rounded-lg border border-[#c9a84c]/40 bg-[#20180e]/70 px-5 py-2.5 text-sm font-semibold text-[#dfc77d] transition hover:border-[#c9a84c]/70 hover:bg-[#2a2012]"
      >
        Back to start
      </button>
    </div>
  );
}
