"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useBlockNumber, useChainId, useSwitchChain } from "wagmi";
import { LOCAL_CHAIN_ID, SUPPORTED_CHAINS } from "@/config/chains";
import { getDeployment } from "@/config/deployments";

const DOT: Record<number, string> = {
  4663: "#e8b64c", // Robinhood mainnet — gold
  46630: "#3fe89e", // Robinhood testnet — emerald
  421614: "#8ea9ff", // Arbitrum Sepolia — blue
  [LOCAL_CHAIN_ID]: "#93b29f", // local — moon
};

function shortName(name: string) {
  return name
    .replace("Robinhood Chain Testnet", "RH Testnet")
    .replace("Robinhood Chain", "RH Mainnet")
    .replace("Arbitrum Sepolia", "Arb Sepolia")
    .replace("Greenwood (local)", "Greenwood");
}

/** Network picker — switches the app view, and the wallet too if connected. */
export function ChainSelect() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // live heartbeat: polls eth_blockNumber on the selected chain, so real
  // RPC traffic is visible (and provable) even before contracts exist there
  const { data: blockNumber, isError: rpcDown } = useBlockNumber({
    chainId,
    watch: true,
    query: { refetchInterval: 4_000 },
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = SUPPORTED_CHAINS.find((c) => c.id === chainId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost flex items-center gap-2 px-3 py-1.5 text-xs"
        title={`chainId ${chainId}`}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={
            rpcDown
              ? { background: "#ff7a70", boxShadow: "0 0 6px #ff7a70" }
              : { background: DOT[chainId] ?? "#93b29f", boxShadow: `0 0 6px ${DOT[chainId] ?? "#93b29f"}` }
          }
        />
        {isPending ? "Switching…" : shortName(current?.name ?? `Chain ${chainId}`)}
        {blockNumber !== undefined && !rpcDown && (
          <span className="font-mono text-[0.65rem] text-moon-700" title="latest block (live)">
            #{blockNumber.toString()}
          </span>
        )}
        {rpcDown && <span className="text-[0.65rem] text-blood-400">rpc down</span>}
        <svg width="9" height="5" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="glass-deep absolute right-0 z-40 mt-2 w-56 p-1.5"
          >
            {SUPPORTED_CHAINS.map((c) => {
              const deployed = Boolean(getDeployment(c.id));
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      switchChain({ chainId: c.id });
                      setOpen(false);
                    }}
                    className="row-hover flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm"
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: DOT[c.id] ?? "#93b29f" }}
                    />
                    <span className="flex-1">
                      <span className="block leading-tight">{shortName(c.name)}</span>
                      <span className="block text-[0.68rem] text-moon-700">
                        chainId {c.id}
                        {!deployed && " · not deployed yet"}
                      </span>
                    </span>
                    {c.id === chainId && <span className="text-gold-400">✓</span>}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Banner shown when the selected chain has no Loxley deployment. */
export function DeploymentNotice() {
  const chainId = useChainId();
  if (getDeployment(chainId)) return null;
  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  return (
    <div className="mx-auto mt-3 max-w-6xl px-4">
      <p className="glass rounded-xl px-4 py-3 text-center text-xs text-moon-500">
        Loxley isn&apos;t deployed on{" "}
        <span className="text-moon-100">{chain?.name ?? `chain ${chainId}`}</span>{" "}
        yet — deploy with{" "}
        <code className="font-mono text-gold-400">forge script script/Deploy.s.sol</code>{" "}
        and add the addresses to{" "}
        <code className="font-mono text-gold-400">deployments.ts</code>, or
        switch network above.
      </p>
    </div>
  );
}
