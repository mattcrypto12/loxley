"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { formatEther, type ContractFunctionParameters } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { merryMenAbi } from "@/abi/merryMen";
import { pairAbi } from "@/abi/pair";
import { ShareFlow } from "@/components/ShareFlow";
import { TokenBadge } from "@/components/TokenBadge";
import { fmtAmount } from "@/lib/format";
import { useDeployment, usePools } from "@/lib/hooks";

export default function SharePage() {
  const { address: user, isConnected } = useAccount();
  const deployment = useDeployment();
  const { data: pools } = usePools();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const share = deployment?.merryMenShare;

  const coreContracts: ContractFunctionParameters[] = share
    ? [
        { address: share, abi: merryMenAbi, functionName: "currentEpoch" },
        { address: share, abi: merryMenAbi, functionName: "wealthThreshold" },
        { address: share, abi: merryMenAbi, functionName: "genesis" },
        ...(user
          ? [{ address: share, abi: merryMenAbi, functionName: "lastActive", args: [user] }]
          : []),
      ]
    : [];

  const { data: coreData, refetch: refetchCore } = useReadContracts({
    contracts: coreContracts,
    query: { enabled: Boolean(share), refetchInterval: 8_000 },
  });

  const currentEpoch = coreData?.[0]?.result as bigint | undefined;
  const wealthThreshold = coreData?.[1]?.result as bigint | undefined;
  const genesis = coreData?.[2]?.result as bigint | undefined;
  const lastActive = coreData?.[3]?.result as bigint | undefined;

  // countdown to epoch end
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  const EPOCH_LENGTH = 7 * 86400;
  const epochEnd =
    genesis !== undefined && currentEpoch !== undefined
      ? Number(genesis) + (Number(currentEpoch) + 1) * EPOCH_LENGTH
      : undefined;
  const remaining = epochEnd !== undefined ? Math.max(0, epochEnd - now) : undefined;

  // user's ETH balance vs threshold
  const { data: ethBal } = useBalance({ address: user });

  // treasury holdings: LP balance of the share contract per pool
  const { data: holdings } = useReadContracts({
    contracts: (pools ?? []).map((p) => ({
      address: p.address,
      abi: pairAbi,
      functionName: "balanceOf" as const,
      args: [share ?? "0x0000000000000000000000000000000000000000"] as const,
    })),
    query: { enabled: Boolean(share && pools?.length), refetchInterval: 8_000 },
  });

  // recent epochs (current and up to 3 back)
  const epochIds = useMemo(() => {
    if (currentEpoch === undefined) return [];
    const ids: bigint[] = [];
    for (let e = currentEpoch; e >= 0n && ids.length < 4; e--) ids.push(e);
    return ids;
  }, [currentEpoch]);

  const epochContracts: ContractFunctionParameters[] = epochIds.flatMap((e) => [
    { address: share!, abi: merryMenAbi, functionName: "finalized", args: [e] },
    { address: share!, abi: merryMenAbi, functionName: "totalPoints", args: [e] },
    {
      address: share!,
      abi: merryMenAbi,
      functionName: "points",
      args: [e, user ?? "0x0000000000000000000000000000000000000000"],
    },
    {
      address: share!,
      abi: merryMenAbi,
      functionName: "claimed",
      args: [e, user ?? "0x0000000000000000000000000000000000000000"],
    },
    {
      address: share!,
      abi: merryMenAbi,
      functionName: "pendingSpoils",
      args: [user ?? "0x0000000000000000000000000000000000000000", e],
    },
  ]);

  const { data: epochData, refetch: refetchEpochs } = useReadContracts({
    contracts: epochContracts,
    query: { enabled: Boolean(share && epochIds.length), refetchInterval: 8_000 },
  });

  const epochs = epochIds.map((e, i) => {
    const base = i * 5;
    const pending = epochData?.[base + 4]?.result as
      | readonly [readonly `0x${string}`[], readonly bigint[]]
      | undefined;
    return {
      id: e,
      finalized: Boolean(epochData?.[base]?.result),
      totalPoints: (epochData?.[base + 1]?.result as bigint | undefined) ?? 0n,
      myPoints: (epochData?.[base + 2]?.result as bigint | undefined) ?? 0n,
      claimed: Boolean(epochData?.[base + 3]?.result),
      pendingTokens: pending?.[0] ?? [],
      pendingAmounts: pending?.[1] ?? [],
    };
  });

  const activeWithin30d =
    lastActive !== undefined && lastActive > 0n && now - Number(lastActive) <= 30 * 86400;
  const belowThreshold =
    ethBal !== undefined && wealthThreshold !== undefined
      ? ethBal.value <= wealthThreshold
      : undefined;
  const myEpochPoints = epochs.find((e) => e.id === currentEpoch)?.myPoints ?? 0n;

  async function act(fn: () => Promise<`0x${string}`>, label: string) {
    if (!publicClient) return;
    setBusy(label);
    setNotice(null);
    try {
      const hash = await fn();
      await publicClient.waitForTransactionReceipt({ hash });
      refetchCore();
      refetchEpochs();
      setNotice(`${label} — done.`);
    } catch (e) {
      setNotice(
        (e instanceof Error ? e.message : "Failed").split("\n")[0].slice(0, 120),
      );
    } finally {
      setBusy(null);
    }
  }

  const fmtCountdown = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="rise-in engraved text-3xl font-semibold">
          The Merry Men&apos;s <span className="text-gold-400 text-glow-gold">Share</span>
        </h1>
        <p className="rise-in rise-in-1 mt-2 max-w-2xl text-sm leading-relaxed text-moon-500">
          A twentieth of every fee — 0.05% of all volume — is carved off the
          rich flow of trade and returned to the smallfolk: wallets under{" "}
          <span className="font-mono text-gold-400">
            {wealthThreshold !== undefined ? `${formatEther(wealthThreshold)} ETH` : "…"}
          </span>{" "}
          who swapped or provided liquidity in the last 30 days. All of it
          on-chain, all of it inspectable.
        </p>
      </header>

      <div className="rise-in rise-in-2">
        <ShareFlow />
      </div>

      {/* epoch + eligibility row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* current epoch */}
        <div className="glass p-5">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-moon-700">
            Current epoch
          </h2>
          <p className="engraved text-4xl text-moon-100">
            {currentEpoch !== undefined ? `№ ${currentEpoch}` : "…"}
          </p>
          <p className="mt-2 font-mono text-sm text-ember-400">
            {remaining !== undefined ? `${fmtCountdown(remaining)} until the divvy` : ""}
          </p>
          <p className="mt-3 text-xs leading-relaxed text-moon-500">
            When the epoch closes, anyone may ring the bell
            (finalize) — then every eligible wallet claims its cut, weighted
            by activity.
          </p>
        </div>

        {/* eligibility */}
        <div className="glass p-5">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-moon-700">
            Your standing
          </h2>
          {isConnected ? (
            <ul className="space-y-2.5 text-sm">
              <Check
                ok={myEpochPoints > 0n}
                label={`Activity this epoch — ${myEpochPoints.toString()} point${myEpochPoints === 1n ? "" : "s"}`}
              />
              <Check
                ok={activeWithin30d}
                label={
                  activeWithin30d
                    ? "Seen in the greenwood these 30 days"
                    : "No activity in the last 30 days"
                }
              />
              <Check
                ok={Boolean(belowThreshold)}
                label={
                  belowThreshold === undefined
                    ? "Checking your purse…"
                    : belowThreshold
                      ? "Purse below the threshold — smallfolk"
                      : "Purse too heavy — the rich don't claim"
                }
              />
            </ul>
          ) : (
            <p className="text-sm text-moon-500">
              Connect to see whether the Merry Men count you among their own.
            </p>
          )}
        </div>

        {/* treasury chest */}
        <div className="glass p-5">
          <h2 className="mb-3 text-xs uppercase tracking-widest text-moon-700">
            The chest holds
          </h2>
          <ul className="space-y-2">
            {pools?.map((p, i) => {
              const bal = holdings?.[i]?.result as bigint | undefined;
              if (!bal || bal === 0n)
                return null;
              return (
                <li key={p.address} className="flex items-center gap-2 text-sm">
                  <span className="flex -space-x-1.5">
                    <TokenBadge symbol={p.token0.symbol} size={20} />
                    <TokenBadge symbol={p.token1.symbol} size={20} />
                  </span>
                  <span className="text-moon-300">
                    {p.token0.symbol}·{p.token1.symbol}
                  </span>
                  <span className="ml-auto font-mono text-gold-400">
                    {fmtAmount(bal, 18)} LP
                  </span>
                </li>
              );
            })}
            {holdings &&
              holdings.every((h) => !(h.result as bigint | undefined)) && (
                <li className="text-sm text-moon-700">
                  Empty for now — the next trade starts filling it.
                </li>
              )}
          </ul>
        </div>
      </div>

      {/* epochs table */}
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-moon-700">
              <th className="px-5 py-4 font-medium">Epoch</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 text-right font-medium">Total points</th>
              <th className="px-5 py-4 text-right font-medium">Your points</th>
              <th className="px-5 py-4 text-right font-medium">Your spoils</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody>
            {epochs.map((e) => {
              const isCurrent = e.id === currentEpoch;
              const claimable =
                e.finalized &&
                !e.claimed &&
                e.myPoints > 0n &&
                e.pendingAmounts.some((a) => a > 0n);
              return (
                <tr key={e.id.toString()} className="row-hover border-t border-white/5">
                  <td className="px-5 py-4 font-mono">№ {e.id.toString()}</td>
                  <td className="px-5 py-4">
                    {isCurrent ? (
                      <span className="text-ember-400">gathering</span>
                    ) : e.finalized ? (
                      <span className="text-gold-400">divvied</span>
                    ) : (
                      <span className="text-moon-500">awaiting the bell</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-mono">{e.totalPoints.toString()}</td>
                  <td className="px-5 py-4 text-right font-mono">{e.myPoints.toString()}</td>
                  <td className="px-5 py-4 text-right font-mono text-gold-400">
                    {e.claimed
                      ? "claimed ✓"
                      : e.pendingAmounts.some((a) => a > 0n)
                        ? `${e.pendingAmounts.filter((a) => a > 0n).length} token${e.pendingAmounts.filter((a) => a > 0n).length > 1 ? "s" : ""}`
                        : "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!isCurrent && !e.finalized && share && pools && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="btn-ghost px-3 py-1.5 text-xs"
                        disabled={busy !== null}
                        onClick={() =>
                          act(
                            () =>
                              writeContractAsync({
                                address: share,
                                abi: merryMenAbi,
                                functionName: "finalizeEpoch",
                                args: [e.id, pools.map((p) => p.address)],
                              }),
                            `Epoch ${e.id} finalized`,
                          )
                        }
                      >
                        Ring the bell
                      </motion.button>
                    )}
                    {claimable && share && (
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        className="btn-gold px-3.5 py-1.5 text-xs"
                        disabled={busy !== null}
                        onClick={() =>
                          act(
                            () =>
                              writeContractAsync({
                                address: share,
                                abi: merryMenAbi,
                                functionName: "claim",
                                args: [e.id],
                              }),
                            `Epoch ${e.id} spoils claimed`,
                          )
                        }
                      >
                        Claim your cut
                      </motion.button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(busy || notice) && (
        <p className="text-center text-sm text-moon-500">{busy ?? notice}</p>
      )}
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[0.65rem] ${
          ok
            ? "bg-ember-500/20 text-ember-300 ring-1 ring-ember-500/50"
            : "bg-blood-400/10 text-blood-400 ring-1 ring-blood-400/40"
        }`}
      >
        {ok ? "✓" : "✕"}
      </span>
      <span className={ok ? "text-moon-300" : "text-moon-500"}>{label}</span>
    </li>
  );
}
