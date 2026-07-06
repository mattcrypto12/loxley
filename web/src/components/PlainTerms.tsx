"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useChainId } from "wagmi";
import { explorerAddressUrl } from "@/config/chains";
import { useDeployment, type Pool } from "@/lib/hooks";
import { shortAddr } from "@/lib/format";
import type { Deployment } from "@/config/deployments";

export interface ContractRef {
  label: string;
  /** key into the current chain's deployment record */
  key: keyof Deployment;
}

/**
 * The legend, translated. A quiet ⓘ toggle that expands into the plain
 * on-chain explanation of a themed feature: standard DeFi terminology plus
 * the actual contract addresses, linked to the block explorer.
 */
export function PlainTerms({
  summary,
  children,
  contracts = [],
}: {
  /** one-line plain-DeFi name, e.g. "constant-product AMM (Uniswap-v2 design)" */
  summary: string;
  children: React.ReactNode;
  contracts?: ContractRef[];
}) {
  const [open, setOpen] = useState(false);
  const chainId = useChainId();
  const deployment = useDeployment();

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs transition-colors ${
          open ? "text-gold-400" : "text-moon-700 hover:text-moon-300"
        }`}
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full border text-[0.6rem] ${
            open ? "border-gold-500/60" : "border-moon-700/60"
          }`}
        >
          i
        </span>
        in plain terms
        <svg
          width="8"
          height="5"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="overflow-hidden"
          >
            <div className="glass-inset mt-2 max-w-2xl p-4 text-xs leading-relaxed">
              <p className="mb-1.5">
                <span className="font-semibold text-ember-400">Plainly: </span>
                <span className="text-moon-300">{summary}</span>
              </p>
              <div className="text-moon-500">{children}</div>
              {contracts.length > 0 && deployment && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-2.5 font-mono text-[0.68rem]">
                  {contracts.map(({ label, key }) => {
                    const addr = deployment[key];
                    if (!addr) return null;
                    const url = explorerAddressUrl(chainId, addr);
                    return url ? (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-moon-500 transition-colors hover:text-gold-400"
                        title={addr}
                      >
                        {label}: {shortAddr(addr)} ↗
                      </a>
                    ) : (
                      <span key={key} className="text-moon-700" title={addr}>
                        {label}: {shortAddr(addr)}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Convenience: pool-address chip for pages scoped to one Hoard. */
export function PoolPlainRef({ pool }: { pool: Pool }) {
  const chainId = useChainId();
  const url = explorerAddressUrl(chainId, pool.address);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[0.68rem] text-moon-500 hover:text-gold-400"
      title={pool.address}
    >
      pool: {shortAddr(pool.address)} ↗
    </a>
  ) : (
    <span className="font-mono text-[0.68rem] text-moon-700" title={pool.address}>
      pool: {shortAddr(pool.address)}
    </span>
  );
}
