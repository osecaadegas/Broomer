import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import type { PlaneAnswer } from "@/lib/supabase/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const password = (body as { password?: unknown } | null)?.password;
  if (typeof password !== "string" || !/^\d{3}$/.test(password)) {
    return NextResponse.json(
      { error: "Enter a three-digit password" },
      { status: 400 },
    );
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase.rpc("get_plane_reveal", {
    candidate: password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : null;
  if (!result || typeof result.quote !== "string") {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const answers = Array.isArray(result.answers)
    ? result.answers.filter((item: unknown): item is PlaneAnswer => {
        if (typeof item !== "object" || item === null) return false;
        const answer = (item as Record<string, unknown>).answer;
        return (
          typeof (item as Record<string, unknown>).question === "string" &&
          (typeof answer === "string" ||
            (Array.isArray(answer) &&
              answer.every((value) => typeof value === "string")))
        );
      })
    : [];

  return NextResponse.json({ quote: result.quote, answers });
}
