/**
 * EmailLanding — /email-landing?to=/game/1/result#t=<ticket>
 *
 * Every emailed magic link ends here, via /api/magic. The contract:
 *
 *   1. Already signed in on this browser → go straight to the destination.
 *      The ticket is never touched: no new session, no "new device" email, no
 *      confirmation screen. This is the case that used to send a signed-in
 *      player through Clerk's sign-in page anyway.
 *   2. Not signed in, ticket present → redeem it here with Clerk's SDK and go
 *      to the destination. No hosted auth page in between.
 *   3. Ticket missing, used, superseded or too old → say exactly which, and
 *      offer a normal sign-in that still ends at the destination.
 *
 * The ticket arrives in the url fragment. An inline script in index.html moves
 * it into sessionStorage and cleans the address bar before analytics loads, so
 * it is never recorded anywhere; the fragment read below is only a fallback.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useClerk, useSignIn, useUser } from "@clerk/clerk-react";
import PublicLayout from "@/components/PublicLayout";
import MunymoLogo from "@/components/MunymoLogo";
import { Loader2, ArrowRight } from "lucide-react";

const TICKET_KEY = "munymo-magic-ticket";

function takeTicket(): string | null {
  let ticket: string | null = null;
  try {
    ticket = sessionStorage.getItem(TICKET_KEY);
    sessionStorage.removeItem(TICKET_KEY);
  } catch {
    /* private mode — fall through to the fragment */
  }
  if (!ticket) {
    const m = window.location.hash.match(/[#&]t=([^&]+)/);
    if (m) ticket = decodeURIComponent(m[1]);
  }
  if (window.location.hash) {
    try {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } catch {
      /* cosmetic only */
    }
  }
  return ticket;
}

type Failure = "used" | "superseded" | "expired" | "invalid";

const FAILURE_COPY: Record<Failure, { title: string; body: string }> = {
  used: {
    title: "This link has already been used",
    body: "Each email link signs you in once. Sign in below and you'll go straight to",
  },
  superseded: {
    title: "A newer email has replaced this link",
    body: "Use the link in the latest Munymo email, or sign in below to go to",
  },
  expired: {
    title: "This link has expired",
    body: "Emails sent before September 20 carried links that lasted one day. Newer ones last until the next email replaces them, seven days at most. Sign in below to go to",
  },
  invalid: {
    title: "This link is incomplete",
    body: "Part of the link seems to be missing — some mail apps cut long links short. Sign in below to go to",
  },
};

export default function EmailLanding() {
  const [, navigate] = useLocation();
  const { isLoaded: userLoaded, isSignedIn } = useUser();
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { openSignIn } = useClerk();
  const [failure, setFailure] = useState<Failure | null>(null);
  const started = useRef(false);

  const params = new URLSearchParams(window.location.search);
  const rawTo = params.get("to") || "/game";
  const destination = rawTo.startsWith("/") && !rawTo.startsWith("//") ? rawTo : "/game";
  const reason = params.get("r");

  const destinationLabel =
    destination.includes("/result") ? "the result"
    : destination === "/game"      ? "today's game"
    : destination === "/dashboard" ? "your dashboard"
    : "Munymo";

  useEffect(() => {
    if (!userLoaded || !signInLoaded || started.current) return;
    started.current = true;

    const ticket = takeTicket();

    // 1. Already signed in: a magic link is just a link.
    if (isSignedIn) {
      navigate(destination, { replace: true });
      return;
    }

    // 3. /api/magic already ruled the link out.
    if (reason === "superseded" || reason === "expired" || reason === "invalid") {
      setFailure(reason);
      return;
    }
    if (!ticket || !signIn) {
      setFailure("invalid");
      return;
    }

    // 2. Redeem the ticket here.
    (async () => {
      try {
        const attempt = await signIn.create({ strategy: "ticket", ticket });
        if (attempt.status === "complete" && attempt.createdSessionId) {
          await setActive({ session: attempt.createdSessionId });
          navigate(destination, { replace: true });
          return;
        }
        console.warn("[EmailLanding] ticket sign-in did not complete:", attempt.status);
        setFailure("used");
      } catch (err) {
        // Clerk rejects a ticket that was already accepted, revoked or expired.
        console.warn("[EmailLanding] ticket rejected:", err);
        setFailure("used");
      }
    })();
  }, [userLoaded, signInLoaded, isSignedIn, signIn, setActive, navigate, destination, reason]);

  if (!failure) {
    return (
      <PublicLayout>
        <div className="container py-24 flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--color-brand)" }} />
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Taking you to {destinationLabel}…
          </p>
        </div>
      </PublicLayout>
    );
  }

  const copy = FAILURE_COPY[failure];
  return (
    <PublicLayout>
      <div className="container py-24 max-w-md mx-auto text-center">
        <div className="card-glass p-10">
          <div className="flex justify-center mb-6">
            <MunymoLogo height={36} />
          </div>
          <h1 className="font-display text-2xl mb-2" style={{ color: "var(--color-foreground)" }}>
            {copy.title}
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
            {copy.body} <strong>{destinationLabel}</strong>.
          </p>
          <button
            className="btn-brand w-full justify-center"
            onClick={() => openSignIn({ forceRedirectUrl: `${window.location.origin}${destination}` })}
          >
            Sign in to Munymo <ArrowRight size={15} />
          </button>
          <p className="text-xs mt-5" style={{ color: "var(--color-subtle)" }}>
            On iPhone, email links open in Safari, not in the Munymo app on your Home Screen. If
            you're signed in there, just open the app — it's already on {destinationLabel}.
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
