"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { ConnectControls } from "./ConnectControls";
import { ChainSelect, DeploymentNotice } from "./ChainSelect";

const LINKS = [
  { href: "/", label: "Swap" },
  { href: "/hoards", label: "Hoards" },
  { href: "/share", label: "Merry Men's Share" },
  { href: "/bow", label: "Draw the Bow" },
  { href: "/analytics", label: "Analytics" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="glass-deep mx-auto mt-4 flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-5 py-3">
        <Link href="/" className="flex items-center gap-3">
          <Wordmark size={22} />
        </Link>

        <nav className="hidden items-center gap-6 text-[0.92rem] md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`nav-link whitespace-nowrap pb-0.5 ${pathname === l.href ? "active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          <ChainSelect />
          <ConnectControls />
        </div>
      </div>

      <DeploymentNotice />

      {/* mobile nav */}
      <nav className="mx-auto mt-2 flex max-w-6xl items-center justify-center gap-5 px-4 text-sm md:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`nav-link pb-0.5 ${pathname === l.href ? "active" : ""}`}
          >
            {l.label.replace("Merry Men's Share", "Share").replace("Draw the Bow", "Bow")}
          </Link>
        ))}
      </nav>
    </header>
  );
}
