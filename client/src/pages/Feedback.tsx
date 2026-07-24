import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SignInButton } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "sonner";
import { MessageSquare, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

export default function Feedback() {
  usePageMeta({ title: "Feedback | Munymo" });
  const { isAuthenticated, loading } = useAuth();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submit = trpc.feedback.submit.useMutation({
    onSuccess: () => {
      setSent(true);
      setMessage("");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <PublicLayout>
      <div className="container py-10 max-w-xl mx-auto">
        <div className="mb-8 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare size={28} style={{ color: "var(--color-brand)" }} />
            <h1 className="font-display text-3xl" style={{ color: "var(--color-foreground)" }}>
              Feedback
            </h1>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
            You're a founding beta tester — shaping Munymo is part of the job.
            Anything that felt rough, confusing, broken, or brilliant: tell us.
            Every message goes straight to the team.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          </div>
        ) : !isAuthenticated ? (
          <div className="card-glass p-8 text-center animate-fade-up">
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              Sign in to send feedback
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Feedback is tied to your player account so we can follow up.
            </p>
            <SignInButton mode="modal">
              <button className="btn-brand text-sm px-6 py-2.5">
                Sign in
                <ArrowRight size={14} />
              </button>
            </SignInButton>
          </div>
        ) : sent ? (
          <div className="card-glass p-8 text-center animate-fade-up">
            <CheckCircle2 size={36} className="mx-auto mb-4" style={{ color: "var(--color-success)" }} />
            <p className="font-medium mb-2" style={{ color: "var(--color-foreground)" }}>
              Sent — thank you.
            </p>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Your feedback landed directly with the team. It genuinely shapes what
              gets built next.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSent(false)}
                className="btn-ghost text-sm px-5 py-2.5"
              >
                Send more
              </button>
              <Link href="/game" className="btn-brand text-sm px-5 py-2.5">
                Play Today's Game
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="card-glass p-6 animate-fade-up">
            <label
              htmlFor="feedback-message"
              className="block text-sm font-semibold mb-2"
              style={{ color: "var(--color-foreground)" }}
            >
              What's on your mind?
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={5000}
              placeholder="What felt rough? What confused you? What do you wish existed?"
              className="w-full rounded-xl p-4 text-sm leading-relaxed mb-4 resize-y"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
                minHeight: "8rem",
              }}
            />
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs" style={{ color: "var(--color-subtle)" }}>
                Sent with your player name so we can follow up.
              </span>
              <button
                onClick={() => submit.mutate({ message })}
                disabled={message.trim().length < 3 || submit.isPending}
                className="btn-brand text-sm px-6 py-2.5 disabled:opacity-50"
              >
                {submit.isPending ? "Sending…" : "Send Feedback"}
                {!submit.isPending && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
