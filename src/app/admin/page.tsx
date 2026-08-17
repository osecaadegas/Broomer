import { redirect } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabase/server";
import type {
  SupabaseAppSettingsRow,
  SupabaseQuestionRow,
  SupabaseUnoQuestionRow,
} from "@/lib/supabase/types";
import { toQuestionFromSupabase } from "@/lib/questionnaire";
import { SiteHeader } from "@/components/SiteHeader";
import { QuestionManager } from "@/components/QuestionManager";
import { PlaneGateSettings } from "@/components/PlaneGateSettings";
import { UnoAnswerManager } from "@/components/UnoAnswerManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminSupabase();
  if (!admin) redirect("/admin/login");

  const [questionsResult, settingsResult, unoQuestionsResult] = await Promise.all([
    admin.supabase.from("questions").select("*").order("position").order("id"),
    admin.supabase.from("app_settings").select("*").eq("id", true).single(),
    admin.supabase.from("uno_questions").select("*").order("position").order("id"),
  ]);
  if (questionsResult.error) throw questionsResult.error;
  if (settingsResult.error) throw settingsResult.error;
  if (unoQuestionsResult.error) throw unoQuestionsResult.error;

  const initial = (questionsResult.data as SupabaseQuestionRow[]).map(
    toQuestionFromSupabase,
  );
  const settings = settingsResult.data as SupabaseAppSettingsRow;
  const unoQuestions = unoQuestionsResult.data as SupabaseUnoQuestionRow[];

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
        <PlaneGateSettings
          initialPassword={settings.plane_password}
          initialUnoPassword={settings.uno_password}
          initialQuote={settings.quote_of_day}
        />
        <UnoAnswerManager questions={unoQuestions} />
        <QuestionManager initialQuestions={initial} />
      </div>
    </main>
  );
}
