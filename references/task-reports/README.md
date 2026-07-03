# Task Completion Reports

One Completion Report per remediation task (see `../munymo-fable5-remediation-plan.md`, Section 0.2).

**Naming:** `T<#>-<slug>.md` — e.g. `T1-weekend-streak.md`. One file per task; never overwrite a prior report.

**Workflow (single wired Manus Deploy task, one change at a time):**
1. Manus makes the change → verifies (`tsc --noEmit` + `vitest run`) → writes the Completion Report here using the template in Section 0.2.
2. Manus commits code + report and **pushes to GitHub (backup only — NOT Publish).**
3. Claude Code reads the real git diff + the report, confirms they match and the task's Acceptance criteria hold, and updates `munymo-handover-v2.md` Section 4 + the plan's tracking checklist.
4. On Claude Code's **GO**, Paul clicks **Publish** to deploy live. Then a quick live check, then the next task.

**Schema tasks (⚠️ SCHEMA):** Manus must STOP for Paul's written approval on the exact column diff before any `pnpm db:push`. The Deploy task can run migrations against live player data — this stop is non-negotiable.

**Honesty rule:** a report must disclose any skipped test, partial fix, or deviation from the plan's suggested approach. "Deviated because X" is a good report; a silently different implementation is the failure mode this whole loop guards against.
