# Agent Program Phase D1 (Backend) Implementation Plan — Weekly Challenges, Nudges, Analytics

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. Strict TDD as in A1/B1/C1.

**Goal:** The motivation layer: admin-configured weekly challenge tiers, Monday bonus awards through the conservation-safe ledger, mid-week nudge emails, a manual-bonus admin action, and the admin overview widget — plus the `agent_withdraw_min` settings-screen debt from C1.

**Architecture:** Extends the `Agent` domain in `dashboard.bite.express`. Challenge progress is COMPUTED from `agent_referrals` (no live counters to drift); only awards are stored (`agent_challenge_awards`, one row per agent per week, unique). Bonuses flow through the existing B1 ledger as `challenge_bonus` / `manual_bonus` rows via one shared conservation-safe credit method — the PWA's B2 ledger UI already renders these types. Weeks are Monday 00:00 → Sunday 23:59:59 **Africa/Lagos**.

**Tech Stack:** Laravel, MySQL, PHPUnit with `DatabaseTransactions`. The production crontab already runs `schedule:run` (installed 2026-05-18) — scheduled commands fire without new ops.

**Spec:** `docs/specs/2026-07-13-agent-program-design.md` §2 (`agent_challenge_tiers`), §7, §8.

## Global Constraints

- **Repo:** `C:\laragon\www\dashboard.bite.express`. Every commit bootable. Challenges double-gated: `agent_program_active` AND new `agent_challenges_active` (default `0`); tiers default `[]` so even a flipped flag pays nothing until admin defines tiers.
- **Balance invariant (unchanged):** balances change only inside a transaction that writes a ledger row, under `lockForUpdate`. Bonus credits are ledger inserts + `withdrawable_balance`/`earned_total` increments — `pending_balance` is NEVER touched by challenges (pending means withdrawal-in-flight only; C2 copy depends on this).
- Tier config = `agent_challenge_tiers` business_settings JSON: array of `{name, signup_target, activation_target, bonus_amount}`, ordered ascending by `signup_target`. Highest achieved tier pays, not cumulative. No hardcoded amounts anywhere.
- Award idempotency: unique `(agent_id, week_key)` in `agent_challenge_awards`; re-running the award command must be a no-op for already-awarded weeks.
- Week definition: `week_key` = ISO year-week of the Monday in Africa/Lagos (e.g. `2026-W29`). Signups = referrals `created_at` within the week (Lagos time); activations = those SAME referrals with `first_order_at` also within the week.
- Emails: best-effort try/catch like A1/C1. Nudges also respect a hard rule: only to agents with ≥1 signup this week and below the top tier, max one nudge email per agent per week.
- Never force-kill PHP; do NOT push or run anything on production (user ops step).

---

### Task 1: Award table + settings

**Files:**
- Create: `database/migrations/2026_07_13_130000_create_agent_challenge_awards_table.php`
- Modify: `app/Services/Agent/AgentSettings.php`, `database/seeders/AgentProgramSettingsSeeder.php`
- Test: extend `tests/Feature/Agent/AgentSettingsTest.php`

- [ ] **Step 1: Migration:**

```php
<?php
// database/migrations/2026_07_13_130000_create_agent_challenge_awards_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per agent per week, written only when a tier was achieved.
 * Tier fields are SNAPSHOTS of the config at award time — admin edits
 * to agent_challenge_tiers never rewrite history.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_challenge_awards', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->string('week_key', 10); // e.g. 2026-W29
            $table->string('tier_name', 60);
            $table->unsignedInteger('signup_target');
            $table->unsignedInteger('activation_target');
            $table->unsignedInteger('signups');
            $table->unsignedInteger('activations');
            $table->decimal('bonus_amount', 24, 2);
            $table->unsignedBigInteger('commission_id'); // the challenge_bonus ledger row
            $table->timestamps();

            $table->unique(['agent_id', 'week_key']);
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_challenge_awards');
    }
};
```

- [ ] **Step 2: Settings (failing test first):** `AgentSettings::challengesActive(): bool` (key `agent_challenges_active`, default `0`); `AgentSettings::challengeTiers(): array` (key `agent_challenge_tiers`, default `[]`; json_decode with invalid-JSON → `[]` + a loud `Log::error`, tested); returned tiers sorted ascending by `signup_target` regardless of stored order. Seeder adds both keys (`'0'`, `'[]'`).
- [ ] **Step 3:** PASS → Commit: `feat(agent): challenge awards table and tier settings (Phase D1)`.

### Task 2: Conservation-safe bonus credit

**Files:**
- Modify: `app/Services/Agent/AgentCommissionService.php`
- Test: extend `tests/Feature/Agent/AgentCommissionServiceTest.php`

**Interface produced:** `creditBonus(Agent $agent, float $amount, string $type, string $note, ?int $referralId = null): AgentCommission` — `$type` must be `TYPE_CHALLENGE_BONUS` or `TYPE_MANUAL_BONUS` (else `InvalidArgumentException`); `$amount` must be > 0. One transaction, `lockForUpdate` on the agent: ledger insert (order fields null) + `withdrawable_balance` and `earned_total` increments. `pending_balance` untouched.

- [ ] **Step 1: Failing tests** — credit creates ledger row + moves both balances; invalid type throws; zero/negative amount throws; conservation identity still holds after a bonus + a withdrawal sequence.
- [ ] **Step 2: Implement** (mirror the accrual transaction body). **Step 3:** PASS → Commit: `feat(agent): conservation-safe bonus credit`.

### Task 3: Challenge service — week math, progress, award

**Files:**
- Create: `app/Services/Agent/AgentChallengeService.php`
- Test: `tests/Feature/Agent/AgentChallengeServiceTest.php`

**Interfaces produced:**
- `currentWeekKey(): string` and `weekBounds(string $weekKey): array{start: Carbon, end: Carbon}` — Monday 00:00:00 to Sunday 23:59:59.999 in `Africa/Lagos`, returned as UTC instants for querying.
- `progressFor(Agent $agent, string $weekKey): array` → `{week_key, week_ends_at, signups, activations, tiers: [{name, signup_target, activation_target, bonus_amount, achieved}], achieved_tier: ?string}` — signups/activations per the week definition in Global Constraints; `achieved` = signups ≥ signup_target AND activations ≥ activation_target; `achieved_tier` = highest achieved.
- `awardWeek(string $weekKey): int` — for every certified agent with ≥1 signup that week: compute progress; if a tier is achieved and no `agent_challenge_awards` row exists for `(agent, week)`, credit `bonus_amount` via `creditBonus(..., TYPE_CHALLENGE_BONUS, "{tier_name} challenge — week {week_key}")` and insert the award row (config snapshot + the ledger row id) in the same transaction. Returns count of awards made. No-ops entirely when either flag is off or tiers are empty.

- [ ] **Step 1: Failing tests** — week bounds correct across the Lagos offset (a referral created Sunday 23:30 Lagos = Monday 00:30 UTC belongs to the earlier week — test this exact boundary); progress counts only same-week activations; highest tier wins (not cumulative); awardWeek pays once (second run returns 0, no duplicate ledger rows); flags/empty tiers → 0; award row snapshots tier values.
- [ ] **Step 2: Implement.** For testability, `Carbon::setTestNow()` drives "now" — no `sleep`/real-time dependence.
- [ ] **Step 3:** PASS → Commit: `feat(agent): weekly challenge engine`.

### Task 4: Scheduled commands — Monday awards + Thursday nudges

**Files:**
- Create: `app/Console/Commands/AgentAwardChallenges.php`, `app/Console/Commands/AgentChallengeNudges.php`
- Create: `app/Mail/AgentChallengeNudgeMail.php` + `resources/views/email-templates/agent-challenge-nudge.blade.php`
- Modify: the schedule registration (find where existing commands register — `app/Console/Kernel.php` or `routes/console.php` per this app's Laravel version; READ how existing scheduled commands are registered and match)
- Test: `tests/Feature/Agent/AgentChallengeCommandsTest.php`

- [ ] **Step 1: Failing tests** — `agents:award-challenges` awards LAST week (the just-ended one) and is idempotent when run twice; `agents:challenge-nudges` mails only agents with ≥1 signup, below top tier, not already nudged this week (add nullable `last_nudged_week` string column to `agents` via micro-migration `2026_07_13_130001`), and respects both flags.
- [ ] **Step 2: Implement.** Award command: `awardWeek(previousWeekKey)` + log summary. Nudge mail copy (plain, encouraging, from the spec's example): subject "You're {n} away from ₦{bonus}"; body states current signups, the nearest unachieved tier's targets and bonus, and that the week resets Sunday night. Schedule: awards Mondays 00:15 Lagos; nudges Thursdays 10:00 Lagos — both `->timezone('Africa/Lagos')`, both behind the flags check inside the command (not the scheduler).
- [ ] **Step 3:** PASS → Commit: `feat(agent): challenge award and nudge scheduled commands`.

### Task 5: Agent API — challenge status

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentChallengeController.php`
- Modify: `routes/api/v1/api.php`
- Test: `tests/Feature/Agent/AgentChallengeApiTest.php`

**Endpoint produced (`agent.api`):** `GET /challenge` →

```json
{
  "active": true,
  "current": { "week_key": "2026-W29", "week_ends_at": "…ISO…", "signups": 3,
               "activations": 1,
               "tiers": [{ "name": "Bronze", "signup_target": 10, "activation_target": 5,
                            "bonus_amount": 1000, "achieved": false }],
               "achieved_tier": null },
  "past_awards": [{ "week_key": "2026-W28", "tier_name": "Bronze", "bonus_amount": 1000,
                     "signups": 12, "activations": 6, "awarded_at": "…ISO…" }]
}
```

`active` = both flags AND tiers non-empty; when false, `current` is null (the PWA hides the feature entirely). `past_awards` newest-first, capped at 12.

- [ ] Failing test → implement → PASS → Commit: `feat(agent): challenge status API`.

### Task 6: Admin — tiers editor, withdraw-min debt, manual bonus, overview widget

**Files:**
- Modify: `app/Http/Controllers/Admin/Agent/AgentProgramSettingController.php` + `settings.blade.php` (challenge flag toggle, `agent_withdraw_min` field **[the C1 debt]**, and a tier-rows editor: dynamic rows of name/signup target/activation target/bonus — submitted as arrays, validated [each complete row: name ≤60 chars, integer targets ≥1, activation ≤ signup, bonus ≥ 0], stored as the JSON setting; server-side sort by signup_target on save)
- Modify: `app/Http/Controllers/Admin/Agent/AgentController.php` + `show.blade.php` (manual bonus form on agent detail: amount + required reason → `creditBonus(..., TYPE_MANUAL_BONUS, $reason)`; visible in the existing ledger card immediately)
- Create: overview widget — READ how existing admin dashboard widgets/cards are registered (`grep -rn "dashboard" routes/admin/routes.php` and the dashboard blade) and add an Agent Program card: certified agents count, signups this week, activated this week, commission liability (`SUM(withdrawable_balance + pending_balance)`), pending withdrawals count. If the dashboard is not cleanly extensible, put the card at the top of the agent list page instead and say so in the report.
- Test: `tests/Feature/Agent/AdminAgentBonusTest.php` (manual bonus credits through the service; tier editor round-trips valid config and rejects activation > signup)

- [ ] Failing tests → implement → PASS → Commit: `feat(agent): admin challenge tiers, withdraw-min field, manual bonus, overview`.

### Task 7: Verification pass

- [ ] Seeder run: both new keys present; full `php artisan test --filter=Agent` green (expect ~115+).
- [ ] End-to-end local: set tiers (e.g. Bronze 2/1 ₦500 for testability) via the admin editor → seed 2 signups + 1 same-week activation → run `agents:award-challenges` for that week → ledger shows the challenge_bonus row, balances move, award row snapshotted; run again → no-op. Trigger a nudge run and confirm one email + `last_nudged_week` set.
- [ ] Conservation audit repeated with a bonus in the mix.
- [ ] Do NOT push. Report: files per task, full Agent test output, deviations, and response shapes Phase D2 (PWA challenge UI) needs.

---

## Out of scope

Phase D2 (PWA challenge screen + home progress), push notifications / FCM (post-launch backlog — email only for now), abuse-signal analytics beyond the overview widget (the B1 velocity flags remain future work, noted in spec §5), pending-from-unconfirmed-commissions (NOT introduced; pending stays withdrawal-only, per C2's explicit dependency).
