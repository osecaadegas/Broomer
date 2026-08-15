"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardListIcon } from "@/components/icons";

const links = [
  { href: "/", label: "Survey" },
  { href: "/admin", label: "Questions" },
  { href: "/admin/responses", label: "Answers" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-slate-900"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <ClipboardListIcon className="h-4.5 w-4.5" />
          </span>
          <span className="hidden text-sm sm:inline sm:text-base">
            Questionnaire
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1" aria-label="Main">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:px-3 sm:text-sm"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
