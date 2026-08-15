import type { SupabaseQuestionRow } from "@/lib/supabase/types";

export const QUESTION_TYPES = [
  "short",
  "long",
  "single",
  "multiple",
  "rating",
  "number",
  "runaway",
  "image",
  "datetime",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface Question {
  id: number;
  prompt: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  position: number;
  dependsOn: number | null;
  conditionType: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | null;
  conditionValue: string | null;
  followUpOption: string | null;
  followUpPlaceholder: string | null;
  placeholder: string | null;
  multipleMax: number | null;
  responseText: string | null;
  responseTrigger: string | null;
  createdAt: string;
  updatedAt: string;
}

export type Answers = Record<string, string | string[]>;

export const RESPONSE_QUESTION_SNAPSHOTS_KEY = "__questionSnapshots";

export interface QuestionSnapshot {
  prompt: string;
  type: QuestionType;
  options: string[];
}

/**
 * Evaluates whether a question should be shown based on the answers so far.
 * A question with no `dependsOn` is always visible.
 */
export function isQuestionVisible(
  question: {
    dependsOn: number | null;
    conditionType: string | null;
    conditionValue: string | null;
  },
  answers: Answers,
): boolean {
  if (question.dependsOn == null) return true;

  const raw = answers[String(question.dependsOn)];
  const target = Number(question.conditionValue);

  const numRaw = Number(raw);
  const isNumeric = !Number.isNaN(numRaw) && !Number.isNaN(target);

  switch (question.conditionType) {
    case "gt":
      return isNumeric
        ? numRaw > target
        : String(raw) > String(question.conditionValue);
    case "gte":
      return isNumeric
        ? numRaw >= target
        : String(raw) >= String(question.conditionValue);
    case "lt":
      return isNumeric
        ? numRaw < target
        : String(raw) < String(question.conditionValue);
    case "lte":
      return isNumeric
        ? numRaw <= target
        : String(raw) <= String(question.conditionValue);
    case "eq":
      return String(raw) === String(question.conditionValue);
    case "neq":
      return String(raw) !== String(question.conditionValue);
    default:
      return true;
  }
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short: "Short answer",
  long: "Long answer",
  single: "Single choice",
  multiple: "Multiple choice",
  rating: "Rating",
  number: "Number",
  runaway: "Yes / No (runaway)",
  image: "Image choice",
  datetime: "Date & time",
};

export const QUESTION_TYPE_HINTS: Record<QuestionType, string> = {
  short: "A single-line text input",
  long: "A multi-line text area",
  single: "Respondents pick exactly one option",
  multiple: "Respondents can pick one or more options",
  rating: "A rating scale",
  number: "A numeric input",
  runaway: "The No button playfully dodges every tap",
  image: "Respondents pick one of the displayed images",
  datetime: "A calendar date and time picker",
};

export function isQuestionType(value: unknown): value is QuestionType {
  return (
    typeof value === "string" &&
    (QUESTION_TYPES as readonly string[]).includes(value)
  );
}

export function hasOptions(type: QuestionType): boolean {
  return type === "single" || type === "multiple";
}

/**
 * Returns true for question types where selecting an answer should
 * auto-advance to the next question (no "Next" button needed).
 */
export function isPickType(type: QuestionType): boolean {
  return (
    type === "single" ||
    type === "multiple" ||
    type === "rating" ||
    type === "image" ||
    type === "runaway"
  );
}

/**
 * Returns the numeric values to show for a rating question. Defaults to 1–5,
 * but supports a custom scale (e.g. 1–10) when the question stores one in its
 * `options` field.
 */
export function ratingScale(question: { options: string[] }): number[] {
  const parsed = question.options
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b);
  return parsed.length > 1 ? parsed : [1, 2, 3, 4, 5];
}

export function toQuestionFromSupabase(row: SupabaseQuestionRow): Question {
  const rawOptions = Array.isArray(row.options) ? row.options : [];
  return {
    id: row.id,
    prompt: row.prompt,
    type: row.type as QuestionType,
    options: rawOptions.filter(
      (option): option is string => typeof option === "string",
    ),
    required: row.required,
    position: row.position,
    dependsOn: row.depends_on,
    conditionType: row.condition_type as Question["conditionType"],
    conditionValue: row.condition_value,
    followUpOption: row.follow_up_option,
    followUpPlaceholder: row.follow_up_placeholder,
    placeholder: row.placeholder,
    multipleMax: row.multiple_max,
    responseText: row.response_text,
    responseTrigger: row.response_trigger,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
