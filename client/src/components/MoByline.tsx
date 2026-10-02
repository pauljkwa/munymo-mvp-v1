/**
 * Attribution for anything written by Mo — the daily research brief and the
 * Hindsight Spotlight.
 *
 * Mo is the name of Munymo's AI research agent (Paul, 2026-10-02: it completes
 * "eeny meeny miny mo"). The name is a friendlier face, not a different claim:
 * wherever Mo is named, say plainly that Mo is an AI. Never describe Mo as
 * "market-trained", "our own AI" or anything implying a proprietary model —
 * Mo is a general AI model following Munymo's instructions with live news.
 * Honest AI disclosure was a P0 from the 2026-09-17 product audit.
 */
export default function MoByline({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs ${className}`} style={{ color: "var(--color-subtle)" }}>
      Written by Mo, Munymo's AI research agent
    </p>
  );
}
