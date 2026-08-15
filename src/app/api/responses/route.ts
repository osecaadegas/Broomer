import { NextResponse } from "next/server";
import {
  createPublicSupabaseClient,
  getAdminSupabase,
} from "@/lib/supabase/server";
import type {
  SupabaseQuestionRow,
  SupabaseResponseRow,
} from "@/lib/supabase/types";
import {
  isQuestionType,
  isQuestionVisible,
  RESPONSE_QUESTION_SNAPSHOTS_KEY,
  type QuestionSnapshot,
} from "@/lib/questionnaire";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await admin.supabase
    .from("responses")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const serialized = (data as SupabaseResponseRow[]).map((row) => {
    const stored = row.answers ?? {};
    const answers: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(stored)) {
      if (key === RESPONSE_QUESTION_SNAPSHOTS_KEY) continue;
      if (typeof value === "string") answers[key] = value;
      if (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
      ) {
        answers[key] = value;
      }
    }

    const rawSnapshots = stored[RESPONSE_QUESTION_SNAPSHOTS_KEY];
    const questionSnapshots: Record<string, QuestionSnapshot> = {};
    if (
      typeof rawSnapshots === "object" &&
      rawSnapshots !== null &&
      !Array.isArray(rawSnapshots)
    ) {
      for (const [key, value] of Object.entries(rawSnapshots)) {
        if (
          typeof value !== "object" ||
          value === null ||
          Array.isArray(value)
        ) {
          continue;
        }
        const snapshot = value as Record<string, unknown>;
        if (
          typeof snapshot.prompt === "string" &&
          isQuestionType(snapshot.type) &&
          Array.isArray(snapshot.options) &&
          snapshot.options.every((option) => typeof option === "string")
        ) {
          questionSnapshots[key] = {
            prompt: snapshot.prompt,
            type: snapshot.type,
            options: snapshot.options,
          };
        }
      }
    }

    return {
      id: row.id,
      answers,
      questionSnapshots,
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ responses: serialized });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { answers } = (body ?? {}) as { answers?: unknown };

  if (
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    return NextResponse.json(
      { error: "answers must be an object" },
      { status: 400 },
    );
  }

  const answerMap: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(
    answers as Record<string, unknown>,
  )) {
    if (typeof value === "string" && value.trim() !== "") {
      answerMap[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      answerMap[key] = value.filter((item) => item.trim() !== "");
    }
  }

  // Enforce required questions on the server as well.
  const supabase = createPublicSupabaseClient();
  const { data: questionData, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .order("position")
    .order("id");
  if (questionError) {
    return NextResponse.json({ error: questionError.message }, { status: 500 });
  }

  const allQuestions = questionData as SupabaseQuestionRow[];

  for (const question of allQuestions) {
    if (!question.required) continue;
    if (
      !isQuestionVisible(
        {
          dependsOn: question.depends_on,
          conditionType: question.condition_type,
          conditionValue: question.condition_value,
        },
        answerMap,
      )
    )
      continue;
    const value = answerMap[String(question.id)];
    const missing =
      value === undefined ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "string" && value.trim() === "");
    if (missing) {
      return NextResponse.json(
        { error: `"${question.prompt}" is required` },
        { status: 400 },
      );
    }
  }

  const questionSnapshots: Record<string, QuestionSnapshot> = {};
  for (const question of allQuestions) {
    const questionId = String(question.id);
    const hasStoredAnswer =
      answerMap[questionId] !== undefined ||
      answerMap[`${questionId}:followup`] !== undefined;
    if (!hasStoredAnswer || !isQuestionType(question.type)) continue;

    questionSnapshots[questionId] = {
      prompt: question.prompt,
      type: question.type,
      options: Array.isArray(question.options)
        ? question.options.filter(
            (option): option is string => typeof option === "string",
          )
        : [],
    };
  }

  const { error: insertError } = await supabase
    .from("responses")
    .insert({
      answers: {
        ...answerMap,
        [RESPONSE_QUESTION_SNAPSHOTS_KEY]: questionSnapshots,
      },
    });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
