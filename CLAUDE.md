# Munymo — Collaboration Rules for AI Agents

These rules apply to every AI agent (Claude Code, Manus, or any future tool) working in this repository. Read them before making any change.

## Deployment

- **Railway is the live host.** Every push to `main` on GitHub triggers an automatic Railway deployment. There is no separate deploy step.
- **Never force-push `main`.** Pull-merge first, then push. `--force` or `--force-with-lease` on `main` is never acceptable.
- **Never clone the repo and start fresh.** Always work in the existing tree.

## Database / Schema

- **Schema changes require Paul's written approval before `pnpm db:push` is run.** Stop and ask — never silently push schema.
- **Only ever ADD columns.** Never drop or rename an existing column. Dropping removes production data; renaming breaks live code before deployment completes.
- **Never initialize a new database.** The TiDB/MySQL database is live and contains real player data.

## Secrets

- **Secrets are never committed to the repository.** Environment variables live in the Railway dashboard. If a secret is needed, ask Paul to add it there.

## Code changes

- **Read the source file before editing.** Do not make assumptions about current state from memory or prior summaries — read the actual file.
- **Any commit that changes a feature's status must also update the handover document** (`references/munymo-handover-v2.md`) Section 4 table in the same commit.
- **tsc and vitest must pass before pushing.** Run `npx tsc --noEmit` and `pnpm test` and fix any failures before committing.

## Stack reference

- **Frontend:** React 19, Tailwind CSS 4, shadcn/ui, Wouter routing — `client/src/`
- **Backend:** Node/Express 4, tRPC 11, Drizzle ORM (MySQL/TiDB) — `server/`
- **Auth:** Clerk (`@clerk/clerk-react`, `@clerk/express`)
- **Email:** Resend — `server/email.ts`
- **Push notifications:** Web Push / VAPID — `server/push.ts`
- **Tests:** Vitest — `server/munymo.test.ts`
- **Package manager:** pnpm
