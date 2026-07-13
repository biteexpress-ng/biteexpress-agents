# BiteExpress Agent Program — Go-Live Runbook

Build complete 2026-07-13: Phases A1, A2, B1, B2, C1, C2, D1, D2 all gated and passed.
Everything ships dark: `agent_program_active=0`, `agent_commission_rate=0`,
`agent_challenges_active=0`, `agent_challenge_tiers=[]`. This runbook is the ordered
path from dark to live. Do the steps in order; each has a verification.

## 0. Pre-deploy — the scheduler hotfix (BLOCKING, unrelated revenue fix first)

The D1 gate uncovered that `app/Console/Kernel.php::schedule()` is dead under this
Laravel 12 bootstrap: five production schedules (including hourly
`bitepass:process-renewals`) have never fired.

- [ ] Confirm the hotfix commit exists (all five commands migrated to
      `bootstrap/app.php ->withSchedule()`).
- [ ] Local verify: `php artisan schedule:list` shows **7** entries (5 migrated + 2 agent).
- [ ] Review the builder's backlog assessment for `bitepass:process-renewals` — its
      first real run may process months of pending renewals. Decide deliberately how
      to handle the backlog BEFORE deploying; observe the first run on srv02.

## 1. Deploy the backend (dashboard.bite.express)

- [ ] `git push origin main` (CI/CD deploys to srv02, ~1 min).
- [ ] SSH srv02 as biteexpress:
      `php artisan migrate --force`
      `php artisan db:seed --class=AgentProgramSettingsSeeder --force`
      Log both in `~/.deploy-history.log`.
- [ ] Verify on srv02: `php artisan schedule:list` shows all 7 entries;
      `curl -s https://dashboard.bite.express/api/v1/agent/me -H "Authorization: Bearer x"`
      returns 401 JSON (not 500);
      admin panel → Agent Program pages open (agents / training / quiz / withdrawals /
      settings).

## 2. Deploy the PWA (agents.bite.express)

- [ ] Vercel: import `biteexpress-ng/biteexpress-agents`, framework Next.js, env
      `NEXT_PUBLIC_API_BASE_URL=https://dashboard.bite.express` (production).
- [ ] DNS: `agents.bite.express` → Vercel per the README (same pattern as the other
      BiteExpress Vercel apps).
- [ ] Verify: login page renders with brand styling over HTTPS; PWA install prompt
      available on Android Chrome; `robots` noindex present (view-source metadata).

## 3. Load the content

- [ ] Admin → Agent Program → Training: upload the YouTube training videos in order
      (full ecosystem coverage: customer app, rider app, vendor side, WhatsApp bot,
      website ordering).
- [ ] Admin → Agent Program → Quiz: enter the question bank. Minimum = the configured
      `agent_quiz_question_count` (10) ACTIVE questions or the quiz cannot start;
      recommended 25–30 so the random draw varies between attempts.

## 4. Finance sign-off (the standing launch gate)

Finance sets, in Admin → Agent Program → Program settings:

- [ ] `agent_commission_rate` — **percent of the ORDER TOTAL** (`orders.order_amount`,
      includes delivery/fees; spec decision at the B1 gate). Model against real order
      totals before choosing.
- [ ] `agent_withdraw_min` — confirm ₦5,000 or adjust.
- [ ] Challenge tiers — e.g. Bronze 10/5 ₦1,000 · Silver 20/10 ₦2,500 · Gold 30/15
      ₦5,000 (targets: weekly signups / same-week first delivered orders; highest
      achieved tier pays, not cumulative).
- [ ] Sanity: quiz pass mark 75%, question count 10, cooldown 60 min.

## 5. Dark smoke test with an internal agent (flags still OFF except step d)

- [ ] a. Submit a test application via bite.express/agents → approve in admin →
      invite email arrives → set password → train → pass quiz → referral code issued.
- [ ] b. KYC: submit photo/ID/bank → admin verify.
- [ ] c. Flip `agent_program_active=1` (commission rate already set).
- [ ] d. Register a test customer with the agent's code → place a small real order →
      mark delivered → commission row appears in the agent's earnings, referral shows
      "activated".
- [ ] e. Withdraw request at/above minimum → appears in Admin → Withdrawals →
      approve → history shows Paid. (Real transfer optional; deny path also works.)
- [ ] f. If anything fails: flip `agent_program_active=0` (instant kill switch) and
      report; the ledger's immutability + reversals make cleanup auditable.

## 6. Challenges on

- [ ] Confirm srv02 `schedule:run` cron is alive (it is — installed 2026-05-18 — but
      verify: `grep schedule /var/spool/cron/...` or `crontab -l`). The "paid Monday"
      promise depends on it.
- [ ] Flip `agent_challenges_active=1`. Verify the PWA home strip appears for the
      internal agent.
- [ ] After the first real Monday 00:15 run, check `agent_challenge_awards` and one
      agent's ledger.

## 7. Open the doors

- [ ] Work through the pending `partner_leads` agent queue (approve the trained-and-
      ready first cohort).
- [ ] Reminder to ops: the FIRST withdrawal of every agent deserves a careful manual
      look (bank name matches account name, referral pattern sane) — the process is
      manual-approval anyway; this is about attention, not tooling.

## Watch-list / post-launch backlog

- BitePass renewal backlog behavior after the scheduler hotfix (step 0).
- One-line backend tidy: D1's ledger note "Bronze challenge — week …" uses an
  em-dash (house copy style: avoid); swap for "·" in AgentChallengeService.
- Push notifications (FCM/web-push) for payout + KYC decisions and challenge nudges —
  email-only at launch.
- Bank-list + account-name resolution on the KYC form (wrong bank names currently
  surface only at admin deny time).
- Referral velocity/abuse dashboards (B1 ships the data; flags are future work —
  never auto-punish, per the Phase 9 principle).
- Dedupe the PWA's three per-session `/challenge` fetches (cheap, cosmetic).
- WhatsApp-bot referral capture lands with the WA roadmap (WA-4+), not here.
