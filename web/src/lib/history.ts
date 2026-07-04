"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseAbiItem, type Address } from "viem";
import { usePublicClient } from "wagmi";
import type { Pool } from "./hooks";

const swapEvent = parseAbiItem(
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
);
const syncEvent = parseAbiItem(
  "event Sync(uint112 reserve0, uint112 reserve1)",
);

export interface SwapRecord {
  pool: Address;
  timestamp: number;
  usdVolume: number;
}

export interface SyncRecord {
  pool: Address;
  timestamp: number;
  reserve0: bigint;
  reserve1: bigint;
}

export interface History {
  swaps: SwapRecord[];
  syncs: SyncRecord[];
}

/**
 * Pulls Swap + Sync logs for every Hoard and stamps them with block times.
 * On the local demo chain we read from genesis; on public chains this is
 * bounded to the trailing ~200k blocks to stay RPC-friendly.
 */
export function useSwapHistory(
  pools: Pool[] | undefined,
  prices: Map<string, number>,
) {
  const client = usePublicClient();

  return useQuery({
    queryKey: [
      "history",
      pools?.map((p) => p.address).join(","),
      prices.size,
    ],
    enabled: Boolean(client && pools && pools.length > 0 && prices.size > 0),
    refetchInterval: 12_000,
    queryFn: async (): Promise<History> => {
      if (!client || !pools) return { swaps: [], syncs: [] };

      const addresses = pools.map((p) => p.address);
      const latest = await client.getBlockNumber();
      const fromBlock =
        client.chain?.id === 31337
          ? 0n
          : latest > 200_000n
            ? latest - 200_000n
            : 0n;

      const [swapLogs, syncLogs] = await Promise.all([
        client.getLogs({ address: addresses, event: swapEvent, fromBlock }),
        client.getLogs({ address: addresses, event: syncEvent, fromBlock }),
      ]);

      // resolve block timestamps once
      const blockNums = Array.from(
        new Set([...swapLogs, ...syncLogs].map((l) => l.blockNumber)),
      );
      const blocks = await Promise.all(
        blockNums.map((n) => client.getBlock({ blockNumber: n })),
      );
      const tsByBlock = new Map(
        blocks.map((b) => [b.number, Number(b.timestamp)]),
      );

      const poolByAddr = new Map(
        pools.map((p) => [p.address.toLowerCase(), p]),
      );

      const swaps: SwapRecord[] = swapLogs.map((log) => {
        const pool = poolByAddr.get(log.address.toLowerCase())!;
        const p0 = prices.get(pool.token0.address.toLowerCase()) ?? 0;
        const p1 = prices.get(pool.token1.address.toLowerCase()) ?? 0;
        const a = log.args;
        // count the input side once
        const usdVolume =
          Number(formatUnits(a.amount0In ?? 0n, pool.token0.decimals)) * p0 +
          Number(formatUnits(a.amount1In ?? 0n, pool.token1.decimals)) * p1;
        return {
          pool: log.address,
          timestamp: tsByBlock.get(log.blockNumber) ?? 0,
          usdVolume,
        };
      });

      const syncs: SyncRecord[] = syncLogs.map((log) => ({
        pool: log.address,
        timestamp: tsByBlock.get(log.blockNumber) ?? 0,
        reserve0: log.args.reserve0 ?? 0n,
        reserve1: log.args.reserve1 ?? 0n,
      }));

      return { swaps, syncs };
    },
  });
}

/** Sum of swap USD volume in the trailing `hours`. */
export function volumeSince(
  swaps: SwapRecord[],
  hours: number,
  pool?: Address,
): number {
  const cutoff = Date.now() / 1000 - hours * 3600;
  return swaps
    .filter(
      (s) =>
        s.timestamp >= cutoff &&
        (!pool || s.pool.toLowerCase() === pool.toLowerCase()),
    )
    .reduce((acc, s) => acc + s.usdVolume, 0);
}

export interface SeriesPoint {
  time: number;
  label: string;
  volume: number;
  tvl: number;
}

/** Daily buckets of volume + end-of-day TVL for the charts. */
export function buildDailySeries(
  history: History,
  pools: Pool[],
  prices: Map<string, number>,
  days = 14,
): SeriesPoint[] {
  const DAY = 86_400;
  const now = Math.floor(Date.now() / 1000);
  const start = now - (days - 1) * DAY;

  const points: SeriesPoint[] = [];
  for (let i = 0; i < days; i++) {
    const bucketStart = start + i * DAY;
    const bucketEnd = bucketStart + DAY;

    const volume = history.swaps
      .filter((s) => s.timestamp >= bucketStart && s.timestamp < bucketEnd)
      .reduce((acc, s) => acc + s.usdVolume, 0);

    // TVL: latest sync ≤ bucketEnd per pool
    let tvl = 0;
    for (const pool of pools) {
      const latest = history.syncs
        .filter(
          (s) =>
            s.pool.toLowerCase() === pool.address.toLowerCase() &&
            s.timestamp < bucketEnd,
        )
        .at(-1);
      if (!latest) continue;
      const p0 = prices.get(pool.token0.address.toLowerCase()) ?? 0;
      const p1 = prices.get(pool.token1.address.toLowerCase()) ?? 0;
      tvl +=
        Number(formatUnits(latest.reserve0, pool.token0.decimals)) * p0 +
        Number(formatUnits(latest.reserve1, pool.token1.decimals)) * p1;
    }

    points.push({
      time: bucketStart,
      label: new Date(bucketStart * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      volume,
      tvl,
    });
  }
  return points;
}
