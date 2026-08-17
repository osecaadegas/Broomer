import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/server";
import type { SupabaseAppSettingsRow } from "@/lib/supabase/types";

export async function GET() {
  const admin = await getAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await admin.supabase
    .from("app_settings")
    .select("*")
    .eq("id", true)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data as SupabaseAppSettingsRow });
}

export async function PATCH(request: Request) {
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

  const { planePassword, unoPassword, quoteOfDay } = (body ?? {}) as {
    planePassword?: unknown;
    unoPassword?: unknown;
    quoteOfDay?: unknown;
  };
  if (typeof planePassword !== "string" || !/^\d{3}$/.test(planePassword)) {
    return NextResponse.json(
      { error: "Password must contain exactly three digits" },
      { status: 400 },
    );
  }
  if (typeof unoPassword !== "string" || !/^\d{3}$/.test(unoPassword)) {
    return NextResponse.json(
      { error: "UNO password must contain exactly three digits" },
      { status: 400 },
    );
  }

  const quote = typeof quoteOfDay === "string" ? quoteOfDay.trim() : "";
  if (!quote || quote.length > 500) {
    return NextResponse.json(
      { error: "Quote must be between 1 and 500 characters" },
      { status: 400 },
    );
  }

  const { data, error } = await admin.supabase
    .from("app_settings")
    .update({
      plane_password: planePassword,
      uno_password: unoPassword,
      quote_of_day: quote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data as SupabaseAppSettingsRow });
}
