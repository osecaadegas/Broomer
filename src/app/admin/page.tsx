import { redirect } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/server";
import type { SupabaseQuestionRow } from "@/lib/supabase/types";
import { toQuestionFromSupabase } from "@/lib/questionnaire";
import { SiteHeader } from "@/components/SiteHeader";
import { QuestionManager } from "@/components/QuestionManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminSupabase();
  if (!admin) redirect("/admin/login");

  const { data, error } = await admin.supabase
    .from("questions")
    .select("*")
    .order("position")
    .order("id");
  if (error) throw error;

  const initial = (data as SupabaseQuestionRow[]).map(toQuestionFromSupabase);

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <header className="py-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Manage questions
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Add, edit, reorder, or remove the questions in your questionnaire.
          </p>
        </header>
        <QuestionManager initialQuestions={initial} />
      </div>
    </main>
  );
}
