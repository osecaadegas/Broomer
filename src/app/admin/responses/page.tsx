import { asc } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { toQuestion } from "@/lib/questionnaire";
import { SiteHeader } from "@/components/SiteHeader";
import { ResponseList } from "@/components/ResponseList";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const rows = await db
    .select()
    .from(questions)
    .orderBy(asc(questions.position), asc(questions.id));
  const initial = rows.map(toQuestion);

  return (
    <main className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <header className="py-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Responses
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Review answers submitted through your questionnaire.
          </p>
        </header>
        <ResponseList questions={initial} />
      </div>
    </main>
  );
}
