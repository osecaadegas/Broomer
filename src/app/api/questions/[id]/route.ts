import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import {
  hasOptions,
  isQuestionType,
  toQuestion,
  type QuestionType,
} from "@/lib/questionnaire";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const questionId = parseId(id);
  if (!questionId) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId));
  if (!existing) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

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

  const update: {
    prompt?: string;
    type?: QuestionType;
    options?: string[];
    required?: boolean;
    dependsOn?: number | null;
    conditionType?: string | null;
    conditionValue?: string | null;
    followUpOption?: string | null;
    followUpPlaceholder?: string | null;
    placeholder?: string | null;
    multipleMax?: number | null;
    responseText?: string | null;
    responseTrigger?: string | null;
  } = {};

  if (prompt !== undefined) {
    const promptValue = typeof prompt === "string" ? prompt.trim() : "";
    if (!promptValue) {
      return NextResponse.json(
        { error: "Question text is required" },
        { status: 400 },
      );
    }
    update.prompt = promptValue;
  }

  if (type !== undefined) {
    if (!isQuestionType(type)) {
      return NextResponse.json(
        { error: "Invalid question type" },
        { status: 400 },
      );
    }
    update.type = type;
  }

  if (options !== undefined || type !== undefined) {
    const effectiveType = (type ?? existing.type) as QuestionType;
    if (hasOptions(effectiveType)) {
      const raw =
        options !== undefined
          ? Array.isArray(options)
            ? options
            : []
          : existing.options;
      const cleaned = (raw as unknown[])
        .map((option) => (typeof option === "string" ? option.trim() : ""))
        .filter(Boolean);
      if (cleaned.length < 2) {
        return NextResponse.json(
          { error: "Provide at least two options" },
          { status: 400 },
        );
      }
      update.options = cleaned;
    } else if (effectiveType === "rating" || effectiveType === "image") {
      // Preserve custom option values (rating scale or image URLs) unless new
      // ones are explicitly provided.
      const raw = Array.isArray(options) ? options : [];
      const cleaned = raw
        .map((option) => (typeof option === "string" ? option.trim() : ""))
        .filter(Boolean);
      update.options =
        cleaned.length > 0 ? cleaned : (existing.options as string[]);
    } else {
      update.options = [];
    }
  }

  if (required !== undefined) {
    update.required = required === true;
  }

  if (dependsOn !== undefined) {
    update.dependsOn = typeof dependsOn === "number" ? dependsOn : null;
  }
  if (conditionType !== undefined) {
    update.conditionType =
      typeof conditionType === "string" ? conditionType : null;
  }
  if (conditionValue !== undefined) {
    update.conditionValue =
      typeof conditionValue === "string" ? conditionValue : null;
  }
  if (followUpOption !== undefined) {
    update.followUpOption =
      typeof followUpOption === "string" ? followUpOption : null;
  }
  if (followUpPlaceholder !== undefined) {
    update.followUpPlaceholder =
      typeof followUpPlaceholder === "string" ? followUpPlaceholder : null;
  }
  if (placeholder !== undefined) {
    update.placeholder =
      typeof placeholder === "string" ? placeholder : null;
  }
  if (multipleMax !== undefined) {
    update.multipleMax =
      typeof multipleMax === "number" ? multipleMax : null;
  }
  if (responseText !== undefined) {
    update.responseText =
      typeof responseText === "string" ? responseText : null;
  }
  if (responseTrigger !== undefined) {
    update.responseTrigger =
      typeof responseTrigger === "string" ? responseTrigger : null;
  }

  const [updated] = await db
    .update(questions)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(questions.id, questionId))
    .returning();

  return NextResponse.json({ question: toQuestion(updated) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const questionId = parseId(id);
  if (!questionId) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  await db.delete(questions).where(eq(questions.id, questionId));
  return NextResponse.json({ ok: true });
}
