import { redirect } from "next/navigation";
import {
  createServerSupabaseClient,
  getAdminSupabase,
} from "@/lib/supabase/server";

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || data.user?.app_metadata.role !== "admin") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=invalid");
  }

  redirect("/admin");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const admin = await getAdminSupabase();
  if (admin) redirect("/admin");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        action={signIn}
        className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        <h1 className="text-2xl font-bold text-white">Admin sign in</h1>
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-300">
            Invalid credentials or this account is not an administrator.
          </p>
        )}
        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-fuchsia-700 px-4 py-2 font-semibold text-white hover:bg-fuchsia-600"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
