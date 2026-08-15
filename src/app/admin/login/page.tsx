import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  getAuthorizedSupabase,
} from "@/lib/supabase/server";

async function signIn(formData: FormData) {
  "use server";

  const emailValue = formData.get("email");
  const passwordValue = formData.get("password");
  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const password = typeof passwordValue === "string" ? passwordValue : "";
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || data.user?.app_metadata.broomer_authorized !== true) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=invalid");
  }

  redirect("/admin");
}

export default async function AdminLoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ error?: string }>;
}>) {
  const authorized = await getAuthorizedSupabase();
  if (authorized) redirect("/admin");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f3f1eb] px-5 text-[#20231f]">
      <form
        action={signIn}
        className="w-full max-w-sm border-t-2 border-[#20231f] py-8"
      >
        <p className="text-xs font-semibold uppercase text-[#667064]">
          Broomer
        </p>
        <h1 className="mt-3 font-serif text-4xl">Private Workspace</h1>
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            <span>Email</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 min-h-11 w-full border border-[#858d82] bg-white px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium">
            <span>Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 min-h-11 w-full border border-[#858d82] bg-white px-3 py-2"
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 text-sm text-[#9b2d2d]">
            Sign-in failed. Check your credentials and try again.
          </p>
        )}
        <button
          type="submit"
          className="mt-6 min-h-11 w-full bg-[#20231f] px-4 py-2 font-semibold text-white hover:bg-[#353b34]"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
