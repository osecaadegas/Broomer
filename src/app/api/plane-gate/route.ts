import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/server";

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
  const { data, error } = await supabase.rpc("verify_plane_gate", {
    candidate: password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : null;
  if (!result || typeof result.quote !== "string") {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  return NextResponse.json({ quote: result.quote });
}