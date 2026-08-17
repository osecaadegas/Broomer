"use client";

import Image from "next/image";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import {
  QUESTION_TYPE_LABELS,
  hasOptions,
  type QuestionType,
} from "@/lib/questionnaire";

interface Props {
  onCancel: () => void;
}

interface DraftQuestion {
  key: string;
  prompt: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}

const AUTHOR_TYPES: QuestionType[] = [
  "short",
  "long",
  "single",
  "multiple",
  "rating",
  "number",
  "datetime",
];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm text-stone-100 placeholder:text-stone-600 outline-none transition focus:border-[#c9a84c]/60 focus:ring-2 focus:ring-[#c9a84c]/15";

function createDraft(): DraftQuestion {
  return {
    key: crypto.randomUUID(),
    prompt: "",
    type: "short",
    options: [],
    required: false,
  };
}

export function UnoQuestionBuilder({ onCancel }: Readonly<Props>) {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    if (!/^\d{3}$/.test(password)) {
      setError("Enter all three digits");
      return;
    }

    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/uno-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to unlock editor");
      setQuestions([createDraft()]);
      setUnlocked(true);
    } catch (error_) {
      setPassword("");
      setError(error_ instanceof Error ? error_.message : "Unable to unlock editor");
    } finally {
      setChecking(false);
    }
  }

  function updateQuestion(key: string, update: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key ? { ...question, ...update } : question,
      ),
    );
    setError(null);
  }

  function changeType(question: DraftQuestion, type: QuestionType) {
    let options: string[] = [];
    if (hasOptions(type)) {
      options = question.options.length >= 2 ? question.options : ["", ""];
    }
    updateQuestion(question.key, {
      type,
      options,
    });
  }

  function updateOption(key: string, index: number, value: string) {
    const question = questions.find((item) => item.key === key);
    if (!question) return;
    updateQuestion(key, {
      options: question.options.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((current) => {
      const next = [...current];
      const [question] = next.splice(index, 1);
      next.splice(target, 0, question);
      return next;
    });
  }

  async function publish() {
    const cleaned = questions.map((question) => ({
      prompt: question.prompt.trim(),
      type: question.type,
      options: hasOptions(question.type)
        ? question.options.map((option) => option.trim()).filter(Boolean)
        : [],
      required: question.required,
    }));
    if (cleaned.some((question) => !question.prompt)) {
      setError("Every question needs question text");
      return;
    }
    if (
      cleaned.some(
        (question) => hasOptions(question.type) && question.options.length < 2,
      )
    ) {
      setError("Choice questions need at least two options");
      return;
    }

    setPublishing(true);
    setError(null);
    try {
      const response = await fetch("/api/uno-questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, questions: cleaned }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to publish questions");
      setPublished(true);
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Unable to publish questions");
    } finally {
      setPublishing(false);
    }
  }

  if (published) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#08060d] px-4">
        <div className="w-full max-w-sm text-center animate-card-in">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#c9a84c]/30 bg-[#17100c]">
            <span className="text-3xl" aria-hidden>✓</span>
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-stone-100">Questions ready</h1>
          <p className="mt-2 text-sm text-stone-400">
            The questionnaire has been replaced with your questions.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg border border-[#c9a84c]/40 bg-[#20180e] px-5 py-2.5 text-sm font-semibold text-[#dfc77d] transition hover:border-[#c9a84c]/70"
          >
            Return to start
          </button>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-[#08060d] px-4">
        <div className="w-full max-w-sm text-center animate-card-in">
          <div className="mx-auto grid h-16 w-16 place-items-center">
            <Image
              src="/UNO_reverse_icon.png"
              alt=""
              width={404}
              height={608}
              priority
              sizes="44px"
              className="h-16 w-auto"
            />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-stone-100">Your turn</h1>
          <p className="mt-2 text-sm text-stone-400">Enter the UNO editor code.</p>
          <form onSubmit={unlock} className="mt-6 flex flex-col items-center gap-3">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={3}
              pattern="[0-9]{3}"
              aria-label="Three-digit UNO editor code"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value.replace(/\D/g, "").slice(0, 3));
                setError(null);
              }}
              className="w-40 rounded-lg border border-[#c9a84c]/35 bg-[#100c08] px-4 py-3 text-center font-mono text-lg tracking-[0.6em] text-stone-100 outline-none focus:border-[#c9a84c]/70 focus:ring-2 focus:ring-[#c9a84c]/20"
            />
            <button
              type="submit"
              disabled={checking}
              className="rounded-lg border border-[#c9a84c]/40 bg-[#20180e] px-5 py-2.5 text-sm font-semibold text-[#dfc77d] transition hover:border-[#c9a84c]/70 disabled:opacity-60"
            >
              {checking ? "Checking..." : "Open editor"}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            type="button"
            onClick={onCancel}
            className="mt-5 text-sm text-stone-500 transition hover:text-stone-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#08060d]">
      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#a98a4d]">UNO reverse</p>
            <h1 className="mt-2 text-2xl font-semibold text-stone-100 sm:text-3xl">
              Set the questions
            </h1>
            <p className="mt-2 text-sm text-stone-400">
              Publishing replaces the current questionnaire.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-stone-400 transition hover:border-white/20 hover:text-stone-200"
          >
            Exit
          </button>
        </header>

        <div className="mt-8 space-y-3">
          {questions.map((question, index) => (
            <section
              key={question.key}
              className="rounded-lg border border-white/10 bg-[#151019] p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a98a4d]">
                  Question {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label="Move question up" className="grid h-8 w-8 place-items-center rounded-md text-stone-500 hover:bg-white/5 hover:text-stone-200 disabled:opacity-25">
                    <ChevronUpIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => moveQuestion(index, 1)} disabled={index === questions.length - 1} aria-label="Move question down" className="grid h-8 w-8 place-items-center rounded-md text-stone-500 hover:bg-white/5 hover:text-stone-200 disabled:opacity-25">
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setQuestions((current) => current.filter((item) => item.key !== question.key))} disabled={questions.length === 1} aria-label="Delete question" className="grid h-8 w-8 place-items-center rounded-md text-stone-500 hover:bg-red-950/40 hover:text-red-400 disabled:opacity-25">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Write your question..."
                  aria-label={`Question ${index + 1} text`}
                  value={question.prompt}
                  onChange={(event) => updateQuestion(question.key, { prompt: event.target.value })}
                  className={`${inputClass} resize-y`}
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <select
                    aria-label={`Question ${index + 1} answer type`}
                    value={question.type}
                    onChange={(event) => changeType(question, event.target.value as QuestionType)}
                    className={inputClass}
                  >
                    {AUTHOR_TYPES.map((type) => (
                      <option key={type} value={type}>{QUESTION_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-stone-400">
                    <input
                      type="checkbox"
                      checked={question.required}
                      onChange={(event) => updateQuestion(question.key, { required: event.target.checked })}
                      className="h-4 w-4 accent-[#c9a84c]"
                    />
                    <span>Required</span>
                  </label>
                </div>

                {hasOptions(question.type) && (
                  <div className="space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div key={`${question.key}-${optionIndex}`} className="flex gap-2">
                        <input
                          value={option}
                          maxLength={120}
                          aria-label={`Question ${index + 1} option ${optionIndex + 1}`}
                          placeholder={`Option ${optionIndex + 1}`}
                          onChange={(event) => updateOption(question.key, optionIndex, event.target.value)}
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() => updateQuestion(question.key, { options: question.options.filter((_, currentIndex) => currentIndex !== optionIndex) })}
                          disabled={question.options.length <= 2}
                          aria-label={`Remove option ${optionIndex + 1}`}
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-red-950/40 hover:text-red-400 disabled:opacity-25"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {question.options.length < 12 && (
                      <button
                        type="button"
                        onClick={() => updateQuestion(question.key, { options: [...question.options, ""] })}
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[#c9a84c] hover:bg-[#c9a84c]/5"
                      >
                        <PlusIcon className="h-4 w-4" /> Add option
                      </button>
                    )}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setQuestions((current) => [...current, createDraft()])}
            disabled={questions.length >= 30}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-stone-300 transition hover:border-white/20 hover:bg-white/5 disabled:opacity-40"
          >
            <PlusIcon className="h-4 w-4" /> Add question
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing}
            className="rounded-lg bg-[#b99a50] px-5 py-2.5 text-sm font-bold text-[#100c08] transition hover:bg-[#d0b66f] disabled:opacity-60"
          >
            {publishing ? "Publishing..." : "Publish questions"}
          </button>
        </div>
      </main>
    </div>
  );
}