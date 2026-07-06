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
import { autoSubmitLockedPicksHandler } from "../autoSubmitHandler";
import { registerReferralRoutes } from "../referral";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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

  // Daily curation agent — runs at 20:15 UTC Monday–Friday (4:15 AM Perth),
  // ~15 min after NASDAQ closes. Claude-powered replacement for the Manus cron.
  cron.schedule("15 20 * * 1-5", async () => {
    console.log("[curation-agent] Cron triggered");
    try {
      const { runDailyCuration } = await import("./curationAgent");
      await runDailyCuration();
    } catch (err) {
      console.error("[curation-agent] Cron error:", err);
    }
  }, { timezone: "UTC" });

  // Tester agent — runs at 10:00 PM UTC Monday–Friday (6:00 AM Perth)
  cron.schedule("0 22 * * 1-5", async () => {
    console.log("[tester-agent] Cron triggered");
    try {
      const { runTesterPicks } = await import("./testerAgent");
      await runTesterPicks();
    } catch (err) {
      console.error("[tester-agent] Cron error:", err);
    }
  }, { timezone: "UTC" });
}

startServer().catch(console.error);
