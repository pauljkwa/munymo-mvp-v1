import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "shared/**/*.test.ts"],
    // SAFETY: the suite must never be able to reach a real database. Several
    // tests rely on "no database" to exercise failure paths — including
    // dashboard.deleteAccount, which would ERASE user 1 for real if a
    // connection existed. On 2026-10-02 the suite was run in a shell that had
    // sourced .env (to apply a migration) and connected to production. Blank
    // the connection strings here so a stray environment can never do that
    // again; server/testIsolation.test.ts asserts it holds.
    env: {
      DATABASE_URL: "",
      MUNYMO_DATABASE_URL: "",
    },
  },
});
