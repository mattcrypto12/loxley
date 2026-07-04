/**
 * The Loxley wordmark — engraved capitals, the X drawn as crossed arrows.
 */
export function Wordmark({ size = 28 }: { size?: number }) {
  const arrowScale = size / 28;
  return (
    <span className="inline-flex items-baseline select-none">
      <span
        className="engraved font-semibold text-moon-100"
        style={{ fontSize: size }}
      >
        LO
      </span>
      <CrossedArrows size={30 * arrowScale} />
      <span
        className="engraved font-semibold text-moon-100"
        style={{ fontSize: size }}
      >
        LEY
      </span>
    </span>
  );
}

export function CrossedArrows({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="mx-[0.06em] translate-y-[0.14em]"
    >
      <defs>
        <linearGradient id="lox-arrow-gold" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#ffe9a8" />
          <stop offset="55%" stopColor="#e8b64c" />
          <stop offset="100%" stopColor="#c2933a" />
        </linearGradient>
      </defs>
      {/* arrow 1: bottom-left to top-right */}
      <g stroke="url(#lox-arrow-gold)" strokeWidth="2" strokeLinecap="round">
        <line x1="5" y1="27" x2="27" y2="5" />
        {/* head */}
        <path d="M27 5 L20.5 6.8 M27 5 L25.2 11.5" fill="none" />
        {/* fletching */}
        <path d="M7.4 24.6 L4.2 21.4 M9.8 22.2 L6.6 19" fill="none" strokeWidth="1.6" />
      </g>
      {/* arrow 2: top-left to bottom-right */}
      <g stroke="url(#lox-arrow-gold)" strokeWidth="2" strokeLinecap="round" opacity="0.92">
        <line x1="5" y1="5" x2="27" y2="27" />
        <path d="M27 27 L20.5 25.2 M27 27 L25.2 20.5" fill="none" />
        <path d="M7.4 7.4 L4.2 10.6 M9.8 9.8 L6.6 13" fill="none" strokeWidth="1.6" />
      </g>
    </svg>
  );
}
