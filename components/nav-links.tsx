"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/brands", label: "Brands" },
  { href: "/influencers", label: "Influencers" },
  { href: "/value", label: "Know your value" },
  { href: "/import", label: "Data entry" },
  { href: "/results", label: "Results" },
  { href: "/admin", label: "Admin" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto text-sm">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`) || (l.href === "/brands" && pathname.startsWith("/campaigns"));
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
