import { useUser, useClerk } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
};

/**
 * Remembers whether the last resolved session was signed in.
 *
 * Knowing for certain that someone is signed in takes two sequential waits:
 * Clerk's script has to load and refresh the session token, and then
 * `auth.me` has to round-trip. On a cold launch of the installed PWA that is
 * seconds of "signed out as far as the UI knows" — long enough for a player to
 * tap a CTA and land in the sign-up modal they don't need.
 *
 * This flag is a *hint*, not authority: it lets the UI render the signed-in
 * branch immediately and be right almost every time, and Clerk corrects it the
 * moment it loads. Never gate anything privileged on it — it is client-side,
 * user-writable, and deliberately stale. Auth itself is still enforced by
 * Clerk on the client and `protectedProcedure` on the server.
 */
const AUTH_HINT_KEY = "munymo-auth-hint";

function readAuthHint(): boolean {
  try {
    return localStorage.getItem(AUTH_HINT_KEY) === "1";
  } catch {
    // Safari private mode throws on localStorage access.
    return false;
  }
}

function writeAuthHint(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(AUTH_HINT_KEY, "1");
    else localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // Nothing to do — the hint is an optimization, not a requirement.
  }
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false } = options ?? {};
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();
  const utils = trpc.useUtils();

  // Snapshot once at mount: the hint answers "what was true last time", so
  // re-reading it mid-render would only add noise.
  const [authHint] = useState(readAuthHint);

  // Fetch our DB user record (has role, tier, etc.)
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isLoaded && isSignedIn === true,
  });

  // Keep the hint in step with Clerk's verdict for the next cold start.
  useEffect(() => {
    if (!isLoaded) return;
    writeAuthHint(isSignedIn === true);
  }, [isLoaded, isSignedIn]);

  const logout = useCallback(async () => {
    // Cleared before signOut: it redirects to "/", and a full page load can
    // beat the effect above, leaving a stale "signed in" hint behind.
    writeAuthHint(false);
    await signOut({ redirectUrl: "/" });
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [signOut, utils]);

  const login = useCallback(() => {
    openSignIn({ afterSignInUrl: window.location.href });
  }, [openSignIn]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (!isLoaded) return;
    if (isSignedIn) return;
    openSignIn({ afterSignInUrl: window.location.href });
  }, [redirectOnUnauthenticated, isLoaded, isSignedIn, openSignIn]);

  const loading = !isLoaded || (isSignedIn === true && meQuery.isLoading);
  const user = meQuery.data ?? null;
  const isAuthenticated = isLoaded && isSignedIn === true && Boolean(user);

  /**
   * Best available answer to "is this a signed-in player?" at this instant.
   *
   * Once Clerk has loaded, its verdict is authoritative and used directly —
   * note this does NOT wait for `auth.me`, so it settles a full round-trip
   * earlier than `isAuthenticated`. Before that, it falls back to the stored
   * hint. Use it to choose which CTA or nav to render; use `isAuthenticated`
   * (or `user`) whenever the DB record itself is actually needed.
   */
  const likelyAuthenticated = isLoaded ? isSignedIn === true : authHint;

  return {
    user,
    loading,
    error: meQuery.error ?? null,
    isAuthenticated,
    likelyAuthenticated,
    clerkUser,
    refresh: () => meQuery.refetch(),
    logout,
    login,
  };
}
