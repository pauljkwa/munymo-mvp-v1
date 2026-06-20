import { useUser, useClerk } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false } = options ?? {};
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { openSignIn, signOut } = useClerk();
  const utils = trpc.useUtils();

  // Fetch our DB user record (has role, tier, etc.)
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: isLoaded && isSignedIn === true,
  });

  const logout = useCallback(async () => {
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

  return {
    user,
    loading,
    error: meQuery.error ?? null,
    isAuthenticated,
    clerkUser,
    refresh: () => meQuery.refetch(),
    logout,
    login,
  };
}
