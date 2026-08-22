import Link from "next/link";
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
import { CardVaultAdminControls } from "@/components/CardVaultAdminControls";
import {
  ClipboardIcon,
  ClipboardListIcon,
  PlusIcon,
  SparklesIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

type AdminSection = "entrance" | "uno" | "broom" | "cards";

const sections = [
  {
    id: "entrance" as const,
    label: "Entrance",
    description: "Passwords and quote",
    icon: SparklesIcon,
  },
  {
    id: "uno" as const,
    label: "UNO answers",
    description: "Answer their questions",
    icon: ClipboardIcon,
  },
  {
    id: "broom" as const,
    label: "Broom questions",
    description: "Manage the questionnaire",
    icon: ClipboardListIcon,
  },
  {
    id: "cards" as const,
    label: "Card vault",
    description: "Points and timer",
    icon: PlusIcon,
  },
];

function isAdminSection(value: string | undefined): value is AdminSection {
  return sections.some((section) => section.id === value);
}

export default async function AdminPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ section?: string }>;
}>) {
  const admin = await getAdminSupabase();
  if (!admin) redirect("/admin/login");
  const requestedSection = (await searchParams).section;
  const activeSection: AdminSection = isAdminSection(requestedSection)
    ? requestedSection
    : "entrance";
  const activeDetails = sections.find(
    (section) => section.id === activeSection,
  )!;

  const [questionsResult, settingsResult, unoQuestionsResult] =
    await Promise.all([
      admin.supabase
        .from("questions")
        .select("*")
        .order("position")
        .order("id"),
      admin.supabase.from("app_settings").select("*").eq("id", true).single(),
      admin.supabase
        .from("uno_questions")
        .select("*")
        .order("position")
        .order("id"),
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
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <header className="pb-6 pt-8 sm:pt-10">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Admin dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Control center
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Configure the entrance paths, quiz content, and card vault from
              one protected area.
            </p>
          </div>
        </header>

        <nav
          aria-label="Admin categories"
          className="grid gap-3 border-b border-slate-200 pb-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {sections.map((section) => {
            const active = section.id === activeSection;
            const Icon = section.icon;
            return (
              <Link
                key={section.id}
                href={`/admin?section=${section.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-20 items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                  active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/40"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {section.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {section.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <section className="pt-7" aria-labelledby="category-title">
          <div className="mb-6">
            <h2
              id="category-title"
              className="text-xl font-bold text-slate-900 sm:text-2xl"
            >
              {activeDetails.label}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {activeDetails.description}
            </p>
          </div>

          {activeSection === "entrance" && (
            <PlaneGateSettings
              initialPassword={settings.plane_password}
              initialUnoPassword={settings.uno_password}
              initialQuote={settings.quote_of_day}
            />
          )}
          {activeSection === "uno" && (
            <UnoAnswerManager questions={unoQuestions} />
          )}
          {activeSection === "broom" && (
            <QuestionManager initialQuestions={initial} />
          )}
          {activeSection === "cards" && <CardVaultAdminControls />}
        </section>
      </div>
    </main>
  );
}
