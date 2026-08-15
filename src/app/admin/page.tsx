import { redirect } from "next/navigation";
import { getAuthorizedSupabase } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { SessionLock } from "@/components/SessionLock";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authorized = await getAuthorizedSupabase();
  if (!authorized) redirect("/admin/login");

  return (
    <SessionLock>
      <main className="min-h-svh bg-[#f3f1eb] text-[#20231f]">
        <SiteHeader />
        <section className="mx-auto max-w-3xl px-5 py-16">
          <p className="text-xs font-semibold uppercase text-[#667064]">
            Authenticated
          </p>
          <h1 className="mt-3 font-serif text-4xl">Private Workspace</h1>
          <p className="mt-5 max-w-xl leading-7 text-[#596057]">
            Messaging and temporary-data features are unavailable while the
            end-to-end encryption protocol is being completed and verified.
          </p>
        </section>
      </main>
    </SessionLock>
  );
}
