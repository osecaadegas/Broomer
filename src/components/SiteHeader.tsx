"use client";

import Link from "next/link";
import { useState } from "react";

export function SiteHeader() {
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);

  return (
    <header className="border-b border-[#c8cbc4] bg-[#f3f1eb]/95">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
        <Link href="/admin" className="font-serif text-xl">
          Broomer
        </Link>
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#596057]">
            <span>Auto-lock</span>
            <select
              value={timeoutMinutes}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                setTimeoutMinutes(minutes);
                window.dispatchEvent(
                  new CustomEvent("broomer:set-lock-timeout", {
                    detail: minutes * 60 * 1000,
                  }),
                );
              }}
              className="ml-2 min-h-10 border border-[#858d82] bg-transparent px-2 text-[#20231f]"
            >
              <option value={1}>1 min</option>
              <option value={5}>5 min</option>
              <option value={15}>15 min</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("broomer:lock"))}
            className="min-h-10 border border-[#858d82] px-4 text-sm font-semibold hover:bg-white"
          >
            Lock
          </button>
        </div>
      </div>
    </header>
  );
}
