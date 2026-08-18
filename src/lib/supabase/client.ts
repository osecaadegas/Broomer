import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const browserGlobal = globalThis as typeof globalThis & {
  broomerSupabase?: SupabaseClient;
  broomerSupabaseStorageKey?: string;
};

export function createBrowserSupabaseClient() {
  if (browserGlobal.broomerSupabase) return browserGlobal.broomerSupabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase browser configuration is missing");
  }

  browserGlobal.broomerSupabaseStorageKey ??= `broomer-chess-${crypto.randomUUID()}`;
  browserGlobal.broomerSupabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: browserGlobal.broomerSupabaseStorageKey,
    },
  });
  return browserGlobal.broomerSupabase;
}
