import type { Address } from "viem";
import type { TokenInfo } from "@/config/deployments";
import type { Pool } from "./hooks";

/** Uniswap-v2 output math (0.30% fee), mirrors LoxleyLibrary.getAmountOut. */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  return (amountInWithFee * reserveOut) / (reserveIn * 1000n + amountInWithFee);
}

/** Resolve a token to its ERC-20 address (native ETH → WETH). */
export function erc20Address(token: TokenInfo, weth: Address): Address {
  return token.isNative ? weth : token.address;
}

function findPool(pools: Pool[], a: Address, b: Address): Pool | undefined {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return pools.find((p) => {
    const p0 = p.token0.address.toLowerCase();
    const p1 = p.token1.address.toLowerCase();
    return (p0 === al && p1 === bl) || (p0 === bl && p1 === al);
  });
}

function reservesFor(pool: Pool, tokenIn: Address): [bigint, bigint] {
  return pool.token0.address.toLowerCase() === tokenIn.toLowerCase()
    ? [pool.reserve0, pool.reserve1]
    : [pool.reserve1, pool.reserve0];
}

export interface Quote {
  path: Address[];
  amountOut: bigint;
  /** price impact as a fraction, e.g. 0.013 = 1.3% */
  priceImpact: number;
  hops: number;
}

/**
 * Quote an exact-in swap: direct pool if it exists, else route through WETH.
 * Pure client-side math over cached reserves — matches on-chain execution.
 */
export function quoteSwap(
  pools: Pool[],
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amountIn: bigint,
  weth: Address,
): Quote | null {
  const addrIn = erc20Address(tokenIn, weth);
  const addrOut = erc20Address(tokenOut, weth);
  if (addrIn.toLowerCase() === addrOut.toLowerCase()) return null;

  const direct = findPool(pools, addrIn, addrOut);
  if (direct) {
    const [rIn, rOut] = reservesFor(direct, addrIn);
    const amountOut = getAmountOut(amountIn, rIn, rOut);
    if (amountOut === 0n) return null;
    const spot = Number(rOut) / Number(rIn);
    const exec = Number(amountOut) / Number(amountIn);
    return {
      path: [addrIn, addrOut],
      amountOut,
      priceImpact: Math.max(0, 1 - exec / spot),
      hops: 1,
    };
  }

  // two-hop via WETH
  const legA = findPool(pools, addrIn, weth);
  const legB = findPool(pools, weth, addrOut);
  if (legA && legB) {
    const [ra1, ra2] = reservesFor(legA, addrIn);
    const mid = getAmountOut(amountIn, ra1, ra2);
    const [rb1, rb2] = reservesFor(legB, weth);
    const amountOut = getAmountOut(mid, rb1, rb2);
    if (amountOut === 0n) return null;
    const spot = (Number(ra2) / Number(ra1)) * (Number(rb2) / Number(rb1));
    const exec = Number(amountOut) / Number(amountIn);
    return {
      path: [addrIn, weth, addrOut],
      amountOut,
      priceImpact: Math.max(0, 1 - exec / spot),
      hops: 2,
    };
  }

  return null;
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n;
}

export function deadlineFromNow(minutes: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}
