"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

interface Props {
  initialPassword: string;
  initialUnoPassword: string;
  initialQuote: string;
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function PlaneGateSettings({
  initialPassword,
  initialUnoPassword,
  initialQuote,
}: Readonly<Props>) {
  const [password, setPassword] = useState(initialPassword);
  const [unoPassword, setUnoPassword] = useState(initialUnoPassword);
  const [quote, setQuote] = useState(initialQuote);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planePassword: password,
          unoPassword,
          quoteOfDay: quote,
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to save settings");
      setPassword(data.settings.plane_password);
      setUnoPassword(data.settings.uno_password);
      setQuote(data.settings.quote_of_day);
      setMessage("Entrance settings updated.");
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          Access codes and quote
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Set the plane and UNO editor codes, plus the quote revealed after
          entry.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Password
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            pattern="[0-9]{3}"
            required
            value={password}
            onChange={(event) =>
              setPassword(event.target.value.replace(/\D/g, "").slice(0, 3))
            }
            className={`${inputClass} max-w-32 font-mono tracking-[0.35em]`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            UNO question editor password
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            pattern="[0-9]{3}"
            required
            value={unoPassword}
            onChange={(event) =>
              setUnoPassword(event.target.value.replace(/\D/g, "").slice(0, 3))
            }
            className={`${inputClass} max-w-32 font-mono tracking-[0.35em]`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Quote of the day
          </span>
          <textarea
            rows={3}
            maxLength={500}
            required
            value={quote}
            onChange={(event) => setQuote(event.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          {message && <p className="text-sm text-emerald-700">{message}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </form>
    </section>
  );
}
