# Ronda — implementation plan

## Repository state at start

- `ronda-shared-expenses-app/` — Claude Design handoff bundle (HTML prototypes). Source of truth:
  - `Ronda - Sistema de diseño.dc.html` — tokens, type scale, components, UX rules.
  - `Ronda - Mobile.dc.html` — screens M01–M18 (390 px).
  - `Ronda - Desktop.dc.html` — screens D01–D03 (1440 px).
  - `Ronda - Direcciones.dc.html` — direction exploration (1a "Libreta" chosen).
- No application code, no git repository, no Impeccable installation found (checked the project,
  `~/.claude`, `~/.agents` and global npm). Design review is done against the design-system file.

## Stack

- Next.js 16 (App Router, TypeScript, Server Components + Server Actions), plain CSS with design tokens.
- Supabase Postgres + Auth via `@supabase/ssr` (cookie sessions). Only the anon key reaches the browser;
  the service-role key is never used by the app.
- `zod` for server-side validation. `vitest` for unit tests. Local Supabase via the Supabase CLI (Docker).
- PWA: `app/manifest.ts`, icons generated with `next/og` `ImageResponse` (no image deps), hand-written
  service worker.

## Data model (all money columns are `bigint` minor units)

| Table | Purpose | Mutability |
|---|---|---|
| `profiles` | 1:1 with `auth.users`: display name, email, optional payment alias | owner updates own row |
| `groups` | name, `currency` (ARS/USD/EUR, fixed), created_by | name editable by owner; currency locked once any expense/payment exists |
| `group_members` | membership **slot**: `user_id` (nullable = person without account), display_name, invited email, `role` (owner/member), `status` (active/left/removed) | status changes only through RPCs |
| `group_invites` | link invites: random token, expires_at, revoked_at | owner revokes |
| `expenses` | stable identity of an expense + void state (`voided_at`, `voided_by`, `void_reason`) | only void columns change, via RPC |
| `expense_revisions` | immutable snapshot: description, amount, currency, payer, date, split method, category, note, author | insert-only |
| `expense_shares` | per-revision per-member share (`share_minor`) + the raw input (exact minor or basis points) | insert-only |
| `payments` | repayment from member → member, amount, date, method, note; void state | insert-only + void via RPC |
| `group_events` | audit log: member joined/left/removed, expense created/edited/voided, payment recorded/voided, invite created/revoked | insert-only |

- An edit inserts a new revision; `expenses.current_revision` points at the latest. Old revisions and their
  shares are never updated or deleted (enforced by triggers), so history shows "before → after".
- Void = soft state on `expenses`/`payments`. Voided records stay visible (struck through) in history and
  in CSV export, and are excluded from balances.
- Participants and payers reference `group_members.id`, not `auth.users.id`, so expenses can include people
  who have not signed up yet; when they accept an invite they claim their slot and inherit its history.

## Money rules

- `lib/money.ts`: integer minor units only; parsing of "86.500,50" / "86500.5" into minor units via string
  arithmetic, never `parseFloat`. Percentages are integer basis points (100 % = 10 000).
- **Equal split:** `floor(total / n)` each; the leftover cents (< n) go to the payer if they participate,
  otherwise one cent each to participants in a stable order (member created order, then id). UI shows
  "Vos absorbés $ 0,01" style notice.
- **Percentage split:** basis points must sum to exactly 10 000. Each share = `floor(total × bp / 10000)`
  (BigInt); leftover cents go one each by largest remainder, ties by the same stable order.
- **Exact split:** shares must sum exactly to the total; no auto-adjust unless the user taps the fix action.
- DB re-checks: shares sum to amount, currency equals group currency, all members belong to the group,
  payer/participants active at creation time.
- **Balances:** `net(member) = Σ paid expenses − Σ own shares + Σ payments sent − Σ payments received`
  over non-voided records. Σ net = 0 is asserted in tests.
- **Settlement suggestion:** greedy — repeatedly match largest debtor with largest creditor (stable
  tie-break). Copy says it is *one* way to settle, not the only one.

## Authorization

- Helper `is_group_member(group_id)` / `is_group_owner(group_id)` — `security definer`, based on
  `auth.uid()` and an **active** membership row.
- RLS is enabled on every table. SELECT policies: members of the group can read that group's rows; users
  read their own profile and co-members' profiles.
- No direct INSERT/UPDATE/DELETE policies on financial and membership tables. All writes go through
  `security definer` RPCs that check `auth.uid()`, membership/ownership, validate inputs and write the
  audit event in the same transaction. Server Actions validate with zod first, then call the RPC with the
  user's session (so RLS/RPC checks apply even if the Server Action is invoked directly).
- Former members (left/removed) lose read access to the group. Their records stay; their name still shows.
- Owner-only: invite link create/revoke, add person without account, remove member, rename group,
  transfer ownership. Any active member: add/edit/void expenses, record/void payments, leave.

## Membership lifecycle ("what happens when someone leaves")

- Historical expenses and payments involving a departed member are **kept unchanged**; balances still
  include them, labelled "ex miembro".
- Leaving yourself is allowed only when your balance is 0 (settle first). The last owner must transfer
  ownership before leaving.
- An owner may remove a member with non-zero balance after an explicit confirmation; their balance stays in
  the group and settlement suggestions still include them, so debts are not silently erased.
- Departed members cannot be chosen as payer/participant in new expenses; existing expenses that include
  them remain editable without dropping them silently.

## Milestones

1. **Scaffold + design system + PWA shell** — Next app, tokens, fonts, base components, manifest, icons, SW.
2. **Database** — migrations (schema, RLS, RPCs, immutability triggers), local Supabase, SQL-level RLS tests.
3. **Money core** — `lib/money`, `lib/split`, `lib/balances`, `lib/settle` + vitest suites.
4. **Auth** — magic link (+ Google when configured), callback, sign-out, middleware-protected routes.
5. **Groups + invites + membership** — list (only mine), create, invite link/WhatsApp, placeholder members,
   accept/claim, manage/leave/remove.
6. **Expenses** — add/edit/void, three split methods, live remainder bar, undo toast, detail + revision history.
7. **Balances, settle, payments** — group summary, suggestions, partial payments, receipt, void payment.
8. **History, activity, CSV export, states** — group history, cross-group activity, export, empty/loading/error.
9. **Desktop layout, a11y, review pass, README.**

## Acceptance criteria

- A signed-out user hitting any app route is redirected to `/entrar`; sign-out clears the session.
- A user sees only groups where they have an active membership; direct URL/RPC access to another group
  returns not-found/permission errors (verified with SQL tests under two different users).
- Group creator is owner; can create/revoke an invite link; another user accepting it becomes a member;
  an invited email or placeholder slot is claimed on acceptance.
- Expense with each split method saves shares that sum exactly to the amount; invalid sums block saving
  with a visible reason; mixed currency is rejected by server and DB.
- Editing creates a new revision; the detail screen shows what changed and who changed it; voiding removes
  it from balances but keeps it in history.
- Balances sum to zero; partial payments reduce the debt and show the remaining amount; the suggestion list
  settles all balances to zero when applied.
- Removing/leaving follows the rules above; historical records are never deleted.
- CSV export includes every expense revision state, voids and payments for the group.
- Empty, loading (skeleton), error and confirmation states exist for groups, group, expense and payment flows.
- `npm run test`, `npm run lint`, `npm run build` pass; installable manifest + SW registered in production.
