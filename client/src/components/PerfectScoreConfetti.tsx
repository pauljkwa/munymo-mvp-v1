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

const PIECES = 150;
const DURATION_MS = 5000;

/**
 * Physics in pixels per SECOND, driven by elapsed time — not per frame.
 *
 * The first version advanced by a fixed amount each frame, which silently
 * halved both the height and the duration on a 120Hz display (ProMotion
 * iPhones, high-refresh monitors): twice the frames in the same second means
 * twice the gravity applied. It looked fine at 60Hz and anticlimactic on a
 * modern phone, which is exactly how it was reported.
 */
const GRAVITY = 900; // px/s²
/**
 * Downward speed is capped so pieces flutter back down rather than plummeting.
 * This is what makes the burst last: without it everything is off-screen in
 * about two seconds regardless of how hard it was launched.
 */
const TERMINAL_VY = 260; // px/s

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
  swayPhase: number;
  swayAmp: number;
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

    // Launch speed is derived from how far up the screen each piece should
    // reach, so the burst fills a tall desktop window and a short phone alike
    // instead of being tuned to one screen size. v = √(2·g·rise).
    const launchSpeedFor = (riseFraction: number) =>
      Math.sqrt(2 * GRAVITY * height * riseFraction);

    // Two launch points in the lower corners, angled inward — reads as a
    // celebration rather than as something falling on the player.
    const pieces: Piece[] = Array.from({ length: PIECES }, (_, i) => {
      const fromLeft = i % 2 === 0;
      // 0.8–1.25 of the viewport height: most clear the top of the screen.
      const rise = 0.8 + Math.random() * 0.45;
      const speed = launchSpeedFor(rise);
      // Mostly upward, fanned INWARD across the screen. The sign matters: the
      // left launcher must throw right and vice versa, or both fire off the
      // sides and you see a thin strip of confetti down each edge.
      const angle = (fromLeft ? 1 : -1) * (0.28 + Math.random() * 0.5);
      return {
        x: fromLeft ? width * 0.08 : width * 0.92,
        y: height + 10,
        vx: Math.sin(angle) * speed * 0.85,
        vy: -Math.cos(angle) * speed,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 7,
        w: 7 + Math.random() * 7,
        h: 4 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        swayPhase: Math.random() * Math.PI * 2,
        swayAmp: 20 + Math.random() * 45,
      };
    });

    let raf = 0;
    const start = performance.now();
    let last = start;

    const frame = (now: number) => {
      // Clamped so a backgrounded tab doesn't resume with one enormous step
      // that teleports every piece off-screen.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const elapsed = now - start;

      ctx.clearRect(0, 0, width, height);

      // Fade over the final quarter so the burst ends rather than vanishing.
      const fadeStart = DURATION_MS * 0.75;
      const fade =
        elapsed < fadeStart ? 1 : Math.max(0, 1 - (elapsed - fadeStart) / (DURATION_MS - fadeStart));
      ctx.globalAlpha = fade;

      for (const p of pieces) {
        p.vy = Math.min(p.vy + GRAVITY * dt, TERMINAL_VY);
        p.vx *= 1 - 1.1 * dt; // air drag
        p.swayPhase += 2.4 * dt;
        p.x += (p.vx + Math.cos(p.swayPhase) * p.swayAmp) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;

        // Skip anything that has fallen well past the bottom.
        if (p.y > height + 40) continue;

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
