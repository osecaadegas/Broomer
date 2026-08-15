import Link from "next/link";

export default function HomePage() {
  return (
    <main className="grid min-h-svh place-items-center bg-[#f3f1eb] px-5 text-[#20231f]">
      <section className="w-full max-w-sm border-t-2 border-[#20231f] py-8">
        <p className="text-xs font-semibold uppercase text-[#667064]">
          Broomer
        </p>
        <h1 className="mt-3 font-serif text-4xl">Private Workspace</h1>
        <Link
          href="/admin/login"
          className="mt-8 inline-flex min-h-11 items-center bg-[#20231f] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20231f]"
        >
          Sign in
        </Link>
      </section>
    </main>
  );
}
