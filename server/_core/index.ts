import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerMagicLinkRedirect } from "./magicLinkRedirect";
import { registerScheduledCuration } from "./scheduledCuration";
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

  // TEMPORARY: one-shot lockout fix for game 150002 — REMOVE AFTER USE
  app.get("/api/admin/fix-lockout-150002", async (req, res) => {
    if (req.query.secret !== "munymo-fix-jun25") {
      return res.status(403).json({ error: "forbidden" });
    }
    const { getDb } = await import("../db");
    const { dailyGames } = await import("../../drizzle/schema.js");
    const { eq } = await import("drizzle-orm");
    const db = await getDb();
    if (!db) return res.status(500).json({ error: "Database unavailable" });
    await db.update(dailyGames)
      .set({ lockoutAt: new Date("2026-06-25T13:30:00.000Z") })
      .where(eq(dailyGames.id, 150002));
    const [game] = await db.select().from(dailyGames).where(eq(dailyGames.id, 150002));
    return res.json(game);
  });
  // END TEMPORARY

  registerOAuthRoutes(app);
  registerMagicLinkRedirect(app);
  registerScheduledCuration(app);
  registerReferralRoutes(app);
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
}

startServer().catch(console.error);
