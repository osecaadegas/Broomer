"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  hasOptions,
  QUESTION_TYPE_HINTS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Question,
  type QuestionType,
} from "@/lib/questionnaire";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";

interface Props {
  initialQuestions: Question[];
}

const SAMPLE_QUESTIONS: Array<{
  prompt: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}> = [
  {
    prompt: "What is your name?",
    type: "short",
    options: [],
    required: true,
  },
  {
    prompt: "How did you hear about us?",
    type: "single",
    options: ["Search engine", "Social media", "A friend", "Other"],
    required: false,
  },
  {
    prompt: "Which features matter most to you?",
    type: "multiple",
    options: ["Design", "Performance", "Support", "Pricing"],
    required: false,
  },
  {
    prompt: "How would you rate your overall experience?",
    type: "rating",
    options: [],
    required: true,
  },
  {
    prompt: "Anything else you would like to share?",
    type: "long",
    options: [],
    required: false,
  },
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function QuestionManager({ initialQuestions }: Props) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<QuestionType>("short");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(false);

  async function load() {
    const res = await fetch("/api/questions", { cache: "no-store" });
    const data = await res.json();
    setQuestions((data.questions ?? []) as Question[]);
  }

  function openAdd() {
    setEditingId(null);
    setPrompt("");
    setType("short");
    setOptions(["", ""]);
    setRequired(false);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(question: Question) {
    setEditingId(question.id);
    setPrompt(question.prompt);
    setType(question.type);
    setOptions(question.options.length ? [...question.options] : ["", ""]);
    setRequired(question.required);
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setError(null);
  }

  function handleTypeChange(nextType: QuestionType) {
    setType(nextType);
    if (hasOptions(nextType) && options.length === 0) {
      setOptions(["", ""]);
    }
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) =>
      prev.map((option, i) => (i === index ? value : option)),
    );
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanedOptions = options
      .map((option) => option.trim())
      .filter(Boolean);

    if (!prompt.trim()) {
      setError("Please enter the question text.");
      return;
    }
    if (hasOptions(type) && cleanedOptions.length < 2) {
      setError("Add at least two options.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        prompt: prompt.trim(),
        type,
        options: hasOptions(type) ? cleanedOptions : [],
        required,
      };
      const res = await fetch(
        editingId ? `/api/questions/${editingId}` : "/api/questions",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save question");
      }
      await load();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;

    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setQuestions(next);

    try {
      const res = await fetch("/api/questions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((question) => question.id) }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
    } catch {
      await load();
    }
  }

  async function doDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete question");
      }
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete question");
    } finally {
      setDeletingId(null);
    }
  }

  async function addSamples() {
    setLoadingSamples(true);
    setError(null);
    try {
      for (const sample of SAMPLE_QUESTIONS) {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sample),
        });
        if (!res.ok) throw new Error("Failed to add sample questions");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add samples");
    } finally {
      setLoadingSamples(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {questions.length}{" "}
          {questions.length === 1 ? "question" : "questions"} in this
          questionnaire
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4" />
          Add question
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSave}
          className="mt-4 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {editingId ? "Edit question" : "New question"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close form"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="question-prompt"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Question text
              </label>
              <textarea
                id="question-prompt"
                rows={2}
                className={`${inputClass} resize-y`}
                placeholder="e.g. What is your email address?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="question-type"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Answer type
              </label>
              <select
                id="question-type"
                className={inputClass}
                value={type}
                onChange={(e) =>
                  handleTypeChange(e.target.value as QuestionType)
                }
              >
                {QUESTION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {QUESTION_TYPE_LABELS[option]}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-slate-400">
                {QUESTION_TYPE_HINTS[type]}
              </p>
            </div>

            {hasOptions(type) && (
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Options
                </span>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        className={inputClass}
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={options.length <= 2}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove option ${index + 1}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addOption}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add option
                </button>
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
              <span className="text-sm text-slate-700">
                Mark as required
              </span>
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add question"}
            </button>
          </div>
        </form>
      )}

      {error && !formOpen && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {questions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-indigo-100 text-indigo-600">
            <SparklesIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-900">
            Your questionnaire is empty
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Add your first question, or load a few examples to get started
            quickly.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 sm:w-auto"
            >
              <PlusIcon className="h-4 w-4" />
              Add question
            </button>
            <button
              type="button"
              onClick={addSamples}
              disabled={loadingSamples}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
            >
              {loadingSamples ? "Loading…" : "Load sample questions"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      {QUESTION_TYPE_LABELS[question.type]}
                    </span>
                    {question.required && (
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {question.prompt}
                  </p>
                  {question.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {question.options.map((option, optionIndex) => (
                        <span
                          key={optionIndex}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {option}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUpIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === questions.length - 1}
                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDownIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
                {confirmId === question.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      Delete this question?
                    </span>
                    <button
                      type="button"
                      onClick={() => doDelete(question.id)}
                      disabled={deletingId === question.id}
                      className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(question)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(question.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
