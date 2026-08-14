import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const responseId = Number(id);

  if (!Number.isInteger(responseId) || responseId <= 0) {
    return NextResponse.json({ error: "Invalid response id" }, { status: 400 });
  }

  const { error } = await admin.supabase
    .from("responses")
    .delete()
    .eq("id", responseId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
