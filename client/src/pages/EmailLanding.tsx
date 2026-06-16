/**
 * EmailLanding — /email-landing?to=/game/1/result
 *
 * This page is the redirect_url target for all email magic links.
 * After Clerk completes sign-in (or if the token was already used),
 * it reads the `to` query param and either:
 *   - Redirects immediately if the user is signed in
 *   - Shows a friendly "already signed in" / "link expired" fallback
 *     with a manual button to the intended destination
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import PublicLayout from "@/components/PublicLayout";
import MunymoLogo from "@/components/MunymoLogo";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export default function EmailLanding() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [countdown, setCountdown] = useState(3);
  const [redirected, setRedirected] = useState(false);

  // Read the intended destination from ?to= query param
  const params = new URLSearchParams(window.location.search);
  const destination = params.get("to") || "/game";

  // Friendly label for the destination
  const destinationLabel =
    destination.includes("/result") ? "Yesterday's Result"
    : destination === "/game"      ? "Today's Game"
    : destination === "/dashboard" ? "My Dashboard"
    : "Munymo";

  useEffect(() => {
    if (loading) return;

    if (isAuthenticated && !redirected) {
      // Auto-redirect with a short countdown so the user sees confirmation
      const interval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            setRedirected(true);
            navigate(destination);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loading, destination, navigate, redirected]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="container py-24 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>Signing you in…</p>
        </div>
      </PublicLayout>
    );
  }

  if (isAuthenticated) {
    return (
      <PublicLayout>
        <div className="container py-24 max-w-md mx-auto text-center">
          <div className="card-glass p-10 animate-fade-up">
            <div className="flex justify-center mb-6">
              <MunymoLogo height={36} />
            </div>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--color-success-muted)" }}
            >
              <CheckCircle2 size={28} style={{ color: "var(--color-success)" }} />
            </div>
            <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
              You're signed in
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Taking you to <strong>{destinationLabel}</strong> in {countdown}…
            </p>
            <button
              onClick={() => navigate(destination)}
              className="btn-brand w-full justify-center"
            >
              Go now <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  // Not signed in — token was already used or expired
  return (
    <PublicLayout>
      <div className="container py-24 max-w-md mx-auto text-center">
        <div className="card-glass p-10 animate-fade-up">
          <div className="flex justify-center mb-6">
            <MunymoLogo height={36} />
          </div>
          <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
            This link has expired
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
            Email links can only be used once. Sign in normally to view{" "}
            <strong>{destinationLabel}</strong>.
          </p>
          <a
            href={`${window.location.origin}${destination}`}
            className="btn-brand w-full justify-center inline-flex"
            onClick={(e) => {
              e.preventDefault();
              // Trigger the normal Manus OAuth login flow, then redirect to destination
              const loginUrl = new URL("/api/oauth/login", window.location.origin);
              loginUrl.searchParams.set("returnPath", destination);
              window.location.href = loginUrl.toString();
            }}
          >
            Sign in to Munymo <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </PublicLayout>
  );
}
