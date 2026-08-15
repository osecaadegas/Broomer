import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  const { ids } = (body ?? {}) as { ids?: unknown };

  if (
    !Array.isArray(ids) ||
    ids.some((id) => typeof id !== "number" && typeof id !== "string")
  ) {
    return NextResponse.json(
      { error: "ids must be an array of question ids" },
      { status: 400 },
    );
  }

  const numericIds = ids
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  if (numericIds.length === 0) {
    return NextResponse.json(
      { error: "No valid question ids" },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    numericIds.map((id, index) =>
      admin.supabase
        .from("questions")
        .update({ position: index + 1 })
        .eq("id", id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
