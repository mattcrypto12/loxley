"use client";

import { motion } from "framer-motion";

/**
 * The redistribution, drawn: every swap's 0.30% fee splits — 0.25% flows to
 * the Hoard's LPs, 0.05% is the protocol fee — split evenly between the
 * Merry Men's chest (then on to eligible small wallets) and the guild
 * treasury. Animated coins ride the paths.
 */
export function ShareFlow() {
  return (
    <div className="glass overflow-hidden p-5">
      <svg
        viewBox="0 0 720 240"
        className="w-full"
        role="img"
        aria-label="Fee flow: 0.30% swap fee splits into 0.25% for liquidity providers and a 0.05% protocol fee, itself split 50/50 between the Merry Men's Share — redistributed to active small wallets — and the guild treasury"
      >
        <defs>
          <linearGradient id="path-emerald" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2fd08c" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2fd08c" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="path-gold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#e8b64c" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#e8b64c" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* source node */}
        <Node x={20} y={90} w={130} h={60} title="Every swap" sub="0.30% fee" />

        {/* split paths */}
        <path
          id="lp-path"
          d="M150 112 C 250 112, 260 62, 360 62"
          fill="none"
          stroke="url(#path-emerald)"
          strokeWidth="2.5"
        />
        <path
          id="mm-path"
          d="M150 128 C 250 128, 260 178, 360 178"
          fill="none"
          stroke="url(#path-gold)"
          strokeWidth="2.5"
        />

        <Node x={360} y={32} w={150} h={60} title="Hoard LPs" sub="0.25% — steady" tone="ember" />
        <Node x={360} y={148} w={150} h={60} title="Merry Men's chest" sub="0.025% — the Share" tone="gold" />

        {/* redistribution path */}
        <path
          id="out-path"
          d="M510 178 C 590 178, 600 120, 690 120"
          fill="none"
          stroke="url(#path-gold)"
          strokeWidth="2.5"
        />
        <Node x={560} y={90} w={140} h={60} title="Small wallets" sub="active last 30 days" tone="gold" />

        {/* animated coins */}
        {[0, 1.2, 2.4].map((delay) => (
          <Coin key={`lp-${delay}`} path="M150 112 C 250 112, 260 62, 360 62" color="#3fe89e" delay={delay} dur={3.6} />
        ))}
        {[0.6, 1.8, 3.0].map((delay) => (
          <Coin key={`mm-${delay}`} path="M150 128 C 250 128, 260 178, 360 178" color="#ffd76f" delay={delay} dur={3.6} />
        ))}
        {[0.3, 2.1].map((delay) => (
          <Coin key={`out-${delay}`} path="M510 178 C 590 178, 600 120, 690 120" color="#ffd76f" delay={delay} dur={4.2} />
        ))}
      </svg>
      <p className="mt-3 px-1 text-center text-[0.7rem] leading-relaxed text-moon-700">
        The protocol&apos;s 0.05% is divided by the SpoilsSplitter — an
        immutable 50/50 on-chain split between the Merry Men&apos;s chest and
        the guild treasury that maintains Loxley. No hidden levers: the ratio
        is fixed at deployment, forever.
      </p>
    </div>
  );
}

function Node({
  x,
  y,
  w,
  h,
  title,
  sub,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  tone?: "gold" | "ember";
}) {
  const stroke =
    tone === "gold"
      ? "rgba(232,182,76,0.5)"
      : tone === "ember"
        ? "rgba(47,208,140,0.45)"
        : "rgba(207,227,213,0.25)";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={14}
        fill="rgba(7,27,16,0.75)"
        stroke={stroke}
        strokeWidth="1.2"
      />
      <text
        x={x + w / 2}
        y={y + h / 2 - 6}
        textAnchor="middle"
        fill="#f2faf4"
        fontSize="14"
        fontWeight="600"
      >
        {title}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" fill="#93b29f" fontSize="11">
        {sub}
      </text>
    </g>
  );
}

function Coin({
  path,
  color,
  delay,
  dur,
}: {
  path: string;
  color: string;
  delay: number;
  dur: number;
}) {
  return (
    <motion.circle
      r="4.5"
      fill={color}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "linear" }}
      style={{
        offsetPath: `path("${path}")`,
        offsetRotate: "0deg",
      }}
    >
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} />
    </motion.circle>
  );
}
