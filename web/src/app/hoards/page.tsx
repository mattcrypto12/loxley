"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { PlainTerms } from "@/components/PlainTerms";
import { TokenBadge } from "@/components/TokenBadge";
import { fmtUsd, fmtPct } from "@/lib/format";
import { poolTvlUsd, useDeployment, usePools, usePrices } from "@/lib/hooks";
import { useSwapHistory, volumeSince } from "@/lib/history";

const LP_FEE_SHARE = 0.25 / 0.3; // LPs keep 25 of the 30 bps

export default function HoardsPage() {
  const { address } = useAccount();
  const deployment = useDeployment();
  const { data: pools, isLoading } = usePools();
  const { prices } = usePrices(pools);
  const { data: history } = useSwapHistory(pools, prices);

  const { data: lpBalances } = useReadContracts({
    contracts: (pools ?? []).map((p) => ({
      address: p.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address ?? "0x0000000000000000000000000000000000000000"] as const,
    })),
    query: { enabled: Boolean(address && pools?.length) },
  });

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="rise-in engraved text-3xl font-semibold">The Hoards</h1>
          <p className="rise-in rise-in-1 mt-2 max-w-xl text-sm text-moon-500">
            Every Hoard is a constant-product pool. Liquidity providers earn
            0.25% of every swap; the remaining 0.05% is split evenly between
            the Merry Men&apos;s Share and the guild.
          </p>
          <PlainTerms
            summary="liquidity pools — each Hoard is a Uniswap-v2-style pair contract."
            contracts={[{ label: "Factory", key: "factory" }]}
          >
            Deposit two tokens in ratio and receive LP tokens representing
            your share of the pool; swap fees accrue into the reserves, so
            LP tokens appreciate against withdrawal. &quot;Bury treasure&quot;
            = add liquidity, &quot;dig it up&quot; = burn LP tokens for the
            underlying. APR estimates annualize the last 24h of fees against
            current pool value. Each pool&apos;s address is on its page.
          </PlainTerms>
        </div>
        <Link href="/hoards/new" className="btn-gold rise-in rise-in-2 px-4 py-2.5 text-sm">
          + Found a new Hoard
        </Link>
      </header>

      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-moon-700">
              <th className="px-5 py-4 font-medium">Hoard</th>
              <th className="px-5 py-4 text-right font-medium">TVL</th>
              <th className="px-5 py-4 text-right font-medium">Volume 24h</th>
              <th className="px-5 py-4 text-right font-medium">LP APR est.</th>
              <th className="px-5 py-4 text-right font-medium">Your share</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {!deployment ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-moon-700">
                  No Hoards on this chain — Loxley isn&apos;t deployed here yet.
                  Switch network in the header.
                </td>
              </tr>
            ) : (
              isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-moon-700">
                    Scouting the greenwood…
                  </td>
                </tr>
              )
            )}
            {pools?.map((pool, i) => {
              const tvl = poolTvlUsd(pool, prices);
              const vol24 = history ? volumeSince(history.swaps, 24, pool.address) : 0;
              const apr = tvl > 0 ? ((vol24 * 0.003 * LP_FEE_SHARE * 365) / tvl) * 100 : 0;
              const lpBal = lpBalances?.[i]?.result as bigint | undefined;
              const shareOfPool =
                lpBal !== undefined && pool.totalSupply > 0n
                  ? Number((lpBal * 1_000_000n) / pool.totalSupply) / 10_000
                  : 0;

              return (
                <motion.tr
                  key={pool.address}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="row-hover border-t border-white/5"
                >
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-2">
                      <span className="flex -space-x-2">
                        <TokenBadge symbol={pool.token0.symbol} size={28} />
                        <TokenBadge symbol={pool.token1.symbol} size={28} />
                      </span>
                      <span className="font-semibold">
                        {pool.token0.symbol}·{pool.token1.symbol}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-mono">{fmtUsd(tvl)}</td>
                  <td className="px-5 py-4 text-right font-mono">{fmtUsd(vol24)}</td>
                  <td className="px-5 py-4 text-right font-mono text-ember-400">
                    {fmtPct(apr)}
                  </td>
                  <td className="px-5 py-4 text-right font-mono text-moon-500">
                    {shareOfPool > 0 ? fmtPct(shareOfPool) : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/hoards/${pool.address}`}
                      className="btn-ghost inline-block px-3.5 py-1.5 text-xs"
                    >
                      Manage
                    </Link>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
