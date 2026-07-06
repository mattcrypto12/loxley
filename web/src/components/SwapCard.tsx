"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, formatUnits, maxUint256, type Address } from "viem";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { explorerTxUrl } from "@/config/chains";
import { shortHash } from "@/lib/format";
import { routerAbi } from "@/abi/router";
import { wethAbi } from "@/abi/weth";
import type { TokenInfo } from "@/config/deployments";
import { fmtAmount, fmtUsd, parseAmount } from "@/lib/format";
import { usePools, usePrices, useDeployment, useTokens } from "@/lib/hooks";
import { applySlippage, deadlineFromNow, erc20Address, quoteSwap } from "@/lib/swap";
import { playThunk } from "@/lib/sound";
import { GoldLeafBurst } from "./GoldLeafBurst";
import { Tip } from "./Tip";
import { TokenSelect } from "./TokenSelect";

type Phase = "idle" | "approving" | "loosing" | "flying";

const spring = { type: "spring" as const, stiffness: 420, damping: 30 };

export function SwapCard() {
  const { address, isConnected } = useAccount();
  const deployment = useDeployment();
  const tokens = useTokens();
  const { data: pools, refetch: refetchPools } = usePools();
  const { prices } = usePrices(pools);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tokenIn, setTokenIn] = useState<TokenInfo | null>(null);
  const [tokenOut, setTokenOut] = useState<TokenInfo | null>(null);
  const [input, setInput] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [deadlineMins, setDeadlineMins] = useState(20);
  const [showSettings, setShowSettings] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [arrowKey, setArrowKey] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const chainId = useChainId();

  // a chain switch invalidates everything mid-flight: quotes, selected
  // tokens, receipts from the previous chain
  useEffect(() => {
    setLastTx(null);
    setError(null);
    setInput("");
    setTokenIn(null);
    setTokenOut(null);
  }, [chainId]);

  const tIn = tokenIn ?? tokens.find((t) => t.isNative) ?? tokens[0];
  const tOut = tokenOut ?? tokens.find((t) => t.symbol === "GOLD") ?? tokens[1];

  const amountIn = tIn ? parseAmount(input, tIn.decimals) : null;

  const quote = useMemo(() => {
    if (!pools || !deployment || !tIn || !tOut || !amountIn || amountIn === 0n)
      return null;
    return quoteSwap(pools, tIn, tOut, amountIn, deployment.weth);
  }, [pools, deployment, tIn, tOut, amountIn]);

  const minReceived = quote ? applySlippage(quote.amountOut, slippageBps) : null;

  // ── balances ──────────────────────────────────────────────
  const { data: nativeBal } = useBalance({
    address,
    query: { enabled: Boolean(address) },
  });
  const { data: erc20BalIn } = useReadContract({
    address: tIn && !tIn.isNative ? tIn.address : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && tIn && !tIn.isNative) },
  });
  const balanceIn = tIn?.isNative ? nativeBal?.value : erc20BalIn;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tIn && !tIn.isNative ? tIn.address : undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && deployment ? [address, deployment.router] : undefined,
    query: { enabled: Boolean(address && deployment && tIn && !tIn.isNative) },
  });

  const needsApproval =
    tIn && !tIn.isNative && amountIn !== null && allowance !== undefined
      ? allowance < amountIn
      : false;

  const insufficient =
    amountIn !== null && balanceIn !== undefined && amountIn > balanceIn;

  const isWrap =
    deployment &&
    tIn &&
    tOut &&
    ((tIn.isNative && !tOut.isNative && tOut.address.toLowerCase() === deployment.weth.toLowerCase()) ||
      (tOut.isNative && !tIn.isNative && tIn.address.toLowerCase() === deployment.weth.toLowerCase()));

  const usdIn =
    amountIn && tIn && deployment
      ? Number(formatUnits(amountIn, tIn.decimals)) *
        (prices.get(erc20Address(tIn, deployment.weth).toLowerCase()) ?? 0)
      : 0;
  const usdOut =
    quote && tOut && deployment
      ? Number(formatUnits(quote.amountOut, tOut.decimals)) *
        (prices.get(erc20Address(tOut, deployment.weth).toLowerCase()) ?? 0)
      : 0;

  const flip = () => {
    setTokenIn(tOut);
    setTokenOut(tIn);
    setInput("");
  };

  const setMax = () => {
    if (balanceIn === undefined || !tIn) return;
    const usable = tIn.isNative
      ? balanceIn > 10n ** 16n
        ? balanceIn - 10n ** 16n // leave dust for gas
        : 0n
      : balanceIn;
    setInput(formatUnits(usable, tIn.decimals));
  };

  // ── execution ─────────────────────────────────────────────
  async function loose() {
    if (!deployment || !address || !amountIn || !tIn || !tOut || !publicClient) return;
    setError(null);
    try {
      if (needsApproval) {
        setPhase("approving");
        const h = await writeContractAsync({
          address: tIn.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [deployment.router, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: h });
        await refetchAllowance();
      }

      setPhase("loosing");
      setArrowKey((k) => k + 1);

      let hash: `0x${string}`;
      if (isWrap) {
        hash = tIn.isNative
          ? await writeContractAsync({
              address: deployment.weth,
              abi: wethAbi,
              functionName: "deposit",
              value: amountIn,
            })
          : await writeContractAsync({
              address: deployment.weth,
              abi: wethAbi,
              functionName: "withdraw",
              args: [amountIn],
            });
      } else {
        if (!quote || !minReceived) throw new Error("No route");
        const deadline = deadlineFromNow(deadlineMins);
        if (tIn.isNative) {
          hash = await writeContractAsync({
            address: deployment.router,
            abi: routerAbi,
            functionName: "swapExactETHForTokens",
            args: [minReceived, quote.path, address, deadline],
            value: amountIn,
          });
        } else if (tOut.isNative) {
          hash = await writeContractAsync({
            address: deployment.router,
            abi: routerAbi,
            functionName: "swapExactTokensForETH",
            args: [amountIn, minReceived, quote.path, address, deadline],
          });
        } else {
          hash = await writeContractAsync({
            address: deployment.router,
            abi: routerAbi,
            functionName: "swapExactTokensForTokens",
            args: [amountIn, minReceived, quote.path, address, deadline],
          });
        }
      }

      setPhase("flying");
      await publicClient.waitForTransactionReceipt({ hash });
      setLastTx(hash);

      // the arrow lands
      playThunk();
      setBurstKey((k) => k + 1);
      setPhase("idle");
      setInput("");
      refetchPools();
    } catch (e) {
      setPhase("idle");
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setError(msg.split("\n")[0].slice(0, 140));
    }
  }

  const cta = !isConnected
    ? "Connect to trade"
    : !amountIn
      ? "Nock an amount"
      : insufficient
        ? `Not enough ${tIn?.symbol}`
        : !quote && !isWrap
          ? "No path through the greenwood"
          : phase === "approving"
            ? "Blessing the coin…"
            : phase === "loosing"
              ? "Drawing…"
              : phase === "flying"
                ? "Arrow loosed…"
                : needsApproval
                  ? `Approve & swap`
                  : isWrap
                    ? tIn?.isNative
                      ? "Wrap"
                      : "Unwrap"
                    : "Loose the arrow";

  const disabled =
    !isConnected ||
    !amountIn ||
    insufficient ||
    (!quote && !isWrap) ||
    phase !== "idle";

  const rate =
    quote && amountIn && tIn && tOut
      ? Number(formatUnits(quote.amountOut, tOut.decimals)) /
        Number(formatUnits(amountIn, tIn.decimals))
      : null;

  // chain has no Loxley deployment: say so instead of rendering a husk
  if (!deployment || tokens.length === 0) {
    return (
      <div className="relative mx-auto w-full max-w-[460px]">
        <div className="glass gold-edge relative overflow-hidden p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="engraved text-sm tracking-[0.22em] text-moon-300">
              STEAL THE SPREAD
            </h2>
          </div>
          <div className="glass-inset flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="text-sm text-moon-300">
              The greenwood hasn&apos;t reached this chain yet.
            </p>
            <p className="text-xs leading-relaxed text-moon-500">
              Loxley isn&apos;t deployed here, so there are no Hoards to trade
              against. Switch network in the header — the testnet is live —
              or deploy with{" "}
              <code className="font-mono text-gold-400">
                ./scripts/deploy-testnet.sh
              </code>
              .
            </p>
          </div>
          <button type="button" disabled className="btn-gold mt-4 w-full py-3.5 text-[0.95rem]">
            No Hoards on this chain
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="glass gold-edge relative overflow-hidden p-4 sm:p-5">
        {/* header row */}
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="engraved text-sm tracking-[0.22em] text-moon-300">
            STEAL THE SPREAD
          </h2>
          <Tip tip="Slippage tolerance and transaction deadline — your swap reverts rather than accept a worse price or a stale execution." side="bottom">
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className={`btn-ghost px-2.5 py-1.5 text-xs ${showSettings ? "text-gold-400" : ""}`}
              aria-label="Swap settings"
            >
              {slippageBps / 100}% ⚙
            </button>
          </Tip>
        </div>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring}
              className="overflow-hidden"
            >
              <div className="glass-inset mb-3 flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="text-moon-500">Slippage</span>
                {[10, 50, 100].map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => setSlippageBps(bps)}
                    className={`rounded-lg px-2.5 py-1 text-xs ${
                      slippageBps === bps
                        ? "bg-gold-500/20 text-gold-300 ring-1 ring-gold-500/40"
                        : "text-moon-500 hover:text-moon-100"
                    }`}
                  >
                    {bps / 100}%
                  </button>
                ))}
                <span className="ml-auto text-moon-500">Deadline</span>
                <input
                  type="number"
                  value={deadlineMins}
                  min={1}
                  onChange={(e) =>
                    setDeadlineMins(Math.max(1, Number(e.target.value) || 20))
                  }
                  className="w-14 rounded-lg bg-forest-950/60 px-2 py-1 text-right font-mono text-xs text-moon-100 ring-1 ring-white/10"
                />
                <span className="text-xs text-moon-700">min</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* YOU PAY */}
        <motion.div layout className="glass-inset p-4">
          <div className="mb-1 flex items-center justify-between text-xs text-moon-500">
            <span>You pay</span>
            {balanceIn !== undefined && tIn && (
              <Tip tip="Fill with your full balance (for ETH, a little is kept back for gas)." side="bottom">
                <button type="button" onClick={setMax} className="hover:text-gold-400">
                  Purse: {fmtAmount(balanceIn, tIn.decimals)} {tIn.symbol}
                  <span className="ml-1 text-gold-500">MAX</span>
                </button>
              </Tip>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              className="amount-input"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {tIn && (
              <TokenSelect
                tokens={tokens}
                selected={tIn}
                exclude={tOut ?? undefined}
                onSelect={(t) => setTokenIn(t)}
              />
            )}
          </div>
          <div className="mt-1 h-4 text-xs text-moon-700">
            {usdIn > 0 && fmtUsd(usdIn)}
          </div>
        </motion.div>

        {/* flip */}
        <div className="relative z-10 -my-3 flex justify-center">
          <Tip tip="Reverse direction — pay with what you were receiving.">
          <motion.button
            type="button"
            onClick={flip}
            whileHover={{ scale: 1.12, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            transition={spring}
            className="glass-deep flex h-10 w-10 items-center justify-center rounded-xl text-gold-400"
            aria-label="Flip tokens"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M5 2v9M5 11l-2.5-2.5M5 11l2.5-2.5M11 14V5m0 0L8.5 7.5M11 5l2.5 2.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
          </Tip>
        </div>

        {/* YOU RECEIVE */}
        <motion.div
          layout
          className="glass-inset relative p-4"
          animate={
            burstKey > 0
              ? { scale: [1, 1.03, 0.995, 1], transition: { duration: 0.42 } }
              : undefined
          }
          key={`receive-${burstKey}`}
        >
          <div className="mb-1 text-xs text-moon-500">You receive</div>
          <div className="flex items-center gap-3">
            <div className="amount-input select-none overflow-hidden text-ellipsis whitespace-nowrap">
              {isWrap && amountIn ? (
                fmtAmount(amountIn, tIn.decimals)
              ) : quote && tOut ? (
                fmtAmount(quote.amountOut, tOut.decimals)
              ) : (
                <span className="text-moon-700">0</span>
              )}
            </div>
            {tOut && (
              <TokenSelect
                tokens={tokens}
                selected={tOut}
                exclude={tIn ?? undefined}
                onSelect={(t) => setTokenOut(t)}
              />
            )}
          </div>
          <div className="mt-1 h-4 text-xs text-moon-700">
            {usdOut > 0 && fmtUsd(usdOut)}
          </div>
          <GoldLeafBurst burstKey={burstKey} />
        </motion.div>

        {/* route details */}
        <AnimatePresence>
          {quote && !isWrap && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-1.5 px-2 text-xs">
                <Row
                  label="Rate"
                  value={
                    rate
                      ? `1 ${tIn?.symbol} ≈ ${rate.toLocaleString("en-US", { maximumSignificantDigits: 6 })} ${tOut?.symbol}`
                      : "—"
                  }
                />
                <Row
                  label="Price impact"
                  value={`${(quote.priceImpact * 100).toFixed(2)}%`}
                  warn={quote.priceImpact > 0.03}
                />
                <Row
                  label={`Min received (${slippageBps / 100}% slippage)`}
                  value={
                    minReceived && tOut
                      ? `${fmtAmount(minReceived, tOut.decimals)} ${tOut.symbol}`
                      : "—"
                  }
                />
                <Row
                  label="Path"
                  value={quote.hops === 1 ? "Direct" : "via WETH (Greenwood Path)"}
                />
                <div className="flex items-start justify-between gap-4 pt-1 text-moon-500">
                  <span>Fee 0.30%</span>
                  <span className="text-right">
                    0.25% → LPs ·{" "}
                    <span className="text-gold-400">0.025% → Merry Men&apos;s Share</span>{" "}
                    · 0.025% → Guild
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="mt-3 rounded-lg bg-blood-400/10 px-3 py-2 text-xs text-blood-400">
            {error}
          </p>
        )}

        {lastTx && !error && phase === "idle" && (
          <p className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-ember-500/8 px-3 py-2 text-xs text-moon-500">
            <span>
              Arrow landed · <span className="font-mono text-moon-300">{shortHash(lastTx)}</span>
            </span>
            {explorerTxUrl(chainId, lastTx) ? (
              <a
                href={explorerTxUrl(chainId, lastTx)!}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-gold-400 hover:text-gold-300"
              >
                View on explorer ↗
              </a>
            ) : (
              <span className="shrink-0 text-moon-700">local chain — no explorer</span>
            )}
          </p>
        )}

        {/* CTA */}
        <Tip
          tip="Executes the swap on-chain (with a one-time token approval first if needed), protected by your slippage and deadline settings."
          block
        >
          <motion.button
            type="button"
            whileHover={disabled ? undefined : { scale: 1.015 }}
            whileTap={disabled ? undefined : { scale: 0.985 }}
            transition={spring}
            disabled={disabled}
            onClick={loose}
            className="btn-gold mt-4 w-full py-3.5 text-[0.95rem]"
          >
            {cta}
          </motion.button>
        </Tip>

        {/* the loosed arrow */}
        <AnimatePresence>
          {(phase === "loosing" || phase === "flying") && (
            <ArrowFlight key={arrowKey} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-moon-500">{label}</span>
      <span className={`font-mono ${warn ? "text-blood-400" : "text-moon-300"}`}>
        {value}
      </span>
    </div>
  );
}

/** An arrow loosed from the pay panel, arcing down into the receive panel. */
function ArrowFlight() {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-0 z-30"
      initial={{ y: 96, x: -90, rotate: 38, opacity: 0 }}
      animate={{
        y: [96, 150, 236],
        x: [-90, -30, 12],
        rotate: [38, 58, 74],
        opacity: [0, 1, 1],
      }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ duration: 0.55, ease: [0.5, 0, 0.9, 0.6] }}
    >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden>
        <defs>
          <linearGradient id="flight-gold" x1="0" y1="64" x2="64" y2="0">
            <stop offset="0%" stopColor="#ffe9a8" />
            <stop offset="100%" stopColor="#e8b64c" />
          </linearGradient>
        </defs>
        <g stroke="url(#flight-gold)" strokeWidth="2.4" strokeLinecap="round">
          <line x1="8" y1="56" x2="52" y2="12" />
          <path d="M52 12 L40.5 14.8 M52 12 L49.2 23.5" />
          <path d="M12.5 51.5 L6 45 M17.5 46.5 L11 40" strokeWidth="2" />
        </g>
        {/* motion trail */}
        <line
          x1="2"
          y1="62"
          x2="14"
          y2="50"
          stroke="#ffd76f"
          strokeOpacity="0.35"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}
