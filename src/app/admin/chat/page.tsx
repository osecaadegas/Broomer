import { redirect } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { YappingInbox } from "@/components/YappingInbox";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const admin = await getAdminSupabase();
  if (!admin) redirect("/admin/login");

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        <header className="py-6 sm:py-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Yapping inbox
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Read visitor messages and reply from here.
          </p>
        </header>
        <YappingInbox />
      </div>
    </main>
  );
}