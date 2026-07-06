"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { erc20Abi, formatUnits, maxUint256, type Address } from "viem";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { routerAbi } from "@/abi/router";
import { TokenSelect } from "@/components/TokenSelect";
import { fmtAmount, parseAmount } from "@/lib/format";
import { useDeployment, usePools, useTokens } from "@/lib/hooks";
import { deadlineFromNow, erc20Address } from "@/lib/swap";
import type { TokenInfo } from "@/config/deployments";

const spring = { type: "spring" as const, stiffness: 420, damping: 30 };

export default function NewHoardPage() {
  const nav = useRouter();
  const { address: user, isConnected } = useAccount();
  const deployment = useDeployment();
  const tokens = useTokens();
  const { data: pools, refetch } = usePools();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tokenA, setTokenA] = useState<TokenInfo | null>(null);
  const [tokenB, setTokenB] = useState<TokenInfo | null>(null);
  const [amountAInput, setAmountAInput] = useState("");
  const [amountBInput, setAmountBInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tA = tokenA ?? tokens.find((t) => t.isNative) ?? tokens[0];
  const tB = tokenB ?? tokens.find((t) => t.symbol === "ALE") ?? tokens[1];

  const amountA = tA ? parseAmount(amountAInput, tA.decimals) : null;
  const amountB = tB ? parseAmount(amountBInput, tB.decimals) : null;

  // does this Hoard already exist?
  const existing = useMemo(() => {
    if (!pools || !deployment || !tA || !tB) return undefined;
    const a = erc20Address(tA, deployment.weth).toLowerCase();
    const b = erc20Address(tB, deployment.weth).toLowerCase();
    if (a === b) return null;
    return pools.find((p) => {
      const p0 = p.token0.address.toLowerCase();
      const p1 = p.token1.address.toLowerCase();
      return (p0 === a && p1 === b) || (p0 === b && p1 === a);
    });
  }, [pools, deployment, tA, tB]);

  const sameToken =
    tA && tB && deployment &&
    erc20Address(tA, deployment.weth).toLowerCase() ===
      erc20Address(tB, deployment.weth).toLowerCase();

  const initialPrice =
    amountA && amountB && amountA > 0n && amountB > 0n && tA && tB
      ? Number(formatUnits(amountB, tB.decimals)) /
        Number(formatUnits(amountA, tA.decimals))
      : null;

  // balances for both sides
  const { data: nativeBal } = useBalance({ address: user });
  const { data: balA } = useReadContract({
    address: tA && !tA.isNative ? tA.address : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user && tA && !tA.isNative) },
  });
  const { data: balB } = useReadContract({
    address: tB && !tB.isNative ? tB.address : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user && tB && !tB.isNative) },
  });
  const balanceFor = (t: TokenInfo | null, fallback?: bigint) =>
    t?.isNative ? nativeBal?.value : fallback;

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

  async function foundHoard() {
    if (!user || !publicClient || !deployment || !tA || !tB) return;
    if (!amountA || !amountB || amountA === 0n || amountB === 0n) return;
    setError(null);
    try {
      const deadline = deadlineFromNow(20);
      let hash: `0x${string}`;
      if (tA.isNative || tB.isNative) {
        const ethAmt = tA.isNative ? amountA : amountB;
        const tok = tA.isNative ? tB : tA;
        const tokAmt = tA.isNative ? amountB : amountA;
        await ensureApproval(tok.address, tokAmt);
        setBusy("Founding the Hoard…");
        hash = await writeContractAsync({
          address: deployment.router,
          abi: routerAbi,
          functionName: "addLiquidityETH",
          // fresh pool: desired amounts define the opening price exactly
          args: [tok.address, tokAmt, tokAmt, ethAmt, user, deadline],
          value: ethAmt,
        });
      } else {
        await ensureApproval(tA.address, amountA);
        await ensureApproval(tB.address, amountB);
        setBusy("Founding the Hoard…");
        hash = await writeContractAsync({
          address: deployment.router,
          abi: routerAbi,
          functionName: "addLiquidity",
          args: [tA.address, tB.address, amountA, amountB, amountA, amountB, user, deadline],
        });
      }
      await publicClient.waitForTransactionReceipt({ hash });
      const fresh = await refetch();
      const a = erc20Address(tA, deployment.weth).toLowerCase();
      const b = erc20Address(tB, deployment.weth).toLowerCase();
      const created = fresh.data?.find((p) => {
        const p0 = p.token0.address.toLowerCase();
        const p1 = p.token1.address.toLowerCase();
        return (p0 === a && p1 === b) || (p0 === b && p1 === a);
      });
      nav.push(created ? `/hoards/${created.address}` : "/hoards");
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

  const disabled =
    !isConnected ||
    busy !== null ||
    Boolean(sameToken) ||
    Boolean(existing) ||
    !amountA ||
    !amountB ||
    amountA === 0n ||
    amountB === 0n;

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/hoards" className="text-xs text-moon-500 hover:text-gold-400">
        ← All Hoards
      </Link>

      <header className="mb-6 mt-3">
        <h1 className="engraved text-2xl font-semibold sm:text-3xl">
          Found a new Hoard
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-moon-500">
          Pick two coins and bury the first treasure. Your deposit sets the
          opening price — choose the ratio with care, for arbitrageurs correct
          careless prices swiftly and at your expense.
        </p>
      </header>

      <div className="glass p-4 sm:p-5">
        {([0, 1] as const).map((idx) => {
          const t = idx === 0 ? tA : tB;
          const other = idx === 0 ? tB : tA;
          const value = idx === 0 ? amountAInput : amountBInput;
          const setValue = idx === 0 ? setAmountAInput : setAmountBInput;
          const setToken = idx === 0 ? setTokenA : setTokenB;
          const bal = balanceFor(t, (idx === 0 ? balA : balB) as bigint | undefined);
          return (
            <div key={idx} className={`glass-inset p-4 ${idx === 1 ? "mt-3" : ""}`}>
              <div className="mb-1 flex justify-between text-xs text-moon-500">
                <span>{idx === 0 ? "First coin" : "Second coin"}</span>
                {bal !== undefined && t && (
                  <button
                    type="button"
                    className="hover:text-gold-400"
                    onClick={() => setValue(formatUnits(bal, t.decimals))}
                  >
                    Purse: {fmtAmount(bal, t.decimals)} {t.symbol}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  className="amount-input !text-xl"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                {t && (
                  <TokenSelect
                    tokens={tokens}
                    selected={t}
                    exclude={other ?? undefined}
                    onSelect={(x) => setToken(x)}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div className="mt-3 space-y-1.5 px-2 text-xs">
          {sameToken && (
            <p className="text-blood-400">
              ETH and WETH are the same coin in a Hoard — pick two different assets.
            </p>
          )}
          {existing && (
            <p className="text-moon-500">
              This Hoard already exists —{" "}
              <Link href={`/hoards/${existing.address}`} className="text-gold-400 hover:text-gold-300">
                add liquidity to it instead ↗
              </Link>
            </p>
          )}
          {initialPrice !== null && !existing && !sameToken && (
            <div className="flex items-center justify-between text-moon-500">
              <span>Opening price</span>
              <span className="font-mono text-moon-300">
                1 {tA?.symbol} ={" "}
                {initialPrice.toLocaleString("en-US", { maximumSignificantDigits: 6 })}{" "}
                {tB?.symbol}
              </span>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-blood-400/10 px-3 py-2 text-xs text-blood-400">
            {error}
          </p>
        )}

        <motion.button
          type="button"
          whileHover={disabled ? undefined : { scale: 1.01 }}
          whileTap={disabled ? undefined : { scale: 0.99 }}
          transition={spring}
          className="btn-gold mt-4 w-full py-3.5"
          disabled={disabled}
          onClick={foundHoard}
        >
          {busy ??
            (!isConnected
              ? "Connect to found a Hoard"
              : existing
                ? "Hoard already exists"
                : "Found the Hoard")}
        </motion.button>
      </div>
    </div>
  );
}
