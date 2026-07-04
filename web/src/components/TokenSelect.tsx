"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { TokenInfo } from "@/config/deployments";
import { TokenBadge } from "./TokenBadge";

export function TokenSelect({
  tokens,
  selected,
  exclude,
  onSelect,
}: {
  tokens: TokenInfo[];
  selected: TokenInfo;
  exclude?: TokenInfo;
  onSelect: (t: TokenInfo) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choices = tokens.filter(
    (t) =>
      !(
        exclude &&
        t.address === exclude.address &&
        Boolean(t.isNative) === Boolean(exclude.isNative)
      ),
  );

  return (
    <div className="relative" ref={ref}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost flex items-center gap-2 px-3 py-2"
      >
        <TokenBadge symbol={selected.symbol} size={26} />
        <span className="font-semibold">{selected.symbol}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="glass-deep absolute right-0 z-30 mt-2 w-60 overflow-hidden p-1.5"
          >
            {choices.map((t) => (
              <li key={`${t.address}-${t.isNative ? "native" : "erc20"}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(t);
                    setOpen(false);
                  }}
                  className="row-hover flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
                >
                  <TokenBadge symbol={t.symbol} size={30} />
                  <span>
                    <span className="block font-semibold leading-tight">{t.symbol}</span>
                    <span className="block text-xs text-moon-500">{t.name}</span>
                  </span>
                  {t.symbol === selected.symbol && (
                    <span className="ml-auto text-gold-400">✓</span>
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
