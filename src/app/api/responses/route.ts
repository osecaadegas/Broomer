import { NextResponse } from "next/server";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { questions, responses } from "@/db/schema";
import { isQuestionVisible } from "@/lib/questionnaire";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(responses)
    .orderBy(desc(responses.createdAt), desc(responses.id));

  const serialized = rows.map((row) => ({
    id: row.id,
    answers: row.answers ?? {},
    createdAt: row.createdAt.toISOString(),
  }));

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
  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
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
  const allQuestions = await db
    .select()
    .from(questions)
    .orderBy(asc(questions.position), asc(questions.id));

  for (const question of allQuestions) {
    if (!question.required) continue;
    if (!isQuestionVisible(question, answerMap)) continue;
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

  const [inserted] = await db
    .insert(responses)
    .values({ answers: answerMap })
    .returning();

  return NextResponse.json(
    {
      response: {
        id: inserted.id,
        answers: inserted.answers,
        createdAt: inserted.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
