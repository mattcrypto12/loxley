"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { formatUnits, type Address, type PublicClient } from "viem";
import { useChainId, usePublicClient } from "wagmi";
import { factoryAbi } from "@/abi/factory";
import { pairAbi } from "@/abi/pair";
import { mockErc20Abi } from "@/abi/mockErc20";
import {
  getDeployment,
  getTokenList,
  type Deployment,
  type TokenInfo,
} from "@/config/deployments";
import { activeChain } from "@/config/chains";

export interface Pool {
  address: Address;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export function useDeployment(): Deployment | undefined {
  const chainId = useChainId();
  // strict per-chain: never fall back to another chain's addresses
  return getDeployment(chainId ?? activeChain.id);
}

export function useTokens(): TokenInfo[] {
  const chainId = useChainId();
  return getTokenList(chainId ?? activeChain.id);
}

async function fetchTokenInfo(
  client: PublicClient,
  address: Address,
  known: TokenInfo[],
): Promise<TokenInfo> {
  const hit = known.find(
    (t) => t.address.toLowerCase() === address.toLowerCase() && !t.isNative,
  );
  if (hit) return hit;
  const [symbol, name, decimals] = await Promise.all([
    client.readContract({ address, abi: mockErc20Abi, functionName: "symbol" }),
    client.readContract({ address, abi: mockErc20Abi, functionName: "name" }),
    client.readContract({ address, abi: mockErc20Abi, functionName: "decimals" }),
  ]);
  return { address, symbol, name, decimals: Number(decimals) };
}

export function usePools() {
  const client = usePublicClient();
  const deployment = useDeployment();
  const known = useTokens();

  return useQuery({
    queryKey: ["pools", deployment?.factory],
    enabled: Boolean(client && deployment),
    refetchInterval: 6_000,
    queryFn: async (): Promise<Pool[]> => {
      if (!client || !deployment) return [];
      const count = await client.readContract({
        address: deployment.factory,
        abi: factoryAbi,
        functionName: "allHoardsLength",
      });
      const pools: Pool[] = [];
      for (let i = 0n; i < count; i++) {
        const addr = await client.readContract({
          address: deployment.factory,
          abi: factoryAbi,
          functionName: "allHoards",
          args: [i],
        });
        const [t0, t1, reserves, totalSupply] = await Promise.all([
          client.readContract({ address: addr, abi: pairAbi, functionName: "token0" }),
          client.readContract({ address: addr, abi: pairAbi, functionName: "token1" }),
          client.readContract({ address: addr, abi: pairAbi, functionName: "getReserves" }),
          client.readContract({ address: addr, abi: pairAbi, functionName: "totalSupply" }),
        ]);
        const [token0, token1] = await Promise.all([
          fetchTokenInfo(client, t0, known),
          fetchTokenInfo(client, t1, known),
        ]);
        pools.push({
          address: addr,
          token0,
          token1,
          reserve0: reserves[0],
          reserve1: reserves[1],
          totalSupply,
        });
      }
      return pools;
    },
  });
}

/**
 * USD price oracle for the demo: SILV ("Sheriff's Silver") is the $1 anchor;
 * everything else is priced through pool reserves (direct SILV pool, or via
 * WETH). Returns a map keyed by lowercase token address, plus WETH price.
 */
export function usePrices(pools: Pool[] | undefined) {
  const deployment = useDeployment();
  const tokens = useTokens();

  return useMemo(() => {
    const prices = new Map<string, number>();
    if (!pools || !deployment) return { prices, ethUsd: 0 };

    const weth = deployment.weth.toLowerCase();
    const silv = tokens.find((t) => t.symbol === "SILV")?.address.toLowerCase();
    if (silv) prices.set(silv, 1);

    const ratio = (pool: Pool, of: "token0" | "token1") => {
      const a = of === "token0" ? pool.token0 : pool.token1;
      const b = of === "token0" ? pool.token1 : pool.token0;
      const ra = of === "token0" ? pool.reserve0 : pool.reserve1;
      const rb = of === "token0" ? pool.reserve1 : pool.reserve0;
      if (ra === 0n) return 0;
      return (
        Number(formatUnits(rb, b.decimals)) / Number(formatUnits(ra, a.decimals))
      );
    };

    // 1) price WETH via the WETH/SILV pool
    let ethUsd = 0;
    for (const p of pools) {
      const a0 = p.token0.address.toLowerCase();
      const a1 = p.token1.address.toLowerCase();
      if (silv && a0 === weth && a1 === silv) ethUsd = ratio(p, "token0");
      if (silv && a1 === weth && a0 === silv) ethUsd = ratio(p, "token1");
    }
    if (ethUsd > 0) prices.set(weth, ethUsd);

    // 2) two passes: price tokens off any already-priced counterparty
    for (let pass = 0; pass < 2; pass++) {
      for (const p of pools) {
        const a0 = p.token0.address.toLowerCase();
        const a1 = p.token1.address.toLowerCase();
        if (prices.has(a0) && !prices.has(a1)) {
          prices.set(a1, ratio(p, "token1") * (prices.get(a0) ?? 0));
        } else if (prices.has(a1) && !prices.has(a0)) {
          prices.set(a0, ratio(p, "token0") * (prices.get(a1) ?? 0));
        }
      }
    }

    return { prices, ethUsd };
  }, [pools, deployment, tokens]);
}

export function poolTvlUsd(pool: Pool, prices: Map<string, number>): number {
  const p0 = prices.get(pool.token0.address.toLowerCase()) ?? 0;
  const p1 = prices.get(pool.token1.address.toLowerCase()) ?? 0;
  return (
    Number(formatUnits(pool.reserve0, pool.token0.decimals)) * p0 +
    Number(formatUnits(pool.reserve1, pool.token1.decimals)) * p1
  );
}
