"use client";

import { useState } from "react";
import type { SupabaseUnoQuestionRow } from "@/lib/supabase/types";

interface Props {
  questions: SupabaseUnoQuestionRow[];
}

type Answer = string | string[];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function optionsFor(question: SupabaseUnoQuestionRow): string[] {
  return Array.isArray(question.options)
    ? question.options.filter(
        (option): option is string => typeof option === "string",
      )
    : [];
}

function initialAnswer(question: SupabaseUnoQuestionRow): Answer {
  if (
    Array.isArray(question.answer) &&
    question.answer.every((value) => typeof value === "string")
  ) {
    return question.answer;
  }
  return typeof question.answer === "string" ? question.answer : "";
}

export function UnoAnswerManager({ questions }: Readonly<Props>) {
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    Object.fromEntries(
      questions.map((question) => [
        String(question.id),
        initialAnswer(question),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(id: number, answer: Answer) {
    setAnswers((current) => ({ ...current, [String(id)]: answer }));
    setMessage(null);
    setError(null);
  }

  function toggleOption(question: SupabaseUnoQuestionRow, option: string) {
    const current = answers[String(question.id)];
    const selected = Array.isArray(current) ? current : [];
    setAnswer(
      question.id,
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    );
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/uno-answers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save answers");
      setMessage("Plane answers saved.");
    } catch (error_) {
      setError(
        error_ instanceof Error ? error_.message : "Unable to save answers",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            UNO reverse
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Answer their questions
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            These answers are revealed only after the plane password.
          </p>
        </div>
        {questions.length > 0 && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save answers"}
          </button>
        )}
      </div>

      {questions.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
          No UNO questions have been published yet.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {questions.map((question, index) => {
            const value = answers[String(question.id)] ?? "";
            const options = optionsFor(question);
            return (
              <fieldset key={question.id} className="min-w-0">
                <legend className="text-sm font-semibold text-slate-800">
                  {index + 1}. {question.prompt}
                  {question.required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </legend>

                <div className="mt-2.5">
                  {question.type === "long" && (
                    <textarea
                      rows={4}
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) =>
                        setAnswer(question.id, event.target.value)
                      }
                      className={`${inputClass} resize-y`}
                    />
                  )}
                  {question.type === "short" && (
                    <input
                      type="text"
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) =>
                        setAnswer(question.id, event.target.value)
                      }
                      className={inputClass}
                    />
                  )}
                  {question.type === "number" && (
                    <input
                      type="number"
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) =>
                        setAnswer(question.id, event.target.value)
                      }
                      className={inputClass}
                    />
                  )}
                  {question.type === "datetime" && (
                    <input
                      type="datetime-local"
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) =>
                        setAnswer(question.id, event.target.value)
                      }
                      className={inputClass}
                    />
                  )}
                  {question.type === "rating" && (
                    <select
                      value={typeof value === "string" ? value : ""}
                      onChange={(event) =>
                        setAnswer(question.id, event.target.value)
                      }
                      className={inputClass}
                    >
                      <option value="">Select a rating</option>
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <option key={rating} value={String(rating)}>
                          {rating} / 5
                        </option>
                      ))}
                    </select>
                  )}
                  {question.type === "single" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options.map((option) => (
                        <label
                          key={option}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
                        >
                          <input
                            type="radio"
                            name={`uno-${question.id}`}
                            checked={value === option}
                            onChange={() => setAnswer(question.id, option)}
                            className="accent-indigo-600"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {question.type === "multiple" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options.map((option) => {
                        const selected =
                          Array.isArray(value) && value.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleOption(question, option)}
                              className="accent-indigo-600"
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}

      {message && (
        <p className="mt-4 text-sm font-medium text-emerald-700">{message}</p>
      )}
      {error && (
        <p className="mt-4 text-sm font-medium text-red-700">{error}</p>
      )}
    </section>
  );
}
