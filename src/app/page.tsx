import { asc } from "drizzle-orm";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { toQuestion } from "@/lib/questionnaire";
import { QuestionnaireEntrance } from "@/components/QuestionnaireEntrance";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rows = await db
    .select()
    .from(questions)
    .orderBy(asc(questions.position), asc(questions.id));
  const initial = rows.map(toQuestion);

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#08060d]">
      {/* Atmospheric gothic background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#34203f_0%,_#171020_42%,_#08060d_78%)]" />
        <div className="gothic-pattern absolute inset-0 opacity-60" />
        <div className="absolute -left-28 top-1/4 h-80 w-80 rounded-full bg-[#6e163e]/30 blur-[120px]" />
        <div className="absolute -right-32 -top-24 h-96 w-96 rounded-full bg-[#4f2868]/35 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-96 rounded-full bg-[#42122f]/25 blur-[120px]" />
        <div className="gothic-vignette absolute inset-0" />
      </div>

      <div className="relative flex w-full flex-1 flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-md">
          <QuestionnaireEntrance questions={initial} />
        </div>
      </div>
    </main>
  );
}
