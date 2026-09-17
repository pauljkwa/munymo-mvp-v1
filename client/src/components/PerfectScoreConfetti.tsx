import { useEffect, useRef } from "react";

/**
 * A single burst of confetti, fired once when a player scores a perfect 100.
 *
 * Deliberately reserved for 100 and nothing less. A perfect game needs a
 * correct prediction AND a correct validation answer inside the 15-second
 * window, so it is genuinely uncommon — which is the only thing separating a
 * nice moment from confetti-on-everything, which reads as cheap.
 *
 * No library: this is ~60 lines of canvas and the bundle had 366KB of dead
 * weight stripped from it recently. Not the place to add a dependency back.
 *
 * Accessibility: honours prefers-reduced-motion and renders nothing at all for
 * players who have asked for less movement. Confetti is exactly the kind of
 * full-screen motion that triggers vestibular problems, so this is a hard
 * requirement rather than a nicety.
 */

const COLORS = [
  "oklch(0.78 0.14 75)", // brand gold
  "#009050", // company A green
  "#1d4ed8", // company B blue
  "#ffffff",
];

const PIECES = 90;
const DURATION_MS = 2600;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  color: string;
};

export default function PerfectScoreConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Respect the OS-level preference. Checked inside the effect rather than at
    // module load so it is correct even if the setting changes between visits.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Two launch points, lower corners, angled inward — reads as a celebration
    // rather than as something falling on the player.
    const pieces: Piece[] = Array.from({ length: PIECES }, (_, i) => {
      const fromLeft = i % 2 === 0;
      const spread = (Math.random() - 0.5) * 1.1;
      return {
        x: fromLeft ? width * 0.1 : width * 0.9,
        y: height * 0.95,
        vx: (fromLeft ? 1 : -1) * (3 + Math.random() * 5) + spread,
        vy: -(9 + Math.random() * 7),
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        w: 6 + Math.random() * 6,
        h: 3 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });

    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      // Fade the whole burst out near the end so it doesn't just stop.
      const fade = Math.max(0, 1 - Math.max(0, elapsed - DURATION_MS * 0.6) / (DURATION_MS * 0.4));
      ctx.globalAlpha = fade;

      for (const p of pieces) {
        p.vy += 0.28; // gravity
        p.vx *= 0.99; // drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      // Above the page, below any modal (ValidationModal sits at z-50).
      style={{ zIndex: 40 }}
    />
  );
}
