const STYLE: Record<string, { bg: string; fg: string; glyph: string }> = {
  ETH: { bg: "linear-gradient(140deg,#8ea9ff,#4a5fd0)", fg: "#eef2ff", glyph: "◆" },
  WETH: { bg: "linear-gradient(140deg,#7d95e8,#3d51b8)", fg: "#eef2ff", glyph: "◈" },
  LOX: { bg: "linear-gradient(140deg,#2fd08c,#0e5c38)", fg: "#dcffe011", glyph: "" },
  GOLD: { bg: "linear-gradient(140deg,#ffe9a8,#c2933a)", fg: "#4a3608", glyph: "◉" },
  SILV: { bg: "linear-gradient(140deg,#e9eef2,#8fa0ab)", fg: "#2c363d", glyph: "◎" },
  ALE: { bg: "linear-gradient(140deg,#f0b35e,#8a4d1c)", fg: "#3c1f06", glyph: "◍" },
};

/** Circular token glyph. LOX gets the crossed-arrows mark. */
export function TokenBadge({ symbol, size = 32 }: { symbol: string; size?: number }) {
  const s = STYLE[symbol] ?? {
    bg: "linear-gradient(140deg,#39584a,#16281f)",
    fg: "#cfe3d5",
    glyph: symbol.slice(0, 1),
  };

  if (symbol === "LOX") {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-white/15"
        style={{ width: size, height: size, background: STYLE.LOX.bg }}
      >
        <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 32 32" fill="none" aria-hidden>
          <g stroke="#eafff3" strokeWidth="3" strokeLinecap="round">
            <line x1="6" y1="26" x2="26" y2="6" />
            <line x1="6" y1="6" x2="26" y2="26" />
          </g>
        </svg>
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-center font-semibold ring-1 ring-white/15"
      style={{
        width: size,
        height: size,
        background: s.bg,
        color: s.fg,
        fontSize: size * 0.44,
      }}
      aria-hidden
    >
      {s.glyph}
    </span>
  );
}
