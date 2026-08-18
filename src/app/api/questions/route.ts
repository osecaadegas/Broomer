import { NextResponse } from "next/server";
import {
  createPublicSupabaseClient,
  getAdminSupabase,
} from "@/lib/supabase/server";
import type { SupabaseQuestionRow } from "@/lib/supabase/types";
import {
  hasOptions,
  isCandleGate,
  isQuestionType,
  toQuestionFromSupabase,
} from "@/lib/questionnaire";

export const dynamic = "force-dynamic";

function getDependsOnValue(
  candleGate: unknown,
  dependsOn: unknown,
): number | null {
  if (isCandleGate(candleGate)) return -candleGate;
  return typeof dependsOn === "number" ? dependsOn : null;
}

export async function GET() {
  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .order("position")
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    questions: (data as SupabaseQuestionRow[]).map(toQuestionFromSupabase),
  });
}

export async function POST(request: Request) {
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
    candleGate,
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
    candleGate?: unknown;
  };

  const promptValue = typeof prompt === "string" ? prompt.trim() : "";
  if (!promptValue) {
    return NextResponse.json(
      { error: "Question text is required" },
      { status: 400 },
    );
  }

  if (!isQuestionType(type)) {
    return NextResponse.json(
      { error: "Invalid question type" },
      { status: 400 },
    );
  }

  if (
    candleGate !== undefined &&
    candleGate !== null &&
    !isCandleGate(candleGate)
  ) {
    return NextResponse.json(
      { error: "Candle gate must be between 1 and 5" },
      { status: 400 },
    );
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

  const { data: lastQuestion, error: positionError } = await admin.supabase
    .from("questions")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) {
    return NextResponse.json({ error: positionError.message }, { status: 500 });
  }

  const nextPosition = Number(lastQuestion?.position ?? 0) + 1;
  const { data: inserted, error } = await admin.supabase
    .from("questions")
    .insert({
      prompt: promptValue,
      type,
      options: optionsValue,
      required: required === true,
      position: nextPosition,
      depends_on: getDependsOnValue(candleGate, dependsOn),
      condition_type: typeof conditionType === "string" ? conditionType : null,
      condition_value:
        typeof conditionValue === "string" ? conditionValue : null,
      follow_up_option:
        typeof followUpOption === "string" ? followUpOption : null,
      follow_up_placeholder:
        typeof followUpPlaceholder === "string" ? followUpPlaceholder : null,
      placeholder: typeof placeholder === "string" ? placeholder : null,
      multiple_max: typeof multipleMax === "number" ? multipleMax : null,
      response_text: typeof responseText === "string" ? responseText : null,
      response_trigger:
        typeof responseTrigger === "string" ? responseTrigger : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { question: toQuestionFromSupabase(inserted as SupabaseQuestionRow) },
    { status: 201 },
  );
}
