"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TokenBadge } from "@/components/TokenBadge";
import { fmtUsd } from "@/lib/format";
import { poolTvlUsd, usePools, usePrices } from "@/lib/hooks";
import { buildDailySeries, useSwapHistory, volumeSince } from "@/lib/history";

export default function AnalyticsPage() {
  const { data: pools } = usePools();
  const { prices } = usePrices(pools);
  const { data: history } = useSwapHistory(pools, prices);

  const series = useMemo(
    () =>
      history && pools ? buildDailySeries(history, pools, prices, 14) : [],
    [history, pools, prices],
  );

  const tvlNow = useMemo(
    () => (pools ? pools.reduce((acc, p) => acc + poolTvlUsd(p, prices), 0) : 0),
    [pools, prices],
  );
  const vol24 = history ? volumeSince(history.swaps, 24) : 0;
  const vol7d = history ? volumeSince(history.swaps, 24 * 7) : 0;
  const volAll = history
    ? history.swaps.reduce((acc, s) => acc + s.usdVolume, 0)
    : 0;
  const merryMenAllTime = volAll * 0.0005;

  const perPool = useMemo(() => {
    if (!pools || !history) return [];
    return pools
      .map((p) => ({
        pool: p,
        tvl: poolTvlUsd(p, prices),
        vol24: volumeSince(history.swaps, 24, p.address),
        vol7d: volumeSince(history.swaps, 24 * 7, p.address),
      }))
      .sort((a, b) => b.tvl - a.tvl);
  }, [pools, history, prices]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="rise-in engraved text-3xl font-semibold">The Ledger</h1>
        <p className="rise-in rise-in-1 mt-2 text-sm text-moon-500">
          Every coin that moves through the greenwood, counted in the open.
        </p>
      </header>

      {/* headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Big label="Total value locked" value={fmtUsd(tvlNow)} />
        <Big label="Volume · 24h" value={fmtUsd(vol24)} />
        <Big label="Volume · 7d" value={fmtUsd(vol7d)} />
        <Big label="Merry Men's Share · all time" value={fmtUsd(merryMenAllTime)} gold />
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-moon-700">
            TVL — 14 days
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="tvl-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2fd08c" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2fd08c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#56745f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => fmtUsd(v)}
                  tick={{ fill: "#56745f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [fmtUsd(Number(v)), "TVL"]}
                />
                <Area
                  type="monotone"
                  dataKey="tvl"
                  stroke="#2fd08c"
                  strokeWidth={2}
                  fill="url(#tvl-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 text-xs uppercase tracking-widest text-moon-700">
            Volume — 14 days
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="vol-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffd76f" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#e8b64c" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#56745f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => fmtUsd(v)}
                  tick={{ fill: "#56745f", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(232,182,76,0.06)" }}
                  formatter={(v) => [fmtUsd(Number(v)), "Volume"]}
                />
                <Bar dataKey="volume" fill="url(#vol-fill)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* per-pool table */}
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-moon-700">
              <th className="px-5 py-4 font-medium">Hoard</th>
              <th className="px-5 py-4 text-right font-medium">TVL</th>
              <th className="px-5 py-4 text-right font-medium">Vol 24h</th>
              <th className="px-5 py-4 text-right font-medium">Vol 7d</th>
              <th className="px-5 py-4 text-right font-medium">Fees 7d</th>
            </tr>
          </thead>
          <tbody>
            {perPool.map(({ pool, tvl, vol24: v24, vol7d: v7 }) => (
              <tr key={pool.address} className="row-hover border-t border-white/5">
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-2">
                    <span className="flex -space-x-2">
                      <TokenBadge symbol={pool.token0.symbol} size={26} />
                      <TokenBadge symbol={pool.token1.symbol} size={26} />
                    </span>
                    <span className="font-semibold">
                      {pool.token0.symbol}·{pool.token1.symbol}
                    </span>
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right font-mono">{fmtUsd(tvl)}</td>
                <td className="px-5 py-3.5 text-right font-mono">{fmtUsd(v24)}</td>
                <td className="px-5 py-3.5 text-right font-mono">{fmtUsd(v7)}</td>
                <td className="px-5 py-3.5 text-right font-mono text-gold-400">
                  {fmtUsd(v7 * 0.003)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#06150d",
  border: "1px solid rgba(207,227,213,0.15)",
  borderRadius: "0.75rem",
  color: "#f2faf4",
  fontSize: "0.8rem",
};

function Big({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={`glass p-5 ${gold ? "gold-edge" : ""}`}>
      <p className="text-[0.68rem] uppercase tracking-wider text-moon-700">{label}</p>
      <p
        className={`mt-1 font-mono text-2xl ${gold ? "text-gold-400 text-glow-gold" : "text-moon-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
