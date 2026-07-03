<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->




# AGENTS.md — AttendanceX

## Project Identity
AttendanceX is a Face ID + GPS-based employee attendance and fine-management
system for organizations with 50-60 employees across multiple branches.
It is NOT a payroll system — it only tracks attendance and calculates fines.

## Source of Truth Hierarchy (STRICT — follow in this exact priority order)
1. `/docs/spec.md` — the full technical specification. This is the ONLY
   authoritative source for features, business rules, roles, and data model.
2. `/docs/folder-structure.md` — the exact file/folder layout to follow.
   Do not invent new top-level folders. Extend within the given structure.
3. Stitch AI-generated UI screens (provided as images/reference) — these
   define ONLY visual style, layout, spacing, and component composition.
   They are NOT a source of features or business logic.

If a Stitch screen shows anything that contradicts or is absent from
`/docs/spec.md` (extra buttons, extra pages, extra fields, login/password
forms, payroll screens, generic SaaS boilerplate like billing/teams/social
login/marketing pages), **ignore it**. Do not implement it. When in doubt,
the spec wins, always.

## Tech Stack (do not substitute or add libraries outside this list)
- Next.js 15 (App Router) + TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage, Edge Functions, Realtime, RLS)
- TanStack Query + TanStack Table
- React Hook Form + Zod
- Zustand (only for small global UI state)
- grammY (Telegram bot)
- face-api.js + MediaPipe Face Mesh (client-side face verification & liveness)
- date-fns, recharts, sonner, exceljs, @react-pdf/renderer

Full dependency list with install commands: `/docs/folder-structure.md`.

## Non-Negotiable Rules
1. **No password-based auth ever.** Employees authenticate exclusively via
   Telegram OTP + Supabase Auth magic-link mechanism as described in spec
   section 2.2. No email/password form should ever be generated for User role.
2. **Super Admin and Admin never perform Face ID check-in/out.** They only
   use the desktop Admin Dashboard.
3. **Server time only**, never trust client device time, for any attendance
   timestamp logic.
4. **RLS is mandatory on every table.** No table should be reachable by
   `anon` or `authenticated` roles without an explicit, role-scoped policy.
   `telegram_auth_sessions` must be reachable only by `service_role`.
5. **Branch assignment lives on the schedule, per day** — not on the
   employee record. An employee can work at different branches on
   different days of the week (see spec 4.4).
6. **Fine tiers are fully admin-configurable** (no hardcoded thresholds
   or amounts in code — they must be read from the `fine_rules` table).
7. **This system does not calculate payroll.** Do not build salary,
   payroll, or payment-related features beyond fine tracking and export.
8. Every mutation-heavy API route (check-in, check-out, fine cancellation,
   admin creation, schedule edits) must validate input with Zod and check
   the caller's role server-side — never trust client-provided role claims.

## Workflow Expectations
- Before writing code for a Phase, restate your understanding of the
  relevant spec section(s) in your plan.
- Prefer small, incremental commits over one giant commit per task.
- Write or update tests for any business logic you add (fine calculation,
  geofence radius check, absent-marking cron logic, schedule resolution).
- If something in the spec is ambiguous or contradicts the provided
  designs, stop and ask instead of guessing.
- Do not scaffold features from later Phases while working on an earlier
  one, even if the design shows them.

## Definition of Done (per Phase)
- Code compiles with zero TypeScript errors (`strict: true`)
- No unused dependencies beyond the approved list
- RLS policies exist and are tested for every new table
- All new API routes have input validation and explicit role checks
- No hardcoded business values (fine amounts, radius, grace period) —
  these come from the database, configured via Admin Dashboard