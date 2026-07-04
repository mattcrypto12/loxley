"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * A scatter of gold leaves loosed on swap confirmation.
 * Mount with a fresh `burstKey` to replay.
 */
export function GoldLeafBurst({ burstKey }: { burstKey: number }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 60 + Math.random() * 110;
        return {
          id: `${burstKey}-${i}`,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist * 0.8 - 30,
          rot: (Math.random() - 0.5) * 540,
          scale: 0.6 + Math.random() * 0.9,
          delay: Math.random() * 0.08,
          gold: Math.random() < 0.75,
        };
      }),
    [burstKey],
  );

  if (burstKey === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
      {leaves.map((l) => (
        <motion.span
          key={l.id}
          className="absolute left-1/2 top-1/2"
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: l.scale }}
          animate={{
            x: l.x,
            y: [0, l.y, l.y + 90],
            opacity: [1, 1, 0],
            rotate: l.rot,
          }}
          transition={{ duration: 1.15, delay: l.delay, ease: [0.16, 0.6, 0.45, 1] }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M7 0C9.5 2.5 12 5 12 8a5 5 0 01-10 0c0-3 2.5-5.5 5-8z"
              fill={l.gold ? "#e8b64c" : "#3fe89e"}
              opacity="0.9"
            />
          </svg>
        </motion.span>
      ))}
    </div>
  );
}
