import { SignIn } from "@clerk/clerk-react";
import { Loader2 } from "lucide-react";
import { Redirect, Route, Switch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Dashboard from "./Dashboard";

// The owner dashboard app (references/owner-dashboard-spec.md §5). Rendered by
// App.tsx instead of the game when the page is served from the dash host:
// no game router, no tab bar, no push hook, no analytics, no service worker.

const DASH_NAVY = "#0b1f3a";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-5 px-4 py-8 text-center"
      style={{ background: DASH_NAVY, color: "#fff" }}
    >
      {children}
    </div>
  );
}

function DashIcon() {
  return <img src="/dash/icon-192.png" width={72} height={72} alt="Munymo Dash" className="rounded-2xl" />;
}

function SignOutLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm underline" style={{ color: "rgba(255,255,255,0.7)" }}>
      Sign out
    </button>
  );
}

/** Signed in: ask the server who we are, then show the dashboard or the refusal. */
function OwnerGate({ onSignOut }: { onSignOut: () => void }) {
  const who = trpc.owner.whoami.useQuery(undefined, { retry: false });

  if (who.isLoading) {
    return (
      <Centered>
        <Loader2 size={24} className="animate-spin" />
      </Centered>
    );
  }
  if (who.isError || !who.data) {
    return (
      <Centered>
        <DashIcon />
        <p className="text-sm max-w-xs">Could not check your account just now. {who.error?.message}</p>
        <SignOutLink onClick={onSignOut} />
      </Centered>
    );
  }
  if (!who.data.isOwner) {
    return (
      <Centered>
        <DashIcon />
        <h1 className="font-display text-xl">Owner only</h1>
        <p className="text-sm max-w-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
          This dashboard belongs to the site owner. Your account id is {who.data.userId}.
        </p>
        <SignOutLink onClick={onSignOut} />
      </Centered>
    );
  }
  return <Dashboard onSignOut={onSignOut} />;
}

function Gate() {
  const { loading, isAuthenticated, clerkUser, logout } = useAuth();

  if (loading) {
    return (
      <Centered>
        <Loader2 size={24} className="animate-spin" />
      </Centered>
    );
  }
  if (isAuthenticated) return <OwnerGate onSignOut={logout} />;

  // Clerk says signed in but there is no usable account row (deactivated).
  if (clerkUser) {
    return (
      <Centered>
        <DashIcon />
        <p className="text-sm max-w-xs">This account cannot use the dashboard.</p>
        <SignOutLink onClick={logout} />
      </Centered>
    );
  }

  return (
    <Centered>
      <DashIcon />
      {/* Hash routing keeps Clerk's own steps off the URL path, so the "every other path goes to /" rule never fights it.
          The sign-up link is hidden: nobody creates a Munymo account from here. */}
      <SignIn
        routing="hash"
        afterSignInUrl="/"
        appearance={{ elements: { footerAction: { display: "none" } } }}
      />
    </Centered>
  );
}

export default function DashApp() {
  return (
    <ErrorBoundary>
      {/* Dark by default; the header's sun/moon button switches. The choice is
          remembered under the dash origin's own localStorage, separate from munymo.com's. */}
      <ThemeProvider defaultTheme="dark" switchable>
        <Toaster richColors position="top-center" />
        <Switch>
          <Route path="/" component={Gate} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
