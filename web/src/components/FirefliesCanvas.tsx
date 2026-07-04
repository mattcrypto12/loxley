"use client";

import { useEffect, useRef } from "react";

interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  pulse: number; // pulse speed
  hue: "gold" | "ember";
}

/**
 * Ambient fireflies drifting through the greenwood fog.
 * Budget-conscious: ~40 particles, 30fps cap, halts when the tab is hidden
 * and honors prefers-reduced-motion.
 */
export function FirefliesCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let last = 0;
    const FRAME_MS = 1000 / 30;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const COUNT = Math.min(44, Math.floor((width * height) / 42000));
    const flies: Firefly[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.16,
      r: 0.8 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      pulse: 0.008 + Math.random() * 0.014,
      hue: Math.random() < 0.72 ? "gold" : "ember",
    }));

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < FRAME_MS) return;
      last = t;

      ctx.clearRect(0, 0, width, height);

      for (const f of flies) {
        f.phase += f.pulse * FRAME_MS;
        f.x += f.vx + Math.sin(f.phase * 0.35) * 0.12;
        f.y += f.vy + Math.cos(f.phase * 0.27) * 0.08;

        if (f.x < -20) f.x = width + 20;
        if (f.x > width + 20) f.x = -20;
        if (f.y < -20) f.y = height + 20;
        if (f.y > height + 20) f.y = -20;

        const glow = 0.28 + 0.72 * (0.5 + 0.5 * Math.sin(f.phase));
        const [r, g, b] =
          f.hue === "gold" ? [255, 215, 111] : [125, 255, 196];

        // outer halo
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 7);
        grad.addColorStop(0, `rgba(${r},${g},${b},${0.5 * glow})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 7, 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.fillStyle = `rgba(${r},${g},${b},${0.9 * glow})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[1]"
    />
  );
}
