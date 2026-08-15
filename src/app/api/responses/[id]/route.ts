import { NextResponse } from "next/server";
import {
  createSecretSupabaseClient,
  getAdminSupabase,
} from "@/lib/supabase/server";
import { RESPONSE_MOOD_SELFIE_PATH_KEY } from "@/lib/questionnaire";

export const dynamic = "force-dynamic";
const MOOD_SELFIE_BUCKET = "mood-selfies";

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

  const { data: storedResponse, error: readError } = await admin.supabase
    .from("responses")
    .select("answers")
    .eq("id", responseId)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const { error } = await admin.supabase
    .from("responses")
    .delete()
    .eq("id", responseId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const answers = storedResponse?.answers as Record<string, unknown> | null;
  const selfiePath = answers?.[RESPONSE_MOOD_SELFIE_PATH_KEY];
  const secretSupabase = createSecretSupabaseClient();
  if (typeof selfiePath === "string" && secretSupabase) {
    await secretSupabase.storage.from(MOOD_SELFIE_BUCKET).remove([selfiePath]);
  }

  return NextResponse.json({ ok: true });
}
