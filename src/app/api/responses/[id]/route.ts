import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { responses } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const responseId = Number(id);

  if (!Number.isInteger(responseId) || responseId <= 0) {
    return NextResponse.json({ error: "Invalid response id" }, { status: 400 });
  }

  await db.delete(responses).where(eq(responses.id, responseId));
  return NextResponse.json({ ok: true });
}
