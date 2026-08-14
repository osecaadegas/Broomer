import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (numericIds.length === 0) {
    return NextResponse.json({ error: "No valid question ids" }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    for (let index = 0; index < numericIds.length; index += 1) {
      await tx
        .update(questions)
        .set({ position: index + 1 })
        .where(eq(questions.id, numericIds[index]));
    }
  });

  return NextResponse.json({ ok: true });
}
