"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Overview" },
  { href: "/income-statement", label: "Income Statement" },
  { href: "/balance-sheet", label: "Balance Sheet" },
  { href: "/integrations", label: "Integrations" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-black/[.06] dark:bg-white/[.08] text-foreground"
                : "text-black/60 dark:text-white/60 hover:bg-black/[.04] dark:hover:bg-white/[.04]"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
