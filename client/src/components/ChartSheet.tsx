import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { CandlestickChart } from "@/components/CandlestickChart";

interface ChartSheetProps {
  ticker: string;
  companyName: string;
  accentColor?: string;
  onClose: () => void;
}

/**
 * Full-screen slide-up chart panel.
 * - Animates in from the bottom of the screen.
 * - Locks body scroll while open via a CSS class (NOT inline style) so the
 *   cleanup is guaranteed even if the component unmounts mid-animation
 *   (e.g. iOS back swipe). Inline style overrides are NOT cleaned up
 *   reliably on iOS when navigation interrupts the React unmount cycle.
 * - Swipe down (or tap ✕) to dismiss with a slide-down animation.
 */
export function ChartSheet({ ticker, companyName, accentColor = "#009050", onClose }: ChartSheetProps) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const savedScrollY = useRef(0);

  // Animate in + lock body scroll using a CSS class
  useEffect(() => {
    savedScrollY.current = window.scrollY;
    // Add class — CSS handles overflow:hidden (see index.css)
    document.documentElement.classList.add("sheet-open");
    document.body.dataset.sheetOpen = "1";
    // Trigger slide-up animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(raf);
      // Always remove the class — even if navigation interrupted the dismiss animation
      document.documentElement.classList.remove("sheet-open");
      delete document.body.dataset.sheetOpen;
      window.scrollTo(0, savedScrollY.current);
    };
  }, []);

  // Swipe-down-to-dismiss via pointer events
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    dragDelta.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    if (delta > 0) {
      dragDelta.current = delta;
      setDragOffset(delta);
    }
  };

  const handlePointerUp = () => {
    if (dragDelta.current > 100) {
      dismiss();
    } else {
      setDragOffset(0);
    }
    dragStartY.current = null;
  };

  const dismiss = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  return (
    <div
      className="fixed inset-0 z-[200]"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{
          height: "92dvh",
          background: "var(--color-surface)",
          borderRadius: "16px 16px 0 0",
          transform: visible ? `translateY(${dragOffset}px)` : "translateY(100%)",
          transition: dragOffset > 0 ? "none" : "transform 0.32s cubic-bezier(0.23, 1, 0.32, 1)",
          willChange: "transform",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex flex-col items-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div
            className="w-10 h-1 rounded-full mb-3"
            style={{ background: "var(--color-border)" }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pb-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="ticker-chip shrink-0"
              style={{ background: accentColor, color: "#fff", borderColor: accentColor, fontSize: "0.75rem", padding: "2px 8px" }}
            >
              {ticker}
            </span>
            <span className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
              {companyName}
            </span>
          </div>
          <button
            onClick={dismiss}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ background: "var(--color-surface-raised)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
            aria-label="Close chart"
          >
            <X size={15} />
          </button>
        </div>

        {/* Chart — fills remaining space, scrollable within the sheet */}
        <div className="flex-1 overflow-auto p-3" style={{ overscrollBehavior: "contain" }}>
          <CandlestickChart ticker={ticker} companyName={companyName} accentColor={accentColor} />
        </div>
      </div>
    </div>
  );
}
