/**
 * MunymoLogo — theme-aware logo component
 *
 * Variants:
 *   "full"   — full wordmark (munymo + checkmark/arrow) — use in nav, footer, landing
 *   "icon"   — just the "o" with checkmark/arrow mark — use for favicon, small contexts
 *
 * The full wordmark uses the original PNG with CSS filter inversion for dark mode.
 * The icon mark is hand-coded SVG for pixel-perfect small sizes.
 *
 * Colour reference from original:
 *   wordmark:  #002000  (deep forest green)
 *   accent:    #009050  (bright emerald green)
 */

import { useTheme } from "@/contexts/ThemeContext";

interface MunymoLogoProps {
  variant?: "full" | "icon";
  /** Height in px — width scales proportionally */
  height?: number;
  className?: string;
}

export default function MunymoLogo({
  variant = "full",
  height = 32,
  className = "",
}: MunymoLogoProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (variant === "icon") {
    // Hand-coded SVG icon mark — the "o" circle with checkmark and upward arrow
    // Scales perfectly at any size
    const size = height;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="Munymo"
      >
        {/* Circle body (the "o") */}
        <circle
          cx="50"
          cy="55"
          r="32"
          fill={isDark ? "#e8f5e9" : "#002000"}
        />
        {/* Checkmark */}
        <path
          d="M 34 56 L 44 66 L 58 50"
          stroke={isDark ? "#002000" : "#009050"}
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Upward arrow shaft */}
        <line
          x1="55"
          y1="62"
          x2="72"
          y2="30"
          stroke="#009050"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Arrow head */}
        <path
          d="M 65 26 L 76 28 L 74 39"
          stroke="#009050"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }

  // Full wordmark — cropped PNG (no whitespace) with CSS filter for dark mode adaptation
  // Cropped dimensions: 1200 x 260 → aspect ratio 4.6154
  const aspectRatio = 1200 / 260;
  const width = Math.round(height * aspectRatio);

  return (
    <img
      src="/manus-storage/munymo-logo-cropped_e625fcf7.png"
      alt="Munymo"
      width={width}
      height={height}
      className={className}
      style={{
        // In dark mode: invert the dark green to near-white while preserving the
        // bright emerald accent as best as possible.
        // filter: invert makes #002000 → #ffdfff (near white-pink), so we also
        // hue-rotate to shift back toward a neutral white/light green.
        filter: isDark
          ? "invert(1) hue-rotate(150deg) brightness(1.1) saturate(0.7)"
          : "none",
        transition: "filter 250ms ease",
        display: "block",
        objectFit: "contain",
      }}
    />
  );
}
