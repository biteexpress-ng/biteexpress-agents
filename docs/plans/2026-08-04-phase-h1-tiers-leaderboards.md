# Agent Program Phase H1 Implementation Plan: Tiers + City Leaderboards

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. Cross-repo phase: Part A dashboard (Laravel), Part B PWA. For Part B, read `PRODUCT.md` and `DESIGN.md` first and load `frontend-design`, `impeccable`, and `ui-ux-pro-max`. Both quality floors bind verbatim. Verify, don't assume: trace every integration point before editing. Full agent suite runs need `php -d memory_limit=2G vendor/bin/phpunit --filter Agent`.

**Goal:** Status that reinforces quality. Agents climb Bronze/Silver/Gold tiers by growing their count of customers who actually order, and compete on a weekly leaderboard scoped to their own city. Tiers carry one concrete perk (a higher fast-track withdrawal ceiling) plus visible standing; leaderboards make the weekly grind social.

**Why this shape:** status keyed to ACTIVE customers (not signups) makes the prestige system reinforce the same behavior the money system pays for, and city scoping keeps competition motivating (a Zaria agent racing Lagos is demotivated, racing Zaria is a contest).

## Global constraints

- All tunables are `business_settings` keys seeded BY MIGRATION: `agent_tiers` (JSON array, seed `[]`), `agent_leaderboard_enabled` (seed `0`). Empty tiers = the tier system is invisible everywhere; leaderboard flag 0 = endpoint refuses and the PWA renders nothing. Both fail closed because finance has not set tier values and leaderboards expose cross-agent data.
- **Never display an unapproved perk** (loyalty-multiplier lesson): structurally satisfied because tiers only exist once the admin creates them, but copy must also never promise future perks.
- Computed on read (challenge-engine pattern): no stored tier column, no leaderboard snapshot tables. Reuse `AgentChallengeService`'s week helpers (Mon-Sun Africa/Lagos, ISO week_key); do not duplicate week math.
- **Leaderboard privacy floor:** first name + tier name + this week's signup/activation counts, nothing else. No earnings, no full names, no phone, no city other than the viewer's own. The viewer's own row is flagged `is_you`, never matched by name client-side.
- Push sends via the F1 `AgentPushService` only, best-effort, never inside a money transaction.
- Migrations standalone-safe (auto-run on deploy). Pre-seed any new admin `translate()` keys. Sidebar/settings Blade edits follow the shared-partial rule; note view:clear if any Blade is touched.
- No em-dashes in copy. No new dependencies in either repo. Verification tooling outside both repos; report includes dependency-diff + git status for both.
- Dashboard: agent suite green per task, full suite at the end. PWA: `npm run build` per task; `taskkill /F /T /PID` only. Commit per task; push both repos at the end (or hand commits to the operator on credential block, per precedent).

## Frozen decisions

- **Tier metric = lifetime count of ACTIVATED referrals** (customers with at least one delivered order). Signups never count. Monotonic, so no demotion mechanics exist and none should be implied.
- **Tier config shape:** `agent_tiers` = array of `{name, threshold, express_withdraw_max}` sorted ascending by threshold. `threshold` = activated count required. `express_withdraw_max` optional (0 or absent = inherit the global `agent_express_withdraw_max`); when set and larger, it replaces the global ceiling for that tier's agents in `isExpressEligible`. Admin editor validates: ascending unique thresholds >= 1, non-empty unique names, max 6 tiers.
- **Tier is computed**, exposed as `tier: {name, index, activated_count, next: {name, threshold, remaining} | null} | null` on the profile and earnings payloads (null when config empty or below the first threshold).
- **Tier-up push** fires when an activation crosses a threshold: "You're now a {name} agent" / "{activated_count} of your customers now order on BiteExpress." Detection happens where activation happens; if the clean seam requires `activateReferralIfFirst` to report whether it newly activated, that small refactor is in scope. Dispatch after the transaction, best-effort. Config edits re-tiering agents silently is accepted (no push on config change).
- **Leaderboard scope = `agents.city_slug`.** Agents with a null city are excluded and the PWA shows nothing for them (support can set city; no self-serve city edit in this phase). Display name for the board comes from `city_state`/slug humanized.
- **Week + ranking:** current challenge week. Rank by this week's activations DESC, then signups DESC, then agent id ASC (stable). Top 10 rows plus the viewer's own row always (rank computed even when outside top 10). `last_week_top`: up to 3 rows, same shape, previous week.
- **API:** `GET /agent/leaderboard` -> flag off: `{enabled: false}` only. On: `{enabled, city_label, week_key, week_ends_at, rows: [{rank, first_name, tier_name, signups, activations, is_you}], you: {rank, signups, activations} | null, last_week_top: [...]}`. `you` null only when the agent has no city. Server-side cache per city+week up to 5 minutes is allowed.
- **PWA surfaces:** the `/challenges` screen hosts the leaderboard section ("Your city this week") below the challenge content; its redirect-home condition loosens to "challenge inactive AND leaderboard disabled". When only the leaderboard is on, home shows one compact entry card to /challenges. Tier badge renders on the profile header and next to the home greeting; the E1 poster/status renderer gains an optional tier mark (small, only when tier non-null; artifact copy otherwise unchanged).

---

## Part A: backend (dashboard repo)

### Task A1: Tier engine + settings

- [ ] Guarded settings-seed migration (`agent_tiers` `[]`, `agent_leaderboard_enabled` `0`) + `AgentProgramSettingsSeeder` entries + `AgentSettings` accessors (tiers parsed/validated defensively: malformed JSON = tiers off, log loudly).
- [ ] `AgentTierService`: `tiersConfigured()`, `tierFor(int $activatedCount): ?array`, `nextTierAfter(int $count): ?array`. Pure functions over the config.
- [ ] Admin agent settings page: tier rows editor (name, threshold, express max) with the frozen validation, following the challenge-tier editor idiom. Pre-seed lang keys.
- [ ] Expose `tier` on the profile and earnings API payloads per the frozen shape.
- [ ] Tests: config validation (rejects descending/duplicate), tierFor boundaries (count == threshold is IN the tier), malformed JSON = off, payload shape with and without config.
- [ ] Commit: `feat: agent tier engine and admin tier editor`.

### Task A2: Tier perk + tier-up push

- [ ] `AgentWithdrawService::isExpressEligible`: tier's `express_withdraw_max` (when > 0) replaces the global ceiling for that agent. Global rules (KYC + clean payouts) unchanged.
- [ ] Tier-up detection at the activation site per the frozen decision; push via `AgentPushService` after commit, best-effort, fires once per crossing (activation increments by exactly 1, so crossing = new count equals a threshold).
- [ ] Tests: express ceiling override matrix (tier > global, tier absent, tiers off), tier-up push fires exactly at the threshold and not on the next activation, below-floor activation (no commission row) still fires tier-up, push failure never breaks delivery handling.
- [ ] Commit: `feat: tier express ceiling and tier-up notification`.

### Task A3: Leaderboard endpoint

- [ ] `GET /agent/leaderboard` per the frozen API. Week math reused from the challenge service. One query for the city's weekly counts (agents joined to their week's referrals, grouped), ranked in SQL or collection per the frozen order; viewer's row computed even off-board. `last_week_top` same mechanics, previous week_key.
- [ ] Flag off returns `{enabled: false}` with 200 (PWA degrade stays trivial). Null-city agent: `enabled: true, you: null, rows: []` short-circuit (no city leak).
- [ ] Tests: city isolation (two cities never mix), ranking order incl. tiebreaks, is_you flagged, off-board viewer gets correct rank, week boundary respects Lagos weeks (reuse the challenge suite's boundary approach), flag off shape, null-city shape, privacy shape (exactly the frozen fields, nothing more).
- [ ] Full agent suite green. Commit: `feat: city-scoped weekly leaderboard endpoint`.

## Part B: PWA (agents repo)

### Task B1: Tier badge surfaces

- [ ] Types: `tier` on profile/earnings payloads (optional, degrade = nothing renders).
- [ ] `TierBadge` component (quiet chip, tier name, no icon invention beyond the app's idiom). Renders on profile header and beside the home greeting. Below-first-threshold and tiers-off render nothing.
- [ ] Earnings screen: when `tier.next` exists, one quiet line "{remaining} more active customers to {next name}" near the projector (progress framing, not pressure).
- [ ] E1 renderer: optional tier mark on poster + status image (small text mark near the agent line, e.g. "Gold agent"); artifact-card passes it; absent tier = byte-identical output to today.
- [ ] Verify: `npm run build`. Commit: `feat: agent tier badges`.

### Task B2: Leaderboard on the challenges screen

- [ ] `GET /agent/leaderboard` client + types (all optional fields, degrade invisible).
- [ ] `/challenges` redirect condition: home only when challenge inactive AND leaderboard disabled. Screen renders whichever sections are live.
- [ ] Leaderboard section: "Your city this week" + city label + week-ends line (reuse the challenge week-header idiom); top-10 rows (rank, first name, tier chip, "{activations} first orders · {signups} signups"), `is_you` row highlighted; when viewer is off-board, their pinned row renders beneath with real rank; `last_week_top` as a quiet "Last week" strip. Empty rows (nobody active yet): encouraging one-liner, no fake rows.
- [ ] Home: when leaderboard on and challenge strip absent, one compact card ("Your city this week → /challenges"); when the challenge strip already renders, no extra card.
- [ ] A11y: rows are a proper list, is_you announced, 360px clean.
- [ ] Verify: `npm run build`. Commit: `feat: city leaderboard on challenges screen`.

### Task B3: Seeded live pass + ship prep (both repos)

- [ ] Seeds: two cities, 4+ agents with varied weekly signups/activations, tier config Bronze 2 / Silver 5 with an express max on Silver, viewer both on-board and off-board variants, one null-city agent.
- [ ] Live pass (production build, real local backend): tier badge on profile/home; tier line near projector; tier mark on both artifacts (and absent-tier artifacts unchanged); tier-up push received on the crossing activation (flag on locally); leaderboard renders correct ranks/is_you/last-week, city isolation confirmed with both viewer accounts, null-city agent sees no section, flag off hides everything; /challenges reachable with challenges off + leaderboard on.
- [ ] Express override live-checked: Silver agent's request above global max but under tier max comes back `express: true`.
- [ ] Both repos: suites/build green, status clean, no dependency changes. Push dashboard first, then PWA (degrade covers the window either way).
- [ ] Report: commits per repo, test counts, screenshots (badges, artifacts with/without mark, leaderboard states, tier-up notification), live-pass results incl. city isolation, deviations with reasons.

---

## Out of scope

Demotions or activity-windowed tiers, per-tier perks beyond the express ceiling (early tool access has no concrete tool yet), national or multi-city boards, historical leaderboard archives, prizes for leaderboard position (leaderboards are status; money stays in challenges), agent self-serve city editing, admin leaderboard views.
