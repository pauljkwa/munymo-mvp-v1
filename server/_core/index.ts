import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cron from "node-cron";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMagicLinkRedirect } from "./magicLinkRedirect";
import { registerScheduledCuration } from "./scheduledCuration";
import { registerUnsubscribe } from "../unsubscribe";
import { registerSeo } from "./seo";
import { registerTesterAgent } from "./testerAgent";
import { registerCurationAgent } from "./curationAgent";
import { autoSubmitLockedPicksHandler, runLockoutSweep } from "../autoSubmitHandler";
import { registerReferralRoutes } from "../referral";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);

  registerOAuthRoutes(app);
  registerMagicLinkRedirect(app);
  registerUnsubscribe(app);
  registerSeo(app);
  registerScheduledCuration(app);
  registerTesterAgent(app);
  registerCurationAgent(app);
  registerReferralRoutes(app);
  app.post("/api/scheduled/auto-submit-locked-picks", autoSubmitLockedPicksHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ path, error }) {
        console.error(`[tRPC] ${path ?? "<unknown>"} — ${error.code}: ${error.message}`, error.stack);
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Afternoon staging cron (Phase A, 2026-08-01) — 14:45 America/New_York,
  // ~75 min of retry runway before close. Researches and stages the NEXT
  // trading day's matchup as a hidden draft ("in the trolley") so the
  // post-close run below only has to score + activate it. If this never
  // runs or fails outright, no draft exists and the post-close run falls
  // back to today's proven combined behavior automatically — nothing here
  // is on the critical path for a game going live.
  cron.schedule("45 14 * * 1-5", async () => {
    console.log("[curation-staging] Cron triggered");
    try {
      const { runStagingCuration } = await import("./curationAgent");
      await runStagingCuration({ finalAttempt: false });
    } catch (err) {
      console.error("[curation-staging] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

  // Staging watchdog — 15:30 ET, re-runs Phase A ONLY if no draft/active/
  // locked game exists yet for a date after today (stagingOutstanding).
  // Mirrors runCurationIfOutstanding: a no-op on a healthy afternoon costs
  // nothing. This is the LAST staging attempt (finalAttempt: true) — after
  // this, the post-close run's legacy fallback owns recovery, not staging.
  cron.schedule("30 15 * * 1-5", async () => {
    try {
      const { stagingOutstanding, runStagingCuration } = await import("./curationAgent");
      if (await stagingOutstanding()) {
        console.log("[curation-staging-watchdog] No staged game yet — re-running staging");
        await runStagingCuration({ finalAttempt: true });
      } else {
        console.log("[curation-staging-watchdog] Staged game already exists (or window closed) — no-op");
      }
    } catch (err) {
      console.error("[curation-staging-watchdog] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

  // Daily curation agent — runs at 4:15 PM America/New_York, ~15 min after
  // NASDAQ closes. IANA timezone keeps this correct across DST. Claude-powered
  // replacement for the Manus cron. finalAttempt:false → a failure here sends
  // the calm ⚠️ auto-retry email, because the watchdog slots below still stand
  // between a bad night and manual recovery. If Phase A staged a draft this
  // afternoon, this run is the small results-only conversation (see
  // curationAgent.ts's attemptDailyCuration pre-check); otherwise it's the
  // original combined flow, unchanged.
  cron.schedule("15 16 * * 1-5", async () => {
    console.log("[curation-agent] Cron triggered");
    try {
      const { runDailyCuration } = await import("./curationAgent");
      await runDailyCuration({ finalAttempt: false });
    } catch (err) {
      console.error("[curation-agent] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

  // Curation watchdog — hourly re-checks after the main run. Each slot is a
  // no-op unless a concluded game is still unscored (so holidays and healthy
  // nights cost nothing); otherwise it re-runs the full agent. Added
  // 2026-07-30 after an Anthropic overload storm outlasted the single 16:15
  // run's retry budget: the deadline for scoring is the next market open,
  // hours away, so one fixed-time attempt was the real fragility. The 19:15
  // slot is the last scheduled chance and escalates to the ❌ manual email.
  cron.schedule("15 17,18,19 * * 1-5", async () => {
    try {
      const { runCurationIfOutstanding } = await import("./curationAgent");
      const hourEt = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour12: false,
        hour: "2-digit",
      }).format(new Date());
      await runCurationIfOutstanding(`watchdog-${hourEt}15ET`, { finalAttempt: hourEt === "19" });
    } catch (err) {
      console.error("[curation-watchdog] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

  // Boot sweep — 3 minutes after every server start (i.e. after every Railway
  // deploy or crash-restart), check once for concluded-but-unscored work and
  // run the agent if any exists. Self-heals the two failure modes no cron slot
  // can catch: a deploy that killed an in-flight run (the in-flight guard is
  // in-memory and dies with the process), and a run whose last watchdog slot
  // already passed. No-op on a healthy boot.
  setTimeout(async () => {
    try {
      const { runCurationIfOutstanding } = await import("./curationAgent");
      await runCurationIfOutstanding("boot-sweep", { finalAttempt: true });
    } catch (err) {
      console.error("[curation-watchdog] Boot sweep error:", err);
    }
  }, 3 * 60 * 1000);

  // Streak-at-risk reminder emails — 8:30 AM America/New_York, always 60 min
  // before the 9:30 ET lockout regardless of DST. The handler self-skips if
  // there's no active game or the window isn't open. Replaces the old Manus
  // cron (now shared-secret).
  cron.schedule("30 8 * * 1-5", async () => {
    console.log("[streak-at-risk] Cron triggered");
    try {
      const res = await fetch(`${ENV.curationBaseUrl}/api/scheduled/streak-at-risk`, {
        method: "POST",
        headers: { "x-curation-secret": ENV.curationAgentSecret },
      });
      const body = await res.json().catch(() => ({}));
      console.log(`[streak-at-risk] HTTP ${res.status}`, body);
    } catch (err) {
      console.error("[streak-at-risk] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

  // Tester agent — runs at 6:00 PM America/New_York Monday–Friday, after curation.
  cron.schedule("0 18 * * 1-5", async () => {
    console.log("[tester-agent] Cron triggered");
    try {
      const { runTesterPicks } = await import("./testerAgent");
      await runTesterPicks();
    } catch (err) {
      console.error("[tester-agent] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

  // Lockout sweep — 9:35 AM America/New_York, 5 min after the 9:30 ET lockout.
  // Auto-submits gut→final picks and flips games to "locked". No time window:
  // a missed run self-heals by picking up every still-active, past-lockout
  // game on the next sweep.
  cron.schedule("35 9 * * 1-5", async () => {
    console.log("[lockout-sweep] Cron triggered");
    try {
      const result = await runLockoutSweep();
      console.log("[lockout-sweep] Complete:", result);
    } catch (err) {
      console.error("[lockout-sweep] Cron error:", err);
    }
  }, { timezone: "America/New_York" });
}

startServer().catch(console.error);
