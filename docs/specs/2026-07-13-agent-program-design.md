# BiteExpress Agent Program — Design Spec

**Date:** 2026-07-13
**Status:** Approved by product owner (this session), pending implementation planning
**Repos:** `biteexpress-agents` (this repo, agent-facing PWA) + `dashboard.bite.express` (Laravel backend, AgentModule)

## Goal

Grassroots customer-acquisition program: trained and certified agents earn lifetime,
withdrawable commission on every delivered order placed by customers they sign up.
Agents work at their own pace; the program gives low-income earners a way to earn
with BiteExpress using only a smartphone.

## 1. Architecture

Two codebases, clean split:

- **`dashboard.bite.express` (Laravel)** — new **AgentModule** (same pattern as
  BiteExpense): migrations, models, commission engine, admin panel screens, and a
  versioned API under `/api/v1/agent/...`. All business and money logic lives here.
- **`biteexpress-agents` (Next.js PWA)** — agent-facing dashboard at
  **agents.bite.express**, deployed like biteexpress-web-app (Vercel), consuming
  only the API. Mobile-first, installable, branded from `branding_materials/`.

**Design consistency requirement:** the agent PWA's UI/UX must be visually
consistent with `biteexpress-web` (bite.express) and `biteexpress-web-app`
(app.bite.express) — same design language, component patterns, and brand palette.
Those two codebases are the style reference for every new screen.

**Process requirement:** every frontend build step in this project must load the
`frontend-design`, `impeccable`, and `ui-ux-pro-max` skills before UI code is
written.

## 2. Configuration: everything monetary is admin-tunable

All program parameters live in `business_settings`, editable from the admin panel
with no deploy. This is a hard requirement so payout generosity can track the
company's financial state at any time.

| Setting key (indicative) | Meaning |
|---|---|
| `agent_commission_rate` | % of order subtotal paid per delivered order (start 0.5–1%, finance approves) |
| `agent_commission_min_order` | Order-subtotal floor below which no commission accrues |
| `agent_withdraw_min` | Minimum withdrawable balance to request payout |
| `agent_quiz_pass_mark` | Quiz pass percentage (~75%) |
| `agent_quiz_question_count` | Questions drawn per attempt |
| `agent_challenge_tiers` | JSON array of tiers: `{name, signup_target, activation_target, bonus_amount}` — add/remove tiers or zero bonuses at will |
| `agent_program_active` | Master toggle |

No hardcoded naira value or percentage anywhere in code. Challenge tiers are
config, not seeded rows.

## 3. Data model (Laravel, tables prefixed `agent_`)

- **`agents`** — identity: name, phone (E.164), email, password, city/state,
  `status` (pending → approved → certified → suspended), `referral_code`
  (nullable until certified), `partner_lead_id` (link to application), KYC fields
  (passport photo, ID type + image, `kyc_status`), bank details (bank, account
  number, account name), balances (`earned_total`, `withdrawable_balance`,
  `pending_balance`).
- **`agent_referrals`** — one row per referred customer: `agent_id`, `user_id`
  (**unique** — a customer belongs to at most one agent, forever),
  `signup_channel` (`code` | `assisted`), `first_order_at`, `status`
  (registered → activated). Activation = first **delivered** order.
- **`agent_commissions`** — one row per commission event: `agent_id`,
  `referral_id`, `order_id` (**unique** — idempotent accrual), order amount, rate
  snapshot, commission amount, `status` (pending → confirmed → reversed), plus
  `type` (`order_commission` | `challenge_bonus` | `manual_bonus` | `reversal`).
  Financial immutability invariant (same as gamification): rows are never edited;
  clawbacks are new offsetting reversal entries.
- **`agent_training_videos`** — admin-managed: YouTube video ID, title, sort
  order, duration, active flag.
- **`agent_training_progress`** — per agent per video: watched flag + timestamp.
- **`agent_quiz_questions`** — admin-managed bank: question, 4 options, correct
  index, active flag.
- **`agent_quiz_attempts`** — score, pass/fail, questions served (JSON), timestamp.
- **`agent_challenge_progress`** — per agent per week: week key, signups count,
  activations count, tier achieved (snapshot of tier config at award time),
  bonus credited flag.
- **Withdrawals** — **decision (C gate prep, 2026-07-13):** a dedicated
  `agent_withdraw_requests` table with its own admin screen in the Agent Program
  cluster, NOT columns on the core `withdraw_requests` table. Rationale: the core
  table is vendor/DM-scoped with a `ZoneScope` global scope (agents have no zone)
  and BiteExpress precedent (BiteExpense) keeps custom modules off 6amTech core
  tables. Admin workflow is identical to rider/vendor requests: pending queue →
  approve/deny with note. `pending_balance` semantics: withdrawal-in-flight —
  requesting moves the amount withdrawable→pending; deny moves it back; approve
  clears it (paid out).

## 4. Agent lifecycle

1. **Apply** — existing bite.express/agents form (or same form embedded on
   agents.bite.express) → `partner_leads` (audience=agent). Already built and
   already emailing admins.
2. **Approve** — admin approves the lead in the admin panel → agent row created
   (status `approved`), lead marked converted via the existing
   `converted_to_type/id/at` columns, agent receives email/SMS link to set a
   password.
3. **Train** — dashboard shows only the training module: ordered YouTube embeds,
   each marked complete. Quiz unlocks when all videos are done.
4. **Certify** — quiz draws N random questions from the bank; configurable pass
   mark; unlimited retakes with a 1-hour cooldown. On pass: status `certified`,
   referral code generated (short, readable, e.g. `BX-JOSH4Z`), full dashboard
   unlocks.
5. **Earn** — signs up customers via code or assisted flow.
6. **Withdraw** — allowed once KYC is complete (photo + ID + bank details,
   admin-verified) **and** balance ≥ configured minimum. KYC gates *withdrawal*,
   not earning, so momentum stays high.

## 5. Referral capture + commission engine

**Two signup paths:**

- **Referral code** at customer registration (app, web app, later WhatsApp bot) —
  validated against certified agents, writes `agent_referrals`.
- **Assisted signup** from the agent dashboard: agent enters customer's phone →
  customer receives OTP → confirms → account created, tagged to the agent.
  Expected to drive most field onboarding (customer never types a code).

**Accrual rules (fraud-resistant by construction):**

- Order-lifecycle hook (observer-based): when an order by a referred customer
  reaches **delivered**, create a `confirmed` commission = configured % of the
  order amount, credit `withdrawable_balance`. Lifetime duration.
  **Decision (B1 gate, 2026-07-13):** the commission base is `orders.order_amount`
  — the order TOTAL as used by the gamification engine — not a separately-computed
  goods subtotal (this schema stores no such field). Finance must set
  `agent_commission_rate` knowing it applies to the total; the rate snapshot on
  each ledger row preserves auditability across rate changes.
- No commission below the configured order floor.
- Refund → reversal entry claws back the commission and debits the balance.
- One agent per customer forever (unique constraint).
- Agents cannot refer themselves (phone/email match check); referred phone must
  be unique in `users`.
- Velocity/abuse signals (same-device or same-address clusters) are **flagged for
  admin review, never auto-punished** (Phase 9 principle).
- First withdrawal per agent is always manually reviewed.
- Commission accrual is idempotent (`order_id` unique) and must never block the
  order flow — hook failures log loudly for reconciliation instead of throwing.

**Explicit scope limits:** commission on customer onboarding only — no commission
for onboarding vendors or riders.

## 6. Agent dashboard (PWA) screens

1. **Home** — balance, this-week stats (signups, activated, earnings), active
   challenge progress, referral code with WhatsApp-first share buttons.
2. **Training** — video list + quiz (pre-certification this is the whole app).
3. **My customers** — referred list: masked name, signup date, activated or not,
   lifetime orders, lifetime commission from each.
4. **Earnings** — commission ledger (per order), pending vs withdrawable.
5. **Withdraw** — request form + history with statuses.
6. **Challenges** — current week's target, progress, past results and bonuses.
7. **Profile/KYC** — photo, ID upload, bank details.
8. **Sign up a customer** — assisted-signup OTP flow.

## 7. Weekly challenges

- Window: Monday 00:00 – Sunday 23:59 Africa/Lagos.
- Tiers come entirely from the `agent_challenge_tiers` setting (name, signup
  target, activation target, cash bonus). Example shape only — actual values are
  set by admin: Bronze 10/5, Silver 20/10, Gold 30/15.
- Highest tier achieved pays (not cumulative), credited Monday morning by a
  scheduled command (`schedule:run` cron already live on srv02) as a
  `challenge_bonus` ledger entry.
- Mid-week nudge notifications ("You've onboarded 3 customers, 7 more for the
  Bronze bonus — resets Sunday") via PWA + email; copy admin-editable.
- High-performer bonuses (V1) = manual admin credits with a reason field, visible
  in the agent's ledger.

## 8. Admin panel additions

- Agent list (filter by status/city); agent detail (referrals, ledger, KYC
  review approve/reject, suspend).
- Training video + quiz question management.
- Challenge tier + program settings screens (business_settings backed).
- Withdrawals in the existing withdrawal request screen.
- Overview widget: agent count, signups this week, commission liability.

## 9. Phasing (each phase shippable, gated)

- **Phase A** — Backend module + lead approval + agent auth + training/quiz/
  certification + PWA shell. *Agent can apply, get approved, train, certify, see
  their code.*
- **Phase B** — Referral capture (code + assisted) + commission engine + earnings
  screens. *Agents earn.*
- **Phase C** — KYC + withdrawals end-to-end into admin panel. *Agents get paid.*
- **Phase D** — Weekly challenges + notifications + admin analytics. *Agents
  compete.*
- **Launch gate:** finance signs off commission rate and challenge amounts before
  the program toggle goes on.

## 10. Testing & verification

Laravel feature tests: accrual on delivery, no accrual below floor, clawback on
refund, one-agent-per-customer, self-referral block, quiz gating, withdrawal
threshold, idempotent accrual. PWA verified via `npm run build` + live curl (no
dev-server force-kill probes, per standing environment rule).

## 11. Stated program policies (not code)

- Agents must have a smartphone with internet, and install the BiteExpress user
  app, rider app, and use the WhatsApp ordering bot to understand the ecosystem —
  enforced through training content and quiz questions, not technical checks.
