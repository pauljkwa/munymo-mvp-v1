import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cron from "node-cron";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMagicLinkRedirect } from "./magicLinkRedirect";
import { registerScheduledCuration } from "./scheduledCuration";
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

  // Daily curation agent — runs at 4:15 PM America/New_York, ~15 min after
  // NASDAQ closes. IANA timezone keeps this correct across DST. Claude-powered
  // replacement for the Manus cron.
  cron.schedule("15 16 * * 1-5", async () => {
    console.log("[curation-agent] Cron triggered");
    try {
      const { runDailyCuration } = await import("./curationAgent");
      await runDailyCuration();
    } catch (err) {
      console.error("[curation-agent] Cron error:", err);
    }
  }, { timezone: "America/New_York" });

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
