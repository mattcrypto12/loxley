"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  erc20Abi,
  formatUnits,
  maxUint256,
  type Address,
} from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { routerAbi } from "@/abi/router";
import { pairAbi } from "@/abi/pair";
import { Tip } from "@/components/Tip";
import { TokenBadge } from "@/components/TokenBadge";
import { fmtAmount, fmtUsd, parseAmount } from "@/lib/format";
import { poolTvlUsd, useDeployment, usePools, usePrices } from "@/lib/hooks";
import { deadlineFromNow } from "@/lib/swap";

const spring = { type: "spring" as const, stiffness: 420, damping: 30 };

export default function HoardDetailPage() {
  const params = useParams<{ address: string }>();
  const hoard = params.address as Address;

  const { address: user, isConnected } = useAccount();
  const deployment = useDeployment();
  const { data: pools, refetch } = usePools();
  const { prices } = usePrices(pools);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const pool = pools?.find(
    (p) => p.address.toLowerCase() === hoard.toLowerCase(),
  );

  const [tab, setTab] = useState<"add" | "remove">("add");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [lastEdited, setLastEdited] = useState<0 | 1>(0);
  const [removePct, setRemovePct] = useState(50);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isWethPool =
    deployment &&
    pool &&
    (pool.token0.address.toLowerCase() === deployment.weth.toLowerCase() ||
      pool.token1.address.toLowerCase() === deployment.weth.toLowerCase());
  const wethIsToken0 =
    deployment && pool
      ? pool.token0.address.toLowerCase() === deployment.weth.toLowerCase()
      : false;

  // display symbol: show ETH for the WETH side (we route through addLiquidityETH)
  const displaySymbol = (idx: 0 | 1) => {
    if (!pool) return "";
    const t = idx === 0 ? pool.token0 : pool.token1;
    if (isWethPool && ((idx === 0 && wethIsToken0) || (idx === 1 && !wethIsToken0)))
      return "ETH";
    return t.symbol;
  };

  // ── derived amounts keep pool ratio ─────────────────────────
  const parsed0 = pool ? parseAmount(amount0, pool.token0.decimals) : null;
  const parsed1 = pool ? parseAmount(amount1, pool.token1.decimals) : null;

  const effective = useMemo(() => {
    if (!pool) return { a0: null as bigint | null, a1: null as bigint | null };
    if (pool.reserve0 === 0n || pool.reserve1 === 0n)
      return { a0: parsed0, a1: parsed1 };
    if (lastEdited === 0 && parsed0 !== null) {
      return { a0: parsed0, a1: (parsed0 * pool.reserve1) / pool.reserve0 };
    }
    if (lastEdited === 1 && parsed1 !== null) {
      return { a0: (parsed1 * pool.reserve0) / pool.reserve1, a1: parsed1 };
    }
    return { a0: null, a1: null };
  }, [pool, parsed0, parsed1, lastEdited]);

  // ── balances / position ─────────────────────────────────────
  const { data: lpBalance, refetch: refetchLp } = useReadContract({
    address: hoard,
    abi: pairAbi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });

  const { data: nativeBal } = useBalance({ address: user });
  const { data: bal0 } = useReadContract({
    address: pool?.token0.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user && pool) },
  });
  const { data: bal1 } = useReadContract({
    address: pool?.token1.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user && pool) },
  });

  if (!pool || !deployment) {
    return (
      <p className="py-20 text-center text-moon-700">
        {pools ? "This Hoard is not on the map." : "Scouting the greenwood…"}
      </p>
    );
  }

  const tvl = poolTvlUsd(pool, prices);
  const shareOfPool =
    lpBalance !== undefined && pool.totalSupply > 0n
      ? Number(((lpBalance as bigint) * 1_000_000n) / pool.totalSupply) / 10_000
      : 0;
  const positionUsd = (tvl * shareOfPool) / 100;

  const balanceFor = (idx: 0 | 1) => {
    const isEthSide =
      isWethPool && ((idx === 0 && wethIsToken0) || (idx === 1 && !wethIsToken0));
    if (isEthSide) return nativeBal?.value;
    return (idx === 0 ? bal0 : bal1) as bigint | undefined;
  };

  async function ensureApproval(token: Address, amount: bigint) {
    if (!user || !publicClient || !deployment) return;
    const allowance = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, deployment.router],
    });
    if (allowance < amount) {
      setBusy("Blessing the coin…");
      const h = await writeContractAsync({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [deployment.router, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
    }
  }

  async function addLiquidity() {
    if (!user || !publicClient || !deployment || !pool) return;
    const { a0, a1 } = effective;
    if (a0 === null || a1 === null || a0 === 0n || a1 === 0n) return;
    setError(null);
    try {
      const deadline = deadlineFromNow(20);
      // 0.5% tolerance on the ratio
      const min0 = (a0 * 995n) / 1000n;
      const min1 = (a1 * 995n) / 1000n;

      let hash: `0x${string}`;
      if (isWethPool) {
        const tokenSide = wethIsToken0 ? pool.token1 : pool.token0;
        const tokenAmt = wethIsToken0 ? a1 : a0;
        const ethAmt = wethIsToken0 ? a0 : a1;
        const minToken = wethIsToken0 ? min1 : min0;
        const minEth = wethIsToken0 ? min0 : min1;
        await ensureApproval(tokenSide.address, tokenAmt);
        setBusy("Adding to the Hoard…");
        hash = await writeContractAsync({
          address: deployment.router,
          abi: routerAbi,
          functionName: "addLiquidityETH",
          args: [tokenSide.address, tokenAmt, minToken, minEth, user, deadline],
          value: ethAmt,
        });
      } else {
        await ensureApproval(pool.token0.address, a0);
        await ensureApproval(pool.token1.address, a1);
        setBusy("Adding to the Hoard…");
        hash = await writeContractAsync({
          address: deployment.router,
          abi: routerAbi,
          functionName: "addLiquidity",
          args: [
            pool.token0.address,
            pool.token1.address,
            a0,
            a1,
            min0,
            min1,
            user,
            deadline,
          ],
        });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      setAmount0("");
      setAmount1("");
      refetch();
      refetchLp();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Transaction failed")
          .split("\n")[0]
          .slice(0, 140),
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeLiquidity() {
    if (!user || !publicClient || !deployment || !pool || lpBalance === undefined)
      return;
    const liquidity = ((lpBalance as bigint) * BigInt(removePct)) / 100n;
    if (liquidity === 0n) return;
    setError(null);
    try {
      // LP token approval for the router
      const allowance = await publicClient.readContract({
        address: pool.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [user, deployment.router],
      });
      if (allowance < liquidity) {
        setBusy("Blessing the token…");
        const h = await writeContractAsync({
          address: pool.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [deployment.router, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }

      // expected outputs with 0.5% tolerance
      const out0 = (pool.reserve0 * liquidity) / pool.totalSupply;
      const out1 = (pool.reserve1 * liquidity) / pool.totalSupply;
      const min0 = (out0 * 995n) / 1000n;
      const min1 = (out1 * 995n) / 1000n;
      const deadline = deadlineFromNow(20);

      setBusy("Reclaiming your share…");
      let hash: `0x${string}`;
      if (isWethPool) {
        const tokenSide = wethIsToken0 ? pool.token1 : pool.token0;
        const minToken = wethIsToken0 ? min1 : min0;
        const minEth = wethIsToken0 ? min0 : min1;
        hash = await writeContractAsync({
          address: deployment.router,
          abi: routerAbi,
          functionName: "removeLiquidityETH",
          args: [tokenSide.address, liquidity, minToken, minEth, user, deadline],
        });
      } else {
        hash = await writeContractAsync({
          address: deployment.router,
          abi: routerAbi,
          functionName: "removeLiquidity",
          args: [
            pool.token0.address,
            pool.token1.address,
            liquidity,
            min0,
            min1,
            user,
            deadline,
          ],
        });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      refetch();
      refetchLp();
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Transaction failed")
          .split("\n")[0]
          .slice(0, 140),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/hoards" className="text-xs text-moon-500 hover:text-gold-400">
        ← All Hoards
      </Link>

      <header className="mb-6 mt-3 flex flex-wrap items-center gap-4">
        <span className="flex -space-x-2">
          <TokenBadge symbol={pool.token0.symbol} size={40} />
          <TokenBadge symbol={pool.token1.symbol} size={40} />
        </span>
        <div>
          <h1 className="engraved text-2xl font-semibold">
            {displaySymbol(0)}·{displaySymbol(1)} Hoard
          </h1>
          <p className="font-mono text-xs text-moon-700">{pool.address}</p>
        </div>
      </header>

      {/* stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="TVL" value={fmtUsd(tvl)} />
        <Stat
          label={`${displaySymbol(0)} reserve`}
          value={fmtAmount(pool.reserve0, pool.token0.decimals)}
        />
        <Stat
          label={`${displaySymbol(1)} reserve`}
          value={fmtAmount(pool.reserve1, pool.token1.decimals)}
        />
        <Stat
          label="Your position"
          value={shareOfPool > 0 ? `${fmtUsd(positionUsd)} · ${shareOfPool.toFixed(2)}%` : "—"}
        />
      </div>

      <div className="glass p-5">
        {/* tabs */}
        <div className="mb-5 flex gap-2">
          {(["add", "remove"] as const).map((t) => (
            <Tip
              key={t}
              tip={
                t === "add"
                  ? "Add liquidity: deposit both tokens in ratio, receive LP tokens representing your pool share."
                  : "Remove liquidity: burn LP tokens, withdraw your share of both tokens (fees included)."
              }
              side="bottom"
            >
              <button
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  tab === t
                    ? "bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/40"
                    : "text-moon-500 hover:text-moon-100"
                }`}
              >
                {t === "add" ? "Bury treasure" : "Dig it up"}
              </button>
            </Tip>
          ))}
        </div>

        {tab === "add" ? (
          <div className="space-y-3">
            {([0, 1] as const).map((idx) => {
              const token = idx === 0 ? pool.token0 : pool.token1;
              const value =
                lastEdited === idx
                  ? idx === 0
                    ? amount0
                    : amount1
                  : effective[idx === 0 ? "a0" : "a1"] !== null
                    ? formatUnits(
                        effective[idx === 0 ? "a0" : "a1"]!,
                        token.decimals,
                      )
                    : "";
              const bal = balanceFor(idx);
              return (
                <div key={idx} className="glass-inset p-4">
                  <div className="mb-1 flex justify-between text-xs text-moon-500">
                    <span>{idx === 0 ? "First coin" : "Second coin"}</span>
                    {bal !== undefined && (
                      <span>
                        Purse: {fmtAmount(bal, token.decimals)} {displaySymbol(idx)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      className="amount-input !text-xl"
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={value}
                      onChange={(e) => {
                        setLastEdited(idx);
                        if (idx === 0) setAmount0(e.target.value);
                        else setAmount1(e.target.value);
                      }}
                    />
                    <span className="flex items-center gap-2 font-semibold">
                      <TokenBadge symbol={token.symbol} size={26} />
                      {displaySymbol(idx)}
                    </span>
                  </div>
                </div>
              );
            })}

            <Tip
              tip="Sends the add-liquidity transaction (with a token approval first if needed). You receive LP tokens for your share."
              block
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={spring}
                className="btn-gold w-full py-3.5"
                disabled={
                  !isConnected ||
                  busy !== null ||
                  effective.a0 === null ||
                  effective.a1 === null ||
                  effective.a0 === 0n
                }
                onClick={addLiquidity}
              >
                {busy ?? (isConnected ? "Bury treasure" : "Connect to provide")}
              </motion.button>
            </Tip>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass-inset p-4">
              <div className="mb-3 flex items-end justify-between">
                <span className="text-xs text-moon-500">Withdraw</span>
                <span className="font-mono text-3xl text-moon-100">{removePct}%</span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={removePct}
                onChange={(e) => setRemovePct(Number(e.target.value))}
                className="w-full accent-[#e8b64c]"
              />
              <div className="mt-2 flex gap-2">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRemovePct(p)}
                    className="btn-ghost px-3 py-1 text-xs"
                  >
                    {p}%
                  </button>
                ))}
              </div>
              {lpBalance !== undefined && pool.totalSupply > 0n && (
                <p className="mt-3 text-xs text-moon-500">
                  You reclaim ≈{" "}
                  <span className="font-mono text-moon-300">
                    {fmtAmount(
                      (pool.reserve0 *
                        (((lpBalance as bigint) * BigInt(removePct)) / 100n)) /
                        pool.totalSupply,
                      pool.token0.decimals,
                    )}{" "}
                    {displaySymbol(0)}
                  </span>{" "}
                  +{" "}
                  <span className="font-mono text-moon-300">
                    {fmtAmount(
                      (pool.reserve1 *
                        (((lpBalance as bigint) * BigInt(removePct)) / 100n)) /
                        pool.totalSupply,
                      pool.token1.decimals,
                    )}{" "}
                    {displaySymbol(1)}
                  </span>
                </p>
              )}
            </div>

            <Tip
              tip="Burns the selected share of your LP tokens and withdraws both tokens to your wallet (accrued fees included)."
              block
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={spring}
                className="btn-gold w-full py-3.5"
                disabled={
                  !isConnected ||
                  busy !== null ||
                  lpBalance === undefined ||
                  (lpBalance as bigint) === 0n
                }
                onClick={removeLiquidity}
              >
                {busy ??
                  (lpBalance !== undefined && (lpBalance as bigint) > 0n
                    ? "Dig it up"
                    : "No buried treasure here")}
              </motion.button>
            </Tip>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-blood-400/10 px-3 py-2 text-xs text-blood-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-inset px-4 py-3">
      <p className="text-[0.68rem] uppercase tracking-wider text-moon-700">{label}</p>
      <p className="mt-0.5 truncate font-mono text-sm text-moon-100">{value}</p>
    </div>
  );
}
