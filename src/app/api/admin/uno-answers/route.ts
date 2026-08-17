import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import type { SupabaseUnoQuestionRow } from "@/lib/supabase/types";

function isValidAnswer(
  question: SupabaseUnoQuestionRow,
  answer: unknown,
): boolean {
  if (answer === null || answer === "") return !question.required;
  if (question.type === "multiple") {
    return (
      Array.isArray(answer) &&
      answer.every((value) => typeof value === "string" && value.length <= 500)
    );
  }
  return typeof answer === "string" && answer.length <= 4000;
}

export async function PUT(request: Request) {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const answers =
    typeof body === "object" && body !== null
      ? (body as { answers?: unknown }).answers
      : null;
  if (
    typeof answers !== "object" ||
    answers === null ||
    Array.isArray(answers)
  ) {
    return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
  }

  const { data, error: readError } = await admin.supabase
    .from("uno_questions")
    .select("*")
    .order("position")
    .order("id");
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const questions = data as SupabaseUnoQuestionRow[];
  const answerMap = answers as Record<string, unknown>;
  for (const question of questions) {
    if (!isValidAnswer(question, answerMap[String(question.id)] ?? null)) {
      return NextResponse.json(
        { error: `Invalid answer for "${question.prompt}"` },
        { status: 400 },
      );
    }
  }

  const updates = await Promise.all(
    questions.map((question) =>
      admin.supabase
        .from("uno_questions")
        .update({
          answer: answerMap[String(question.id)] ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", question.id),
    ),
  );
  const failed = updates.find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
