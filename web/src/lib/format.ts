import { formatUnits, parseUnits } from "viem";

/** Human-format a token amount: trims noise, keeps significance. */
export function fmtAmount(value: bigint, decimals: number, maxSig = 6): string {
  const s = formatUnits(value, decimals);
  const n = Number(s);
  if (n === 0) return "0";
  if (n < 0.000001) return "<0.000001";
  if (n < 1) return n.toLocaleString("en-US", { maximumSignificantDigits: maxSig });
  if (n < 10_000)
    return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n < 1_000_000)
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M`;
  return `${(n / 1e9).toFixed(2)}B`;
}

export function fmtUsd(n: number): string {
  if (!isFinite(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1e6) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n < 1e9) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${(n / 1e9).toFixed(2)}B`;
}

export function fmtPct(n: number): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
}

/** Parse user input safely into token units; returns null on bad input. */
export function parseAmount(input: string, decimals: number): bigint | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed === ".") return null;
  if (!/^\d*\.?\d*$/.test(trimmed)) return null;
  try {
    return parseUnits(trimmed, decimals);
  } catch {
    return null;
  }
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}
