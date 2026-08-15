import { redirect } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/SiteHeader";
import { YappingInbox } from "@/components/YappingInbox";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const admin = await getAdminSupabase();
  if (!admin) redirect("/admin/login");

  return (
    <main className="min-h-screen bg-[#08060d]">
      <SiteHeader variant="gothic" />
      <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
        <header className="py-6 sm:py-8">
          <h1 className="font-serif text-2xl font-semibold italic text-[#efadc8] sm:text-3xl">
            Yapping inbox
          </h1>
          <p className="mt-1 text-sm text-stone-500 sm:text-base">
            Read visitor messages and reply from here.
          </p>
        </header>
        <YappingInbox />
      </div>
    </main>
  );
}
