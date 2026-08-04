# Agent Program Phase G1 Implementation Plan: Quiet-Customer Nudges

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. This phase spans BOTH repos: Part A in the dashboard (Laravel), Part B in the PWA. For Part B, read `PRODUCT.md` and `DESIGN.md` first and load `frontend-design`, `impeccable`, and `ui-ux-pro-max`. Both repos' established quality floors bind verbatim. Verify, don't assume: trace every integration point before editing.

**Goal:** Turn the agent's customer list into a worklist. Two segments surface per agent: customers who signed up but never ordered (the activation gap) and customers who used to order but stopped (the retention gap). The agent follows up personally, marks the customer contacted, and the customer leaves the list for a cooldown.

**Why it exists:** agents earn lifetime commission, so their incentive to re-engage is already perfect; they just cannot see who went quiet. This feature closes that loop and is what makes the lifetime-commission liability pay for itself as a distributed retention team.

## Global constraints

- **Privacy floor (hard):** the existing customers endpoint already masks names (`name_masked`) and exposes no phone. This phase adds NOTHING beyond one date (`last_order_at`) and computed status fields. No phone numbers, no order contents, no customer spend. The WhatsApp action is the share sheet (`wa.me/?text=`), never a deep link to the customer's number.
- **Outreach is human-only.** The app never messages a customer. It hands the agent the E1 follow-up template and gets out of the way.
- All tunables are `business_settings` keys seeded BY MIGRATION (deploys run migrate, not db:seed; F1 lesson): `agent_quiet_customer_days` (21), `agent_nudge_contact_cooldown_days` (14).
- Computed on read from `agent_referrals` + `orders`, challenge-engine pattern. No counters, no cached segment state.
- Migrations standalone-safe (guarded, additive, no FKs on the events table, per WA-5 precedent) because deploys auto-run them.
- Push-to-main deploys the dashboard in ~1 min; the PWA deploys on push via Vercel. The PWA must degrade invisibly when the new fields are absent, so deploy order can never break the customers screen.
- No em-dashes in any copy. Verification tooling stays outside both repos; report includes dependency-diff (no new packages either repo) + git status cleanliness for both.
- Dashboard: `php artisan test --filter=Agent` green per task, full agent suite at the end. PWA: `npm run build` per task; dev servers via `taskkill /F /T /PID` only. Commit per task in each repo; push both at the end.

## Frozen decisions

- **No new feature flag.** This is a read-only surface over an already-live program, gated by agent auth and the program master flag like the rest of the agent API. The PWA's absent-field degrade covers the deploy window. (Deviation from the flags-default-off habit, made deliberately: there is no liability and no send path here.)
- **Segments:** `never_ordered` = referral status registered (not activated). `quiet` = activated AND latest DELIVERED order older than `agent_quiet_customer_days` days. "Delivered" reuses the commission engine's status constant; do not invent a second definition.
- **Cooldown:** a customer whose latest contact event is younger than `agent_nudge_contact_cooldown_days` gets `attention: null` and is excluded from the attention count and filter. A nagged customer is worse than a quiet one.
- **Measurement from day one:** contact events are append-only rows. No dashboard in this phase; the table exists so "did nudged customers reorder within 7 days" is answerable later.
- **API shape (extend, don't fork):** the existing customers list keeps one shape everywhere; attention is a computed annotation plus a server-side filter, not a parallel endpoint.

## API contract (Part A implements, Part B consumes)

- `ReferredCustomer` rows gain: `last_order_at` (ISO or null; latest delivered order), `attention` (`"never_ordered" | "quiet" | null`), `contacted_at` (ISO or null; latest contact event).
- `stats` gains `attention_count` (both segments, cooldown respected).
- Customers list accepts `filter=attention` (only rows with non-null attention, both segments, normal pagination).
- `POST /agent/customers/{referralId}/contacted`: appends a contact event for the authed agent's own referral (404 on anyone else's), returns the updated row. Repeat call within cooldown appends nothing and returns the row unchanged.

---

## Part A: backend (dashboard repo, `C:\laragon\www\dashboard.bite.express`)

### Task A1: Settings + events table

- [x] Guarded migration: `agent_customer_contact_events` (id, agent_id indexed, referral_id indexed, contacted_at, timestamps; NO foreign keys). Model with `$casts`.
- [x] Guarded settings-seed migration for the two keys (insert-if-missing, `down()` removes). Also add both to `AgentProgramSettingsSeeder` for fresh installs, and to the admin agent settings page with validation (integer, min 1).
- [x] `AgentSettings` accessors for both keys.
- [x] Tests: settings seeded, admin page saves them.
- [x] Commit: `feat: nudge settings and contact event storage`.

### Task A2: Attention computation on the customers list

- [x] Trace the existing agent customers list controller/query (B2). Extend it: per-page annotation of `last_order_at` (max delivered-order timestamp per referred user, single query for the page's user_ids, not N+1), `contacted_at` (max event per referral, same batching), and `attention` per the frozen segment + cooldown rules. `stats.attention_count` computed with the same rules across the agent's whole book (one count query, not a page scan).
- [x] `filter=attention` query param: only non-null-attention rows, ordered never_ordered first then quiet, then by joined_at desc. Unknown filter values ignored (full list).
- [x] Tests: never-ordered flagged; quiet flagged at the boundary (N days exactly = not quiet, N+1 = quiet); recent delivered order = null; cooldown suppresses attention and count; filter returns only flagged rows; another agent's book never leaks into count or filter.
- [x] Commit: `feat: attention segments on the agent customers list`.

### Task A3: Mark-contacted endpoint

- [x] Route + controller action per the contract. Ownership check (referral belongs to authed agent), append event, cooldown no-op on repeat, returns the updated row shape.
- [x] Tests: event lands, repeat within cooldown appends nothing, foreign referral 404s, response row shows `attention: null` immediately after contact.
- [x] Full agent suite green. Commit: `feat: mark-contacted endpoint with cooldown`.

## Part B: PWA (agents repo, `C:\laragon\www\biteexpress-agents`)

### Task B1: Needs-attention section on the customers screen

**Files:** modify `src/app/(app)/customers/page.tsx`, API types/client; create `src/components/customers/attention-section.tsx`, `src/components/customers/attention-row.tsx`.

- [x] Types gain the three new row fields + `attention_count`; all optional so old backend payloads parse (degrade = section absent, zero layout impact).
- [x] Section renders above the full list only when the attention filter returns rows: heading "Needs a visit", never-ordered group first ("Signed up, no orders yet"), quiet group second ("Gone quiet").
- [x] `AttentionRow`: masked name, one honest context line computed from exposed dates ("Joined 3 weeks ago, no orders yet" / "Last order 5 weeks ago"), coarse wording only (weeks/months, never exact days), and two actions in the app's idiom: primary "WhatsApp" (share sheet via `wa.me/?text=` with the E1 follow-up template resolved with the agent's code, reusing `src/lib/marketing/templates.ts`, never a new copy source), secondary "Mark contacted".
- [x] Mark contacted: optimistic removal from the section with a quiet undo-window toast per app idiom (or immediate removal + silent revert on API failure if the app has no toast idiom; match what exists), POST to the endpoint.
- [x] Empty attention state inside the section area renders nothing at all (the plain list stands alone, no congratulatory card).
- [x] Verify: `npm run build`. Commit: `feat: needs-attention worklist on customers`.

### Task B2: Home surface

- [x] The customers stat row on home gains "Â· {n} need a visit" (from `attention_count`, only when > 0) linking to the customers screen. Absent field = nothing renders.
- [x] Verify: `npm run build`. Commit: `feat: attention count on home`.

### Task B3: Seeded live pass + ship prep (both repos)

- [x] Seed one agent with: a never-ordered referral, a quiet one (delivered order older than N), a healthy one (recent delivered order), and a contacted-within-cooldown quiet one. Live pass against the real local backend (production build): section shows exactly two rows in the right groups with sane context lines; home chip says 2; WhatsApp action opens share sheet with the follow-up template + code; Mark contacted removes the row, DB event lands, chip decrements, repeat POST is a no-op; healthy + cooldown customers absent everywhere; old-payload degrade simulated (strip fields) renders the plain customers screen untouched.
- [x] A11y spot-pass: rows and actions have accessible names, context lines are real text, 360px no-overflow.
- [x] Both repos: suites/build green, git status clean, no dependency changes. Push dashboard first, then PWA.
- [x] Report for the CTO gate: commits per repo, test counts, screenshots (section both groups, home chip, share sheet, post-contact state), live-pass results, boundary-test evidence, deviations with reasons.

---

## Out of scope

Push notifications for nudges (weekly digest is a later idea), any admin dashboard over contact events, per-customer notes/tags (CRM creep), changes to the E1 template copy, exact-day recency wording, exposing anything the customers endpoint does not already expose plus `last_order_at`.
