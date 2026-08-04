# Agent Program Phase F1 (Backend) Implementation Plan: Trust Engine

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. The established quality floor for the dashboard repo binds verbatim. Verify, don't assume: trace every integration point named here before editing it.

**Goal:** Make the money feel real. Agents get a push notification the moment a delivered order credits commission (and for every other money or status event), typo-proof bank details via account-name resolution, and a payout process with a visible SLA and a fast-track lane for trusted agents.

**Repo:** `C:\laragon\www\dashboard.bite.express` (Laravel). Push-to-main auto-deploys srv02 in about 1 minute and `php artisan migrate --force` runs automatically on deploy, so every commit must leave the app bootable and every migration must be standalone-safe (guarded, additive, no data assumptions).

## Global constraints

- ALL new monetary/tunable parameters are `business_settings` keys, seeded by migration or seeder, editable in the existing admin agent settings page. Never hardcoded.
- All new flags default OFF / 0. The feature must be inert in production until deliberately activated.
- Push sends NEVER run inside a money transaction and NEVER throw into the money path. Queued jobs only, dispatched after the service call returns (plain `dispatch()` to the `notifications` queue; do not use `afterResponse()`/`dispatchNonCriticalJob`, unreliable here per project history).
- Verification-only tooling (probes, decoders, scratch scripts) lives in an isolated scratch directory outside the repo, never in composer.json or the working tree. Final report must include a dependency-diff and `git status` cleanliness check.
- No em-dashes in any agent-facing copy.
- Commit per task; keep the suite green (`php artisan test --filter=Agent` at minimum per task, full agent suite at the end).

## Frozen decisions

- **Channel is web push (VAPID), not WhatsApp.** Library: `minishlink/web-push`. No WhatsApp interim variant (template approval overhead + per-message cost for high-frequency events).
- **Notified events (all of them, including the bad news):** order commission credited, challenge bonus credited, manual bonus credited, commission reversed (refund clawback), withdrawal approved, withdrawal denied (with reason), KYC verified, KYC rejected. Transparency on reversals and denials is deliberate: hidden deductions are how agent networks lose trust.
- **Copy shape:** short, first person, money first. Examples (adjust wording to lang-file conventions): "You earned ₦450" / "Ada's order was delivered. It's in your balance." Customer FIRST NAME only, never order contents or totals.
- **Auto-approve does NOT auto-pay.** Approval stays a human action because the bank transfer is a human action; marking paid without money moving would be a lie. "Express" is a computed fast-track flag that sorts and badges the admin queue and shows the agent an SLA. Nothing in this phase moves money programmatically.
- **Express eligibility (computed, never stored):** KYC verified AND approved payout count >= `agent_express_min_clean_payouts` AND request amount <= `agent_express_withdraw_max`. `agent_express_withdraw_max` seeded 0, which disables the lane until finance sets it.
- **New settings keys (seed values):** `agent_push_enabled` (0), `agent_payout_sla_hours` (24), `agent_express_withdraw_max` (0), `agent_express_min_clean_payouts` (3), `agent_projection_avg_monthly_per_active` (0 = PWA hides the illustrative fallback).

---

### Task 0: Composer dependency preflight (GATE)

- [ ] Determine whether the srv02 deploy path installs composer dependencies: read `~/bin/deploy.sh` on srv02 (ask the operator to paste it if you lack SSH) or check with the operator directly.
- [ ] If deploys do NOT run `composer install`: STOP after committing the composer.json/lock change alone, and have the operator run `composer install --no-dev` on srv02 as the `biteexpress` user (NEVER root, standing rule) before you push any code that imports the package. Verify the site still responds afterward.
- [ ] Add `minishlink/web-push`. Generate VAPID keys locally (one time); keys go in srv02 `.env` (`AGENT_VAPID_PUBLIC_KEY`, `AGENT_VAPID_PRIVATE_KEY`, `AGENT_VAPID_SUBJECT=mailto:office@bite.express`) and local `.env`. Keys are NEVER committed.
- [ ] Commit: `chore: add web-push dependency for agent notifications`.

### Task 1: Subscription storage + push service

**Files:**
- Create: migration `agent_push_subscriptions` (id, agent_id indexed, endpoint unique(hash if too long for index), p256dh, auth, user_agent nullable, last_success_at nullable, timestamps). Guarded/standalone-safe.
- Create: `app/Models/AgentPushSubscription.php`, `app/Services/Agent/AgentPushService.php`, `app/Jobs/SendAgentPushJob.php`
- Modify: `config/` (new `agent_push.php` or extend existing agent config) for VAPID env mapping.

**Steps:**

- [ ] `AgentPushService::notify(int $agentId, string $event, string $title, string $body, ?string $url)`: no-op instantly when `agent_push_enabled` is off; otherwise dispatch `SendAgentPushJob` to the `notifications` queue.
- [ ] `SendAgentPushJob`: loads the agent's subscriptions, sends via WebPush with the VAPID keys, TTL ~24h. On 404/410 responses, delete the dead subscription. On other failures, log and swallow (never retry-storm, never affect anything else). Stamp `last_success_at` on success.
- [ ] API endpoints (agent auth middleware, same group as existing agent routes): `GET /agent/push/config` returns `{enabled, public_key}`; `POST /agent/push/subscribe` upserts by endpoint; `DELETE /agent/push/subscribe` removes by endpoint.
- [ ] Tests: subscribe/unsubscribe round-trip, flag-off short-circuit (no job dispatched), dead-subscription pruning (fake the sender).
- [ ] Commit: `feat: agent web-push foundation`.

### Task 2: Wire the money and status events

**Files:**
- Modify: `app/Observers/OrderObserver.php` (the agent-commission transition block), `app/Services/Agent/AgentCommissionService.php` call sites ONLY if needed (prefer hooking at the observer/controller layer around the service, keep the service pure), `app/Services/Agent/AgentWithdrawService.php` (approve/deny), the KYC decision path (trace it: the admin action that flips KYC to verified/rejected), `app/Services/Agent/AgentChallengeService.php` award loop, `Admin\Agent\AgentController::bonus`.
- Create: agent-facing copy in the lang file used by the agent API layer (trace the existing convention).

**Steps:**

- [ ] After `handleOrderDelivered` returns a commission row: notify "You earned ₦{amount}" / "{customer first name}'s order was delivered. It's in your balance." Resolve first name via the referral's user; fall back to "A customer" if missing.
- [ ] After `handleOrderRefunded` returns a reversal: notify "₦{amount} was reversed" / "An order was refunded, so its commission came back out. Your balance is updated."
- [ ] Challenge award loop (Monday command): one notify per award, "₦{amount} challenge bonus" / "You hit the {tier} tier last week. It's in your balance."
- [ ] Manual bonus: "₦{amount} bonus" / note text (already admin-written; it is agent-facing, keep as body).
- [ ] Withdraw approve: "Your ₦{amount} withdrawal was approved" / "It's on the way to your {bank} account." Deny: "Your withdrawal was returned" / "{reason}. The money is back in your balance."
- [ ] KYC verified: "You're verified" / "Withdrawals are now unlocked." Rejected: "KYC needs another look" / "{reason}. You can resubmit from your profile."
- [ ] Every hook is wrapped so a push failure can never break the underlying transition (same discipline as WhatsappOrderObserver).
- [ ] Tests: delivered order dispatches push job with correct amount; refund dispatches reversal notice; withdraw approve/deny and KYC decisions dispatch; flag off = zero dispatches anywhere.
- [ ] Commit: `feat: push notifications for agent money and status events`.

### Task 3: Bank list + account-name resolution

**Files:**
- Create: `app/Services/Agent/BankResolutionService.php`
- Modify: agent KYC controller + request validation; migration adding nullable `bank_code` and `account_name_resolved` (boolean default false) to wherever bank fields live (trace: C1 put them on the agent, snapshotted onto withdraw requests; follow that).

**Steps:**

- [ ] `BankResolutionService`: `banks()` proxies Paystack `GET /bank?country=nigeria&currency=NGN`, cached 24h; `resolve(bank_code, account_number)` proxies Paystack `GET /bank/resolve`. Uses the existing Paystack secret source (trace how VirtualAccountTrait reads it; reuse, do not duplicate config). Paystack inactive or erroring: `banks()` returns an empty list, `resolve()` returns null. Both degrade, never 500.
- [ ] Endpoints (agent auth): `GET /agent/banks`; `POST /agent/kyc/resolve-account` rate-limited (10/min per agent).
- [ ] KYC submit: when bank_code present and resolution succeeds, store the RESOLVED account name (not the typed one) and `account_name_resolved=true`. When resolution unavailable, accept typed name with `account_name_resolved=false` (today's behavior, flagged for admin attention).
- [ ] Admin KYC review view: show a "name verified via bank" check or "unverified name" warning per that flag.
- [ ] Tests: resolve happy path (fake HTTP), degraded path stores the typed name with `account_name_resolved=false`, rate limit enforced, snapshot-on-withdraw still carries the resolved name.
- [ ] Commit: `feat: bank account name resolution for agent KYC`.

### Task 4: Express lane + SLA surfacing + projection data

**Files:**
- Modify: `app/Services/Agent/AgentWithdrawService.php`, agent earnings/withdraw API controllers, admin withdraw-requests list view + controller, admin agent settings page (3 new fields), settings seeder.

**Steps:**

- [ ] `AgentWithdrawService::isExpressEligible(Agent $agent, float $amount): bool` per the frozen rule. Computed at read time, never stored.
- [ ] Agent API: the existing eligibility object (GET /earnings) gains `payout_sla_hours`; the withdraw request rows/creation response gain `express` (bool). No schema change.
- [ ] Admin withdraw queue: express-eligible pending requests sort first with a badge; non-eligible unchanged. Approve/deny actions untouched.
- [ ] Admin agent settings page: fields for `agent_payout_sla_hours`, `agent_express_withdraw_max`, `agent_express_min_clean_payouts`, `agent_projection_avg_monthly_per_active` with sensible validation.
- [ ] Projection data for the PWA: GET /earnings gains `projection: {window_days: 30, order_commission_30d, active_customers, illustrative_avg_monthly_per_active}` (last value straight from settings; 0 means unset). Computed from the commission ledger (TYPE_ORDER, confirmed, last 30 days) and activated referrals. Read-only, no counters.
- [ ] Tests: express eligibility matrix (kyc/count/amount boundaries, max=0 disables), projection math from seeded ledger rows, settings seeded.
- [ ] Commit: `feat: express payout lane, SLA, and earnings projection data`.

### Task 5: Ship prep

- [ ] Full agent suite green; run the withdraw and commission suites explicitly and paste counts.
- [ ] Dependency-diff + `git status` cleanliness check (composer.json shows exactly one new package; tree clean).
- [ ] Push. Confirm deploy lands and srv02 responds (the operator will run the composer step from Task 0 if required).
- [ ] Report for the CTO gate: commits, test counts, the deploy.sh composer finding, event-to-copy table as implemented, deviations with reasons. Note explicitly: `agent_push_enabled` remains 0; nothing is live for agents yet.

---

## Out of scope

Programmatic payouts (Paystack Transfers), WhatsApp notifications to agents, notification preference UI, quiet hours, the PWA side (Phase F2), any change to commission math or withdraw state machine semantics.
