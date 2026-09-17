import { Link } from "wouter";
import { Dumbbell, BookOpen, GraduationCap, ArrowRight } from "lucide-react";

/**
 * What to do when there's no live game left to play today.
 *
 * Shown to a player who has already submitted, or whose game has locked with a
 * pick in. Their previous ending was "Results will be published after the game
 * closes" — accurate, and a dead end for the seven hours between the 9:30 ET
 * lockout and results after the close.
 *
 * The daily game is deliberately once-a-day and that scarcity is doing real
 * work, so this is not an attempt to extend a session indefinitely. It is
 * simply that a player who has finished and wants more should not have to go
 * hunting through a menu to find that an archive and a learning hub exist.
 */
export default function MoreToPlay() {
  const options = [
    {
      href: "/practice",
      icon: Dumbbell,
      title: "Practise a past matchup",
      body: "Play a completed game end to end and get scored straight away.",
    },
    {
      href: "/research",
      icon: BookOpen,
      title: "Read the archive",
      body: "Every past matchup with its research, result and community split.",
    },
    {
      href: "/learn",
      icon: GraduationCap,
      title: "Take a lesson",
      body: "Short lessons on the ideas behind the metrics you just read.",
    },
  ];

  return (
    <div className="mt-5">
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: "var(--color-brand)" }}
      >
        While you wait
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        {options.map((o, i) => (
          <Link
            key={o.href}
            href={o.href}
            className="card-glass p-4 text-left transition-all hover:opacity-90 active:scale-[0.98] animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <o.icon size={18} className="mb-2.5" style={{ color: "var(--color-brand)" }} />
            <p
              className="text-sm font-semibold mb-1 flex items-center gap-1"
              style={{ color: "var(--color-foreground)" }}
            >
              {o.title}
              <ArrowRight size={13} style={{ color: "var(--color-brand)" }} />
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
              {o.body}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
