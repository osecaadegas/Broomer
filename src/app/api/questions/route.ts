import { NextResponse } from "next/server";
import { asc, max } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { hasOptions, isQuestionType, toQuestion } from "@/lib/questionnaire";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select()
    .from(questions)
    .orderBy(asc(questions.position), asc(questions.id));

  return NextResponse.json({ questions: rows.map(toQuestion) });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    prompt,
    type,
    options,
    required,
    dependsOn,
    conditionType,
    conditionValue,
    followUpOption,
    followUpPlaceholder,
    placeholder,
    multipleMax,
    responseText,
    responseTrigger,
  } = (body ?? {}) as {
    prompt?: unknown;
    type?: unknown;
    options?: unknown;
    required?: unknown;
    dependsOn?: unknown;
    conditionType?: unknown;
    conditionValue?: unknown;
    followUpOption?: unknown;
    followUpPlaceholder?: unknown;
    placeholder?: unknown;
    multipleMax?: unknown;
    responseText?: unknown;
    responseTrigger?: unknown;
  };

  const promptValue = typeof prompt === "string" ? prompt.trim() : "";
  if (!promptValue) {
    return NextResponse.json(
      { error: "Question text is required" },
      { status: 400 },
    );
  }

  if (!isQuestionType(type)) {
    return NextResponse.json({ error: "Invalid question type" }, { status: 400 });
  }

  let optionsValue: string[] = [];
  if (hasOptions(type) || type === "image") {
    if (!Array.isArray(options)) {
      return NextResponse.json(
        { error: "Options must be an array" },
        { status: 400 },
      );
    }
    optionsValue = options
      .map((option) => (typeof option === "string" ? option.trim() : ""))
      .filter(Boolean);
    if (optionsValue.length < 2) {
      return NextResponse.json(
        { error: "Provide at least two options" },
        { status: 400 },
      );
    }
  }

  const [maxRow] = await db
    .select({ value: max(questions.position) })
    .from(questions);
  const nextPosition = Number(maxRow?.value ?? 0) + 1;

  const [inserted] = await db
    .insert(questions)
    .values({
      prompt: promptValue,
      type,
      options: optionsValue,
      required: required === true,
      position: nextPosition,
      dependsOn:
        typeof dependsOn === "number" ? dependsOn : undefined,
      conditionType:
        typeof conditionType === "string" ? conditionType : undefined,
      conditionValue:
        typeof conditionValue === "string" ? conditionValue : undefined,
      followUpOption:
        typeof followUpOption === "string" ? followUpOption : undefined,
      followUpPlaceholder:
        typeof followUpPlaceholder === "string"
          ? followUpPlaceholder
          : undefined,
      placeholder:
        typeof placeholder === "string" ? placeholder : undefined,
      multipleMax:
        typeof multipleMax === "number" ? multipleMax : undefined,
      responseText:
        typeof responseText === "string" ? responseText : undefined,
      responseTrigger:
        typeof responseTrigger === "string" ? responseTrigger : undefined,
    })
    .returning();

  return NextResponse.json({ question: toQuestion(inserted) }, { status: 201 });
}
