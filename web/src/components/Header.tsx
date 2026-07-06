"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Wordmark";
import { ConnectControls } from "./ConnectControls";
import { Tip } from "./Tip";
import { ChainSelect, DeploymentNotice } from "./ChainSelect";

const LINKS = [
  { href: "/", label: "Swap", tip: "Trade tokens on the AMM." },
  { href: "/hoards", label: "Hoards", tip: "Liquidity pools — provide two tokens, earn 0.25% of every swap." },
  {
    href: "/share",
    label: "Merry Men's Share",
    tip: "Protocol-fee redistribution: weekly claims for small, active wallets.",
  },
  { href: "/bow", label: "Draw the Bow", tip: "Stake LOX for streamed rewards. No lockups." },
  { href: "/analytics", label: "Analytics", tip: "TVL, volume, and fees — read straight from on-chain events." },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="glass-deep mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl px-4 py-3 sm:px-5">
        <Link href="/" className="flex items-center gap-3">
          <Wordmark size={22} />
        </Link>

        <nav className="hidden items-center gap-6 text-[0.92rem] md:flex">
          {LINKS.map((l) => (
            <Tip key={l.href} tip={l.tip} side="bottom">
              <Link
                href={l.href}
                className={`nav-link whitespace-nowrap pb-0.5 ${pathname === l.href ? "active" : ""}`}
              >
                {l.label}
              </Link>
            </Tip>
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
