import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { hasOptions, isQuestionType, type QuestionType } from "@/lib/questionnaire";

interface DraftQuestion {
  prompt: string;
  type: QuestionType;
  options: string[];
  required: boolean;
}

function readPassword(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const password = (body as { password?: unknown }).password;
  return typeof password === "string" && /^\d{3}$/.test(password)
    ? password
    : null;
}

function readQuestions(body: unknown): DraftQuestion[] | null {
  if (typeof body !== "object" || body === null) return null;
  const questions = (body as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 30) {
    return null;
  }

  const parsed: DraftQuestion[] = [];
  for (const raw of questions) {
    if (typeof raw !== "object" || raw === null) return null;
    const item = raw as Record<string, unknown>;
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    if (!prompt || prompt.length > 500 || !isQuestionType(item.type)) return null;
    if (["runaway", "image"].includes(item.type)) return null;

    const options = Array.isArray(item.options)
      ? item.options
          .map((option) => (typeof option === "string" ? option.trim() : ""))
          .filter(Boolean)
      : [];
    if (options.length > 12 || options.some((option) => option.length > 120)) {
      return null;
    }
    if (hasOptions(item.type) && options.length < 2) return null;

    parsed.push({
      prompt,
      type: item.type,
      options: hasOptions(item.type) ? options : [],
      required: item.required === true,
    });
  }

  return parsed;
}

async function readBody(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);
  const password = readPassword(body);
  if (!password) {
    return NextResponse.json({ error: "Enter a three-digit password" }, { status: 400 });
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("verify_uno_gate", {
    candidate: password,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data !== true) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const body = await readBody(request);
  const password = readPassword(body);
  const questions = readQuestions(body);
  if (!password || !questions) {
    return NextResponse.json({ error: "Invalid question set" }, { status: 400 });
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("replace_uno_questions", {
    candidate: password,
    draft: questions,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (data !== true) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}