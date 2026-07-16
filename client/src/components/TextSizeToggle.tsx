import { useTextSize, TEXT_SIZE_ORDER, type TextSize } from "@/contexts/TextSizeContext";

const LABELS: Record<TextSize, string> = {
  small: "Small text",
  medium: "Medium text",
  large: "Large text",
};

// The A glyphs are px-sized on purpose: the control must stay a fixed size
// while the page scales around it, or it grows every time you enlarge the text.
const GLYPH_PX: Record<TextSize, number> = {
  small: 11,
  medium: 14,
  large: 17,
};

export default function TextSizeToggle() {
  const { textSize, setTextSize } = useTextSize();

  return (
    <div
      role="radiogroup"
      aria-label="Text size"
      className="flex items-center rounded-lg p-0.5"
      style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)" }}
    >
      {TEXT_SIZE_ORDER.map(size => {
        const active = textSize === size;
        return (
          <button
            key={size}
            role="radio"
            aria-checked={active}
            aria-label={LABELS[size]}
            title={LABELS[size]}
            onClick={() => setTextSize(size)}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28,
              height: 28,
              fontSize: GLYPH_PX[size],
              fontWeight: 700,
              lineHeight: 1,
              fontFamily: "var(--font-display)",
              background: active ? "var(--color-brand)" : "transparent",
              color: active ? "var(--color-brand-foreground)" : "var(--color-muted)",
            }}
          >
            A
          </button>
        );
      })}
    </div>
  );
}
