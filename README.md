# Ronda

Shared-expense web app ("Cuentas claras, amistades largas"). Groups, expenses split equally, by exact
amounts or by percentages, balances, partial repayments, a "who pays whom" suggestion, and an auditable
history. Product UI is in Spanish (Argentina); code and docs are in English.

- **Stack:** one Next.js 16 app (App Router, Server Components, Server Actions, TypeScript), Supabase
  Postgres + Auth, deployed on Vercel. Installable PWA.
- **Design source of truth:** `ronda-shared-expenses-app/project/` (Claude Design handoff: mobile M01–M18,
  desktop D01–D03, design system). Tokens live in `src/app/globals.css`.
- **Plan, data model and acceptance criteria:** [`docs/PLAN.md`](docs/PLAN.md).

## Contents

1. [Local setup](#local-setup)
2. [Environment variables](#environment-variables)
3. [Database and migrations](#database-and-migrations)
4. [Supabase configuration (hosted)](#supabase-configuration-hosted)
5. [Deploying to Vercel](#deploying-to-vercel)
6. [Installing the PWA](#installing-the-pwa)
7. [Testing](#testing)
8. [How money works](#how-money-works)
9. [Authorization model](#authorization-model)
10. [Membership rules](#membership-rules)
11. [Free tiers and operations](#free-tiers-and-operations)
12. [Known limitations](#known-limitations)

## Local setup

Requirements: Node.js ≥ 20.9, Docker (for the local Supabase stack), npm.

```bash
npm install
npx supabase start          # Postgres, Auth, Mailpit on 127.0.0.1:54321–54324; applies migrations
cp .env.example .env.local  # then paste the values printed by `npx supabase status`
npm run dev                 # http://localhost:3000
```

Sign in with any email address: the magic link is caught by **Mailpit** at <http://127.0.0.1:54324>
(no real email is sent locally). Supabase Studio is at <http://127.0.0.1:54323>.

> Windows note: if `vitest` fails with "Cannot find native binding", npm skipped a platform package
> ([npm/cli#4828](https://github.com/npm/cli/issues/4828)). Delete `node_modules` **and**
> `package-lock.json`, then `npm install`. The committed lockfile already lists all platforms.

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | Supabase API URL (`http://127.0.0.1:54321` locally). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | all | Publishable key (`sb_publishable_…`) or the legacy anon key. Safe in the browser. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback name. |
| `NEXT_PUBLIC_SITE_URL` | all | Public origin (`https://your-app.vercel.app`). Used for metadata; auth links use the request origin. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | optional | `true` shows "Continuar con Google". Only enable after configuring the provider. |

The app **never uses the Supabase secret / service-role key**, and refuses to start if a `sb_secret_…`
key is placed in the publishable variable. Do not add the secret key to Vercel.

## Database and migrations

Versioned SQL lives in `supabase/migrations/` and is applied in filename order:

| File | Contents |
|---|---|
| `20260928120000_schema.sql` | Tables, constraints, immutability triggers, currency lock, deferred share-sum check, profile bootstrap. |
| `20260928120100_rls.sql` | RLS on every table, membership helper functions, privileges (no direct writes). |
| `20260928120200_functions.sql` | Security-definer RPCs for every write, with validation and audit events. |
| `20260928120300_read_models.sql` | `expense_current` / `expense_current_shares` views (security invoker) and `my_group_summaries()`. |

Commands:

```bash
npm run db:reset                # local: recreate DB and apply all migrations
npx supabase migration new foo  # create a new migration (never edit applied ones)
npm run db:types                # regenerate src/lib/database.types.ts after schema changes
npx supabase link --project-ref <ref>   # once, for a hosted project
npx supabase db push            # apply pending migrations to the linked hosted project
```

`db push` records applied versions in `supabase_migrations.schema_migrations`, so it is safe to run
repeatedly. Take a backup before pushing to production (Dashboard → Database → Backups, or
`npx supabase db dump`).

## Supabase configuration (hosted)

1. Create a project at <https://supabase.com> and note the project URL and publishable key
   (Project Settings → API).
2. Apply the schema: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. **Auth → URL configuration:**
   - Site URL: `https://<your-domain>`
   - Redirect URLs: `https://<your-domain>/auth/callback` (add preview domains such as
     `https://*-<team>.vercel.app/auth/callback` if you use Vercel previews).
4. **Auth → Email templates** — for both **Magic link** and **Confirm signup**, set the subject to
   "Tu link para entrar a Ronda" and paste `supabase/templates/magic_link.html`. The template links to
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`, which `/auth/callback` verifies on the server;
   this works even if the email is opened in another browser.
5. **Auth → Providers → Email:** keep email enabled; set the OTP/link expiry to **900 s** (the UI says
   "Vence en 15 minutos").
6. **SMTP:** Supabase's built-in email sender is meant for testing and is heavily rate-limited. For real
   users configure custom SMTP (Auth → SMTP Settings) with a provider you already have; free tiers of
   several providers are enough for small groups.
7. **Google (optional):** create an OAuth client in Google Cloud, add it under Auth → Providers → Google,
   add `https://<project>.supabase.co/auth/v1/callback` as the authorized redirect URI in Google, then set
   `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

Local equivalents of steps 3–5 are in `supabase/config.toml`.

## Deploying to Vercel

1. Push the repository to GitHub/GitLab and import it in Vercel (framework preset: Next.js; defaults
   for build and output).
2. Add the environment variables above for Production (and Preview if used).
3. Deploy. Then set the Supabase Site URL and redirect URLs to the deployed domain (see above).
4. Smoke test: sign in, create a group, add an expense, open `/manifest.webmanifest`.

No other infrastructure is needed: no separate backend, queue, storage bucket or paid service.

## Installing the PWA

Served over HTTPS, Ronda is installable:

- **Android / Chrome / Edge:** browser menu → "Instalar app" (or the prompt from Cuenta → "Instalar Ronda").
- **iOS / iPadOS (Safari):** Share → "Agregar a inicio".
- **Desktop Chrome/Edge:** install icon in the address bar.

Service-worker strategy (`public/sw.js`, registered only in production builds):

- Hashed build assets (`/_next/static/*`) and icons: cache-first (immutable, public).
- Page navigations: **network only**, with a precached `/offline` page as fallback. Pages contain live,
  private balances, so they are never cached: this avoids showing stale balances as current and leaking
  data on shared devices.
- Server Actions, RSC payloads and Supabase requests are not intercepted.

Bump `VERSION` in `public/sw.js` to invalidate caches when changing the strategy.

## Testing

```bash
npm run typecheck
npm run lint
npm test              # unit: money parsing/formatting, splits & rounding, balances, repayments,
                      #       settlement, edit diffs, CSV, email/redirect helpers (74 tests)
npm run test:db       # pgTAP against local Supabase: RLS isolation, denied direct writes, RPC
                      #       authorization, split-rule enforcement, currency lock, immutability,
                      #       voids, partial payments, membership rules (74 assertions)
npm run test:e2e      # Playwright (needs `npm run dev` + local Supabase): sign-in/out, groups &
                      #       invites, expenses (3 split methods, edit, void, undo), settle & partial
                      #       payment, history/CSV/activity (5 flows)
```

Optional suites: `PWA=1 E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/pwa.spec.ts`
against `npm run build && npx next start -p 3100`; `SCREENS=1 npx playwright test e2e/screens.spec.ts`
captures design-review screenshots into `test-results/screens/`.

## How money works

- Amounts are **integer minor units** (cents) end to end: `bigint` in Postgres, safe integers in
  TypeScript (`BigInt` for percentage products). Input like `86.500,50`, `86500.5` or `1.234` is parsed
  with string arithmetic (`src/lib/money.ts`); floats are never used.
- **Equal:** `floor(total / n)` each; leftover cents (< n) go to the payer if they participate (the form
  says "vos absorbés $ 0,01"), otherwise one cent each in member order.
- **Percentages:** basis points summing to exactly 100 %; each share is `floor(total × bp / 10000)` and
  leftover cents go to the largest remainders, ties by member order.
- **Exact:** must add up exactly; the form shows "Faltan asignar…/Sobran…" and a one-tap fix.
- The server recomputes shares from raw inputs; the database re-verifies the **same rounding rules**
  (`_validate_shares`) and a deferred trigger checks that shares sum to the amount.
- **One currency per group** (ARS, USD or EUR), chosen at creation and locked after the first movement;
  RPCs and triggers reject mismatches. Overall balances are shown per currency and never added together.
- **Balances:** `paid − own shares + payments sent − payments received`, over non-voided current
  revisions. Partial payments simply reduce the net; overpayment flips direction.
- **Suggestion:** greedy largest-debtor → largest-creditor matching (≤ n − 1 transfers, deterministic).
  The UI calls it one possible way to settle, not the only or guaranteed-minimal one.
- **Audit:** edits insert a new revision (old ones are immutable); voids are one-way flags; nothing is
  deleted, even by the service role (triggers). Every action writes a `group_events` row.

## Authorization model

- RLS is enabled on every table. Reads require an **active** membership in the group
  (`is_group_member`). Profiles are visible only to yourself and people you share a group with; emails
  are not exposed.
- `authenticated` has **no INSERT/UPDATE/DELETE** on financial or membership tables. All writes go
  through `security definer` RPCs with an empty `search_path` that check `auth.uid()` and ownership.
  Only `profiles.display_name` and `payment_alias` are directly updatable, and only on your own row.
- Server Actions validate inputs with zod and then call RPCs with the **user's** session, so calling an
  action directly cannot bypass the database checks. `anon` can do nothing.
- Owner-only: invite links, adding people without an account, removing members, roles, group settings.

## Membership rules

- A member slot can exist without an account ("Sin cuenta"), optionally reserved for an email. Signing
  in with that verified email, or claiming the slot from an invite link, attaches the account and keeps
  all history.
- **Leaving** requires a zero balance. The last owner must hand over administration before leaving
  while others with accounts remain.
- **Removing** someone with a balance requires confirmation; their balance stays in the group and in the
  settle suggestion, and payments to/from them can still be recorded.
- Former members keep their name on historical records, cannot be added to new expenses, and lose
  access to the group. Nothing they created is deleted.

## Free tiers and operations

Ronda is designed to fit on free plans for small groups, but **provider limits and terms change —
check the current Supabase and Vercel pricing pages before relying on them**:

- **Supabase free projects** have caps on database size, egress and monthly active users, and may be
  **paused after a period of inactivity**; a paused project must be resumed from the dashboard. Free
  projects have limited backup options, so export important groups (CSV) and consider scheduled
  `supabase db dump` backups.
- **Supabase built-in email** is only for testing (very low hourly limit); use custom SMTP in production.
- **Vercel Hobby** is intended for personal, non-commercial use and has function execution and
  bandwidth limits.
- Data per group is small (a few rows per expense). Balances are computed per request from the group's
  rows; groups are capped at 50 active members and users at 200 active groups.

## Known limitations

- **Impeccable was not available** in this environment (not found in the project or tooling), so the
  design review was done manually against the design-system file with screenshot comparisons
  (`e2e/screens.spec.ts`).
- Desktop group page lists movements as rows instead of the D01 table columns (Fecha / Pagó / Total /
  Para vos).
- On desktop, "Nuevo gasto" opens as a right panel over a dimmed backdrop but the group page is not
  rendered behind it (no intercepting route).
- No notifications (email/push). The receipt says the payment is in the group history; it does not
  claim anyone was notified.
- Offline: no offline drafts or automatic retries of failed saves; offline navigation shows `/offline`.
- "Deshacer" is offered after creating an expense or payment (it voids it); edits have no undo.
- Currencies limited to ARS, USD and EUR (2-decimal); no conversion between groups.
- Former members cannot view the group anymore, even their own history (the owner can export CSV).
- Activity shows the 150 most recent movements across all groups and loads every group on request;
  fine for personal use, not optimized for hundreds of groups.
- Attachments/receipt photos are intentionally out of scope for v1. Account self-deletion is not
  implemented. Deleting a user from Supabase Auth turns their memberships into unclaimed slots (history
  is kept), but the database rejects it while they are still a group **owner** — transfer ownership first.
- Email typo suggestions only trigger for invalid addresses (e.g. `@gmail`), not for valid typos.
