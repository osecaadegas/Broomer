"use client";

import { useEffect, useMemo, useState } from "react";
import { ratingScale, type Question } from "@/lib/questionnaire";
import { ClipboardListIcon, TrashIcon } from "@/components/icons";

interface ResponseItem {
  id: number;
  answers: Record<string, string | string[]>;
  createdAt: string;
}

interface Props {
  questions: Question[];
}

function formatAnswer(
  question: Question | undefined,
  value: string | string[],
): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }
  const text = value.trim();
  if (text === "") return "—";
  if (question && question.type === "rating") {
    const scale = ratingScale(question);
    return `${text} / ${scale[scale.length - 1]}`;
  }
  return text;
}

export function ResponseList({ questions }: Props) {
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const questionMap = useMemo(() => {
    const map: Record<string, Question> = {};
    for (const question of questions) {
      map[String(question.id)] = question;
    }
    return map;
  }, [questions]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/responses", { cache: "no-store" });
      const data = await res.json();
      setResponses((data.responses ?? []) as ResponseItem[]);
    } catch {
      setError("Failed to load responses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/responses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete response");
      }
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete response");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-indigo-600">
          <ClipboardListIcon className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-xl font-semibold text-slate-900">
          No responses yet
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          Answers submitted through the questionnaire will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-slate-600">
        {responses.length} {responses.length === 1 ? "response" : "responses"}{" "}
        received
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {responses.map((response) => (
          <div
            key={response.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <span className="text-xs font-medium text-slate-500">
                Response #{response.id} ·{" "}
                {new Date(response.createdAt).toLocaleString()}
              </span>
              {confirmId === response.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Delete?</span>
                  <button
                    type="button"
                    onClick={() => doDelete(response.id)}
                    disabled={deletingId === response.id}
                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(response.id)}
                  disabled={deletingId === response.id}
                  className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Delete response ${response.id}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            <dl className="divide-y divide-slate-100">
              {Object.entries(response.answers ?? {}).map(([key, value]) => {
                const isFollowUp = key.endsWith(":followup");
                const questionId = isFollowUp
                  ? key.slice(0, -":followup".length)
                  : key;
                const question = questionMap[questionId];
                const label = isFollowUp
                  ? `${question ? question.prompt : "Removed question"} — follow-up`
                  : question
                    ? question.prompt
                    : "Removed question";
                return (
                  <div
                    key={key}
                    className="grid gap-1 px-5 py-3 sm:grid-cols-[minmax(0,40%)_minmax(0,60%)] sm:gap-4"
                  >
                    <dt className="text-sm font-medium text-slate-700">
                      {label}
                    </dt>
                    <dd className="break-words text-sm text-slate-500">
                      {question?.type === "image" &&
                      typeof value === "string" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={value}
                          alt={question.prompt || "Selected image"}
                          className="h-24 w-auto rounded-lg object-contain"
                        />
                      ) : (
                        formatAnswer(question, value)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
