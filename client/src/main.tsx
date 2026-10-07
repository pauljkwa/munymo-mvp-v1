import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { getQueryKey } from "@trpc/react-query";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

// Production build — uses VITE_CLERK_PUBLISHABLE_KEY from environment
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

const queryClient = new QueryClient();

// Page data the server embedded in the html (buildPrefetch in server/_core/seo.ts),
// seeded into the query cache before the first render so the page appears
// without waiting on — or depending on — the API. This is what Google's
// renderer indexes; see the WHY on buildPrefetch.
try {
  const prefetch = (window as { __MUNYMO_PREFETCH__?: unknown }).__MUNYMO_PREFETCH__;
  if (prefetch) {
    const entries = superjson.deserialize(prefetch as never) as {
      path: string[];
      input: unknown;
      data: unknown;
    }[];
    for (const e of entries) {
      const procedure = e.path.reduce((node: any, key) => node?.[key], trpc);
      if (procedure) queryClient.setQueryData(getQueryKey(procedure, e.input, "query"), e.data);
    }
  }
} catch (err) {
  // A bad payload just means the page fetches normally.
  console.error("[prefetch] ignored:", err);
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;
  // Clerk handles the redirect to sign-in automatically via ClerkProvider
  // We just need to clear any stale query cache
  queryClient.clear();
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      // Send the Clerk session token with every tRPC request
      async headers() {
        const { Clerk } = window as any;
        const token = await Clerk?.session?.getToken?.();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

// Overrides Clerk's generic dialog copy so the sign-up flow carries the
// founding-beta framing through the moment of commitment. Only the strings
// listed here change; everything else keeps Clerk's defaults.
const clerkLocalization = {
  signUp: {
    start: {
      title: "Join the Munymo founding beta",
      subtitle: "Free to play — your join date is recorded from day one",
    },
  },
  signIn: {
    start: {
      title: "Welcome back to Munymo",
      subtitle: "Sign in to keep your streak going",
    },
  },
};

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" localization={clerkLocalization}>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </ClerkProvider>
);
