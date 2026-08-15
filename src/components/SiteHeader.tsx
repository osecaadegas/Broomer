"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardListIcon } from "@/components/icons";

const links = [
  { href: "/", label: "Survey" },
  { href: "/admin", label: "Questions" },
  { href: "/admin/responses", label: "Answers" },
  { href: "/admin/chat", label: "Chat" },
];

function navLinkClass(active: boolean, gothic: boolean) {
  if (active && gothic) return "bg-[#35172a] text-[#efadc8]";
  if (active) return "bg-indigo-50 text-indigo-700";
  if (gothic) return "text-stone-500 hover:bg-white/5 hover:text-stone-200";
  return "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
}

interface Props {
  variant?: "light" | "gothic";
}

export function SiteHeader({ variant = "light" }: Readonly<Props>) {
  const pathname = usePathname();
  const gothic = variant === "gothic";

  return (
    <header
      className={`sticky top-0 z-40 border-b backdrop-blur-md ${
        gothic
          ? "border-[#8b5b79]/30 bg-[#100a13]/90"
          : "border-slate-200/70 bg-white/85"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className={`flex items-center gap-2 font-semibold tracking-tight ${
            gothic ? "text-[#e6c4d4]" : "text-slate-900"
          }`}
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-lg text-white shadow-sm ${
              gothic ? "border border-[#d8b566]/30 bg-[#6e163e]" : "bg-indigo-600"
            }`}
          >
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
                className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${navLinkClass(active, gothic)}`}
              >
                {link.label}
              </Link>
            );
          })}
          <form action="/admin/logout" method="post">
            <button
              type="submit"
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                gothic
                  ? "text-stone-500 hover:bg-white/5 hover:text-stone-200"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
