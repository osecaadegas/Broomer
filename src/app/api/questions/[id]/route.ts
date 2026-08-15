import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import type { SupabaseQuestionRow } from "@/lib/supabase/types";
import {
  hasOptions,
  isQuestionType,
  toQuestionFromSupabase,
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
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const questionId = parseId(id);
  if (!questionId) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await admin.supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
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
    depends_on?: number | null;
    condition_type?: string | null;
    condition_value?: string | null;
    follow_up_option?: string | null;
    follow_up_placeholder?: string | null;
    placeholder?: string | null;
    multiple_max?: number | null;
    response_text?: string | null;
    response_trigger?: string | null;
    updated_at?: string;
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
    update.depends_on = typeof dependsOn === "number" ? dependsOn : null;
  }
  if (conditionType !== undefined) {
    update.condition_type =
      typeof conditionType === "string" ? conditionType : null;
  }
  if (conditionValue !== undefined) {
    update.condition_value =
      typeof conditionValue === "string" ? conditionValue : null;
  }
  if (followUpOption !== undefined) {
    update.follow_up_option =
      typeof followUpOption === "string" ? followUpOption : null;
  }
  if (followUpPlaceholder !== undefined) {
    update.follow_up_placeholder =
      typeof followUpPlaceholder === "string" ? followUpPlaceholder : null;
  }
  if (placeholder !== undefined) {
    update.placeholder = typeof placeholder === "string" ? placeholder : null;
  }
  if (multipleMax !== undefined) {
    update.multiple_max = typeof multipleMax === "number" ? multipleMax : null;
  }
  if (responseText !== undefined) {
    update.response_text =
      typeof responseText === "string" ? responseText : null;
  }
  if (responseTrigger !== undefined) {
    update.response_trigger =
      typeof responseTrigger === "string" ? responseTrigger : null;
  }

  update.updated_at = new Date().toISOString();
  const { data: updated, error } = await admin.supabase
    .from("questions")
    .update(update)
    .eq("id", questionId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    question: toQuestionFromSupabase(updated as SupabaseQuestionRow),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const questionId = parseId(id);
  if (!questionId) {
    return NextResponse.json({ error: "Invalid question id" }, { status: 400 });
  }

  const { error } = await admin.supabase
    .from("questions")
    .delete()
    .eq("id", questionId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
