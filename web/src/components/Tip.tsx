"use client";

import type { ReactNode } from "react";

/**
 * Hover translation for themed controls: a small glass tooltip giving the
 * plain on-chain meaning. CSS-only (group-hover + focus-within), so it adds
 * no listeners; hidden on touch devices, where PlainTerms panels carry the
 * explanation instead.
 */
export function Tip({
  tip,
  children,
  side = "top",
  block = false,
}: {
  tip: string;
  children: ReactNode;
  /** which side the bubble appears on */
  side?: "top" | "bottom";
  /** wrap as block (for full-width buttons) instead of inline */
  block?: boolean;
}) {
  const pos =
    side === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";
  return (
    <span
      className={`group relative ${block ? "block w-full" : "inline-flex"}`}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 hidden w-max max-w-[280px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#06150d] px-3 py-2 text-left text-[0.72rem] font-normal normal-case leading-snug tracking-normal text-moon-300 opacity-0 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.8)] transition-opacity delay-200 duration-150 [font-family:var(--font-body)] group-hover:opacity-100 group-focus-within:opacity-100 sm:block ${pos}`}
      >
        {tip}
      </span>
    </span>
  );
}
