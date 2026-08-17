"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  hasOptions,
  isPickType,
  isQuestionVisible,
  ratingScale,
  type Question,
} from "@/lib/questionnaire";
import { FlyingEmojis } from "@/components/FlyingEmojis";
import { MoodSelfieInterlude } from "@/components/MoodSelfieInterlude";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
} from "@/components/icons";
import { RESPONSE_MOOD_SELFIE_KEY } from "@/lib/questionnaire";
import { RESPONSE_MOOD_TALK_KEY } from "@/lib/questionnaire";

type Answer = string | string[];

interface Props {
  questions: Question[];
  lightsOn?: boolean;
  enchanted?: boolean;
  onPrepareFinale?: () => void;
  onSubmitted?: () => void;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[15px] text-stone-100 placeholder:text-stone-500 shadow-inner shadow-black/20 outline-none transition focus:border-[#bd7996]/80 focus:ring-2 focus:ring-[#8c345c]/35";

const cardShell =
  "max-h-[calc(100dvh-2rem)] w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-contain rounded-3xl border border-[#9d6682]/30 bg-[#17111f]/90 shadow-2xl shadow-black/60 ring-1 ring-white/5 backdrop-blur-xl sm:max-h-[calc(100dvh-5rem)]";

const accentBar =
  "h-1.5 w-full bg-gradient-to-r from-[#7c173e] via-[#b45577] to-[#5b3377]";

function getAtmosphereTheme(lightsOn: boolean, enchanted: boolean) {
  if (enchanted) {
    return {
      card: "border-[#e6c36c]/50 bg-[#17130f]/92 shadow-[#7a4d16]/35",
      accent:
        "h-1.5 w-full bg-gradient-to-r from-[#5f2a78] via-[#f0d586] to-[#702449]",
      whisper: "text-[#e6c36c]/80",
    };
  }
  if (lightsOn) {
    return {
      card: "border-[#c9a84c]/35 shadow-[#3f260f]/30",
      accent:
        "h-1.5 w-full bg-gradient-to-r from-[#6f3c16] via-[#d0aa55] to-[#7b4820]",
      whisper: "text-[#ad925a]/70",
    };
  }
  return {
    card: "border-[#765083]/35 shadow-[#120719]/70",
    accent: accentBar,
    whisper: "text-[#9375a0]/65",
  };
}

function getAtmosphereWhisper(
  index: number,
  lightsOn: boolean,
  enchanted: boolean,
): string | null {
  if (index === 0 || index % 3 !== 0) return null;
  if (enchanted) return "Five flames follow every answer.";
  return lightsOn
    ? "The candle leans closer."
    : "Something shifts beyond the card.";
}

export function Questionnaire({
  questions,
  lightsOn = false,
  enchanted = false,
  onPrepareFinale,
  onSubmitted,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [noPos, setNoPos] = useState({ left: 45, top: 0 });
  const [moodInterlude, setMoodInterlude] = useState(false);
  const [moodInterludeCompleted, setMoodInterludeCompleted] = useState(false);

  const visible = useMemo(
    () => questions.filter((question) => isQuestionVisible(question, answers)),
    [questions, answers],
  );

  // Keep `current` within the visible list when a conditional answer changes
  // which questions should be shown.
  useEffect(() => {
    if (current >= visible.length) {
      setCurrent(Math.max(0, visible.length - 1));
    }
  }, [visible.length, current]);

  const total = visible.length;
  const currentSafe = Math.min(current, Math.max(0, total - 1));
  const question = visible[currentSafe];
  const isLast = currentSafe === total - 1;
  const atmosphereWhisper = getAtmosphereWhisper(
    currentSafe,
    lightsOn,
    enchanted,
  );
  const atmosphereTheme = getAtmosphereTheme(lightsOn, enchanted);

  function isEmpty(id: number): boolean {
    const value = answers[String(id)];
    if (Array.isArray(value)) return value.length === 0;
    return typeof value !== "string" || value.trim() === "";
  }

  function clearError(id: number) {
    setErrors((prev) => {
      if (!prev[String(id)]) return prev;
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  }

  function setAnswer(id: number, value: Answer) {
    setAnswers((prev) => ({ ...prev, [String(id)]: value }));
    clearError(id);

    if (
      currentSafe === 0 &&
      question.type === "rating" &&
      Number(value) <= 2 &&
      !moodInterludeCompleted
    ) {
      setMoodInterlude(true);
      return;
    }

    // Auto-advance on pick types when no follow-up text box or response text is active
    if (!isLast && isPickType(question.type)) {
      const hasFollowUpNow =
        question.followUpOption != null &&
        String(value) === question.followUpOption;
      const hasResponseNow =
        question.responseText != null &&
        question.responseTrigger != null &&
        (question.responseTrigger === "*"
          ? value != null && String(value) !== ""
          : String(value) === question.responseTrigger);
      if (!hasFollowUpNow && !hasResponseNow) {
        setTimeout(() => setCurrent(currentSafe + 1), 300);
      }
    }
  }

  function dodgeNo() {
    setNoPos({
      left: Math.round(Math.random() * 58),
      top: Math.round(Math.random() * 62),
    });
  }

  function toggleMultiple(id: number, option: string) {
    setAnswers((prev) => {
      const currentValue = Array.isArray(prev[String(id)])
        ? (prev[String(id)] as string[])
        : [];
      const isAlreadySelected = currentValue.includes(option);

      if (isAlreadySelected) {
        return {
          ...prev,
          [String(id)]: currentValue.filter((item) => item !== option),
        };
      }

      // Enforce multipleMax if present
      if (
        question.multipleMax != null &&
        currentValue.length >= question.multipleMax
      ) {
        return prev; // don't add more
      }

      return {
        ...prev,
        [String(id)]: [...currentValue, option],
      };
    });
    clearError(id);
  }

  function goBack() {
    if (currentSafe > 0) {
      setCurrent(currentSafe - 1);
      setSubmitError(null);
    }
  }

  function handleContinue() {
    if (!question) return;

    const currentValue = answers[String(question.id)];
    if (
      question.type === "multiple" &&
      question.multipleMax != null &&
      (!Array.isArray(currentValue) ||
        currentValue.length !== question.multipleMax)
    ) {
      setErrors((prev) => ({
        ...prev,
        [String(question.id)]:
          `Pick exactly ${question.multipleMax} options to continue.`,
      }));
      return;
    }

    if (question.required && isEmpty(question.id)) {
      setErrors((prev) => ({
        ...prev,
        [String(question.id)]: "i can ask as many times as you want 😜",
      }));
      return;
    }

    if (isLast) {
      void submitAll();
    } else {
      setCurrent(currentSafe + 1);
      setSubmitError(null);
    }
  }

  async function submitAll() {
    let firstMissingIndex = -1;
    const newErrors: Record<string, string> = {};
    for (let i = 0; i < visible.length; i += 1) {
      const q = visible[i];
      const value = answers[String(q.id)];
      if (
        q.type === "multiple" &&
        q.multipleMax != null &&
        (!Array.isArray(value) || value.length !== q.multipleMax)
      ) {
        if (firstMissingIndex === -1) firstMissingIndex = i;
        newErrors[String(q.id)] =
          `Pick exactly ${q.multipleMax} options to continue.`;
        continue;
      }
      if (q.required && isEmpty(q.id)) {
        if (firstMissingIndex === -1) firstMissingIndex = i;
        newErrors[String(q.id)] = "i can ask as many times as you want 😜";
      }
    }
    if (firstMissingIndex !== -1) {
      setErrors(newErrors);
      setCurrent(firstMissingIndex);
      return;
    }

    onPrepareFinale?.();
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit your response");
      }
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleContinue();
  }

  function reset() {
    setAnswers({});
    setErrors({});
    setCurrent(0);
    setSubmitted(false);
    setSubmitError(null);
    setMoodInterlude(false);
    setMoodInterludeCompleted(false);
  }

  function finishMoodInterlude(selfie: string | null, moodTalk: string | null) {
    if (selfie) {
      setAnswers((previous) => ({
        ...previous,
        [RESPONSE_MOOD_SELFIE_KEY]: selfie,
        ...(moodTalk !== null ? { [RESPONSE_MOOD_TALK_KEY]: moodTalk } : {}),
      }));
    }
    setMoodInterludeCompleted(true);
    setMoodInterlude(false);
    setCurrent(1);
  }

  if (total === 0) {
    return (
      <div className={cardShell}>
        <div className={accentBar} />
        <div className="p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#b45577]/30 bg-[#3a1830] text-[#e8a8bf]">
            <ClipboardListIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-stone-100">
            No questions yet
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-stone-400">
            Add some questions from the manage page to publish your
            questionnaire.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#861d48] to-[#603a78] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/30 transition hover:from-[#a12759] hover:to-[#70448b]"
          >
            Add questions
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className={cardShell}>
        <div className={accentBar} />
        <div className="p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#b45577]/30 bg-[#3a1830] text-[#e8a8bf]">
            <CheckIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-5 text-2xl font-bold text-stone-100">
            Thanks for your answers!
          </h2>
          <p className="mt-2 text-sm text-stone-400">
            Your response has been recorded successfully.
          </p>

          {/* Animated ending text */}
          <div className="mt-6 overflow-hidden">
            <p className="animate-ending-text text-center text-lg font-light italic tracking-wide text-[#bd91a2]">
              I truely hope at least i made you smile
            </p>
          </div>

          {/* Decorative heart */}
          <div className="mt-4 animate-ending-heart text-2xl">❤️</div>

          <button
            type="button"
            onClick={reset}
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#861d48] to-[#603a78] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/30 transition hover:from-[#a12759] hover:to-[#70448b]"
          >
            Submit another response
          </button>
        </div>
      </div>
    );
  }

  const value = answers[String(question.id)];
  const scale = ratingScale(question);
  const followUpKey = `${question.id}:followup`;
  const followUpValue = answers[followUpKey];

  // Should the Next/Submit button be visible?
  const showFollowUp =
    question.followUpOption != null && value === question.followUpOption;

  // Detect response text trigger
  const showResponse =
    question.responseText != null &&
    question.responseTrigger != null &&
    (question.responseTrigger === "*"
      ? value != null && String(value) !== ""
      : String(value) === question.responseTrigger);

  // Detect if this is the "drinks" question and track Monster selection
  const selectedOptions = Array.isArray(value) ? (value as string[]) : [];
  const isMonsterQuestion = question.options.some((opt) =>
    opt.toLowerCase().includes("monster"),
  );
  const hasMonster =
    isMonsterQuestion &&
    selectedOptions.some((opt) => opt.toLowerCase().includes("monster"));
  const reachedMax =
    question.multipleMax != null &&
    selectedOptions.length >= question.multipleMax;
  const requiresExactMultipleChoices =
    question.type === "multiple" && question.multipleMax != null;
  const hasExactMultipleChoices =
    requiresExactMultipleChoices &&
    selectedOptions.length === question.multipleMax;
  const showNextButton =
    !isPickType(question.type) ||
    requiresExactMultipleChoices ||
    showFollowUp ||
    showResponse ||
    isLast;
  const emojiMode: "happy" | "sad" | "none" =
    isMonsterQuestion && hasMonster
      ? "happy"
      : isMonsterQuestion && reachedMax && !hasMonster
        ? "sad"
        : "none";

  return (
    <>
      {moodInterlude && (
        <MoodSelfieInterlude onComplete={finishMoodInterlude} />
      )}
      <form
        onSubmit={handleSubmit}
        noValidate
        className={`${cardShell} relative ${atmosphereTheme.card}`}
      >
        <FlyingEmojis mode={emojiMode} />
        <div
          className={atmosphereTheme.accent}
        />
        <div
          key={question.id}
          className="animate-card-in relative z-10 p-6 sm:p-8"
        >
          {question.prompt ? (
            <h2 className="text-xl font-semibold leading-snug text-stone-100">
              {question.prompt}
              {question.required && (
                <span className="ml-1 text-red-400" title="Required">
                  *
                </span>
              )}
            </h2>
          ) : null}

          {atmosphereWhisper && (
            <p
              aria-hidden
              className={`mt-2 animate-card-in font-serif text-xs italic ${atmosphereTheme.whisper}`}
            >
              {atmosphereWhisper}
            </p>
          )}

          <div className="mt-6">
            <div className={question.prompt ? "mt-5" : ""}>
              {question.type === "short" && (
                <input
                  type="text"
                  className={inputClass}
                  placeholder={question.placeholder || "Type your answer…"}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                />
              )}

              {question.type === "long" && (
                <textarea
                  rows={4}
                  className={`${inputClass} resize-y`}
                  placeholder={question.placeholder || "Type your answer…"}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                />
              )}

              {question.type === "number" && (
                <input
                  type="number"
                  inputMode="numeric"
                  className={inputClass}
                  placeholder={question.placeholder || "Enter a number"}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                />
              )}

              {question.type === "rating" && (
                <div>
                  <div className="flex flex-wrap gap-2">
                    {scale.map((rating, ratingIndex) => {
                      const selected =
                        typeof value === "string" && value === String(rating);
                      const animateMoodRating = currentSafe === 0 && rating > 2;
                      return (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setAnswer(question.id, String(rating))}
                          aria-label={`Rate ${rating} out of ${scale[scale.length - 1]}`}
                          aria-pressed={selected}
                          className={`h-11 w-11 rounded-xl border text-sm font-semibold transition ${
                            animateMoodRating ? "animate-mood-rating" : ""
                          } ${
                            selected
                              ? "border-[#c56d91] bg-gradient-to-br from-[#8e204b] to-[#654075] text-white shadow-md shadow-black/30"
                              : "border-white/10 bg-black/20 text-stone-300 hover:border-[#b45577]/60 hover:bg-[#311728] hover:text-[#f0becf]"
                          }`}
                          style={
                            animateMoodRating
                              ? {
                                  animationDelay: `${Math.max(0, ratingIndex - 2) * 70}ms`,
                                }
                              : undefined
                          }
                        >
                          {rating}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    1 = low, {scale[scale.length - 1]} = high
                  </p>
                </div>
              )}

              {hasOptions(question.type) && (
                <div className="space-y-2">
                  {question.options.map((option, optionIndex) => {
                    const isSingle = question.type === "single";
                    const selected = isSingle
                      ? value === option
                      : Array.isArray(value) && value.includes(option);
                    return (
                      <label
                        key={`${question.id}-${optionIndex}`}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                          selected
                            ? "border-[#c56d91] bg-[#3a1930] text-[#fde7ee] ring-1 ring-[#b45577]/70"
                            : "border-white/10 bg-black/15 text-stone-300 hover:border-[#a94f74]/55 hover:bg-[#281521]"
                        }`}
                      >
                        <input
                          type={isSingle ? "radio" : "checkbox"}
                          name={
                            isSingle
                              ? `question-${question.id}`
                              : `question-${question.id}-${optionIndex}`
                          }
                          value={option}
                          checked={!!selected}
                          onChange={() =>
                            isSingle
                              ? setAnswer(question.id, option)
                              : toggleMultiple(question.id, option)
                          }
                          className="h-4 w-4 shrink-0 accent-[#a82d5c]"
                        />
                        <span className="select-none">{option}</span>
                      </label>
                    );
                  })}

                  {question.type === "single" &&
                    question.followUpOption &&
                    value === question.followUpOption && (
                      <textarea
                        rows={3}
                        className={`${inputClass} animate-card-in resize-y`}
                        placeholder={
                          question.followUpPlaceholder || "Tell us more…"
                        }
                        value={
                          typeof followUpValue === "string" ? followUpValue : ""
                        }
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [followUpKey]: e.target.value,
                          }))
                        }
                      />
                    )}

                  {question.multipleMax != null && (
                    <p className="mt-1 text-xs text-stone-500">
                      Pick exactly {question.multipleMax} (
                      {selectedOptions.length}/{question.multipleMax})
                      {selectedOptions.length >= question.multipleMax
                        ? " — max reached, deselect one to swap"
                        : ""}
                    </p>
                  )}

                  {isMonsterQuestion && reachedMax && !hasMonster && (
                    <p className="mt-3 animate-card-in rounded-xl border border-[#c56d91]/40 bg-[#3a1930]/80 px-4 py-3 text-sm font-medium text-[#f0becf]">
                      Are you sure about leaving Monster outside? 😢🥤
                    </p>
                  )}
                </div>
              )}

              {showResponse && (
                <p className="mt-4 animate-card-in text-center text-sm italic text-[#bd91a2]">
                  {question.responseText}
                </p>
              )}

              {question.type === "runaway" && (
                <div className="relative h-40 select-none">
                  <button
                    type="button"
                    onClick={() => setAnswer(question.id, "Yes")}
                    aria-pressed={value === "Yes"}
                    className={`h-11 rounded-xl border px-7 text-sm font-semibold transition ${
                      value === "Yes"
                        ? "border-[#c56d91] bg-gradient-to-br from-[#8e204b] to-[#654075] text-white shadow-md shadow-black/30"
                        : "border-white/10 bg-black/20 text-stone-300 hover:border-[#b45577]/60 hover:bg-[#311728] hover:text-[#f0becf]"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onPointerEnter={dodgeNo}
                    onPointerDown={dodgeNo}
                    onFocus={dodgeNo}
                    aria-label="No"
                    className="absolute h-11 rounded-xl border border-white/10 bg-black/20 px-7 text-sm font-semibold text-stone-300 transition-all duration-150 ease-out"
                    style={{ left: `${noPos.left}%`, top: `${noPos.top}%` }}
                  >
                    No
                  </button>
                </div>
              )}

              {question.type === "image" && (
                <div className="grid grid-cols-2 gap-3">
                  {question.options.map((src, index) => {
                    const selected = value === src;
                    return (
                      <button
                        key={`${question.id}-${index}`}
                        type="button"
                        onClick={() => setAnswer(question.id, src)}
                        aria-pressed={selected}
                        className={`flex items-center justify-center rounded-2xl border p-3 transition ${
                          selected
                            ? "border-[#c56d91] bg-[#3a1930] ring-2 ring-[#b45577]/70"
                            : "border-white/10 bg-black/15 hover:border-[#b45577]/55 hover:bg-[#281521]"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Choice ${index + 1}`}
                          className="h-40 w-auto max-w-full object-contain"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {question.type === "datetime" && (
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                />
              )}
            </div>

            {errors[String(question.id)] && (
              <p className="mt-3 text-sm font-medium text-red-400">
                {errors[String(question.id)]}
              </p>
            )}
          </div>

          {submitError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/35 px-4 py-3 text-sm text-red-200">
              {submitError}
            </div>
          )}

          <div className="mt-7 flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={currentSafe === 0}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-400 transition hover:bg-white/5 hover:text-stone-100 disabled:pointer-events-none disabled:invisible"
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Back
            </button>
            {showNextButton && (
              <button
                type="submit"
                disabled={
                  submitting ||
                  (requiresExactMultipleChoices && !hasExactMultipleChoices)
                }
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#861d48] to-[#603a78] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-black/40 transition hover:from-[#a12759] hover:to-[#70448b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLast ? (submitting ? "Submitting…" : "Submit") : "Next"}
                {!isLast && <ChevronRightIcon className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
