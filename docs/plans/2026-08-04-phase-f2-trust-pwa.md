# Agent Program Phase F2 (PWA) Implementation Plan: Trust Engine UI

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. Read `PRODUCT.md` and `DESIGN.md` first; load `frontend-design`, `impeccable`, and `ui-ux-pro-max` if available. The established quality floor binds verbatim. Depends on Phase F1 backend being deployed (push endpoints, banks/resolve endpoints, projection object, SLA/express fields).

**Goal:** The agent feels the program working: their phone pings when money lands, their bank details cannot be mistyped, the withdraw screen says when they will be paid, and the earnings screen shows what their book is worth and what growing it would earn.

**Architecture:** Extends the existing app. No new routes; everything lands on existing screens (home, earnings, withdraw, profile/KYC). One new service worker file for push only.

**Repo:** `C:\laragon\www\biteexpress-agents`. Tech stack unchanged; no new dependencies (Web Push API is native).

## Global constraints

- The service worker handles `push` and `notificationclick` ONLY. No fetch handler, no offline caching, no precache. A stale-cache bug in a money app is worse than no offline support.
- Never fire the browser permission prompt on page load. Permission is requested only from an explicit tap on the opt-in card ("Turn on notifications"). A denied browser prompt is nearly unrecoverable; the soft card is the shield.
- Projection numbers are estimates and must always read as estimates. Copy uses "about" / "based on your last 30 days". Never the word "guaranteed", never a promise. Amounts in tabular figures per DESIGN.md money rules.
- No em-dashes in any copy. No invented numbers: when there is not enough data and the admin illustrative average is unset (0), the projector shows an encouraging empty state, not a made-up figure.
- Verification-only tooling stays outside the repo; final report includes a dependency-diff (`package.json` unchanged) and `git status` cleanliness check.
- Verification: `npm run build` per task; final seeded live pass mandatory. Dev servers via `taskkill /F /T /PID` only.
- Commit per task; push at the end. Stop after Task 5.

## API contract (frozen by F1)

- `GET /agent/push/config` -> `{enabled, public_key}`; `POST /agent/push/subscribe` (endpoint, p256dh, auth, user_agent); `DELETE /agent/push/subscribe` (endpoint).
- `GET /agent/banks` -> `[{name, code}]` (empty list = resolution unavailable, degrade).
- `POST /agent/kyc/resolve-account` {bank_code, account_number} -> `{account_name}` or null.
- `GET /earnings` gains `projection: {window_days, order_commission_30d, active_customers, illustrative_avg_monthly_per_active}` and `payout_sla_hours` on the eligibility object; withdraw rows/creation gain `express` (bool).

---

### Task 1: Push opt-in and service worker

**Files:**
- Create: `public/agent-sw.js`, `src/lib/push.ts`, `src/components/home/notifications-card.tsx`
- Modify: `src/app/(app)/profile/page.tsx` (toggle), API layer types/client.

**Steps:**

- [x] `agent-sw.js`: `push` -> `showNotification(title, {body, icon (brand asset), data.url, tag})`; `notificationclick` -> focus or open `data.url` (default `/earnings`). Nothing else.
- [x] `push.ts`: feature detection (`serviceWorker`, `PushManager`, `Notification`), register SW, subscribe with the VAPID public key from `/agent/push/config`, POST the subscription; unsubscribe mirror. Handle iOS: push requires the PWA installed to the home screen (iOS 16.4+); detect non-standalone iOS Safari and return a distinct `needs_install` state.
- [x] `NotificationsCard` on home (below the Promote card, only when `config.enabled` and permission not yet granted/denied): one sentence of value ("Know the second you earn"), one button. `needs_install` state renders "Add BiteExpress Agents to your home screen to get notifications" with the iOS share-sheet hint instead of the button. Permission denied: card hides (do not nag).
- [x] Profile: notifications row with on/off toggle (subscribe/unsubscribe), states handled quietly.
- [x] Verify: `npm run build`; manual dev check that subscribe round-trips against local backend. Commit: `feat: agent push notifications client`.

### Task 2: KYC bank resolution flow

**Files:**
- Modify: the KYC form components (trace them under `src/components/kyc/`), API layer.

**Steps:**

- [x] Bank field becomes a searchable select fed by `GET /agent/banks`; empty list falls back to today's free-text input (no dead end, no error state).
- [x] Account number input: on 10 digits (NUBAN length) with a bank selected, call resolve (debounced, one in flight). Success renders the resolved name in a confirmation panel: "Paying: {ACCOUNT NAME}. Make sure this is you." The submitted payload carries bank_code; the name field locks to the resolved value. Resolve failure or null: honest inline note ("We could not confirm this account name, check the number carefully") and the typed-name path stays available.
- [x] Loading/error states per app idiom; no layout shift on resolve.
- [x] Verify: `npm run build`. Commit: `feat: bank account name resolution in KYC`.

### Task 3: Withdraw screen SLA + express

**Files:**
- Modify: withdraw screen components, earnings API types.

**Steps:**

- [x] Above the withdraw CTA, quiet line from `payout_sla_hours`: "Withdrawals are usually paid within {n} hours." Rendered only when the field is present and > 0.
- [x] When a creation response or open request has `express: true`: a small badge "Fast track" with a one-line explainer ("Verified agents with a clean payout record are processed first"). Absent flag renders nothing; visuals stay calm (this is money UI, not gamification).
- [x] History rows unchanged otherwise.
- [x] Verify: `npm run build`. Commit: `feat: payout SLA and fast-track badge`.

### Task 4: The what-if projector

**Files:**
- Create: `src/components/earnings/projector-card.tsx`
- Modify: `src/app/(app)/earnings/page.tsx`, API types.

**Steps:**

- [x] Data rules, in order: (a) `active_customers >= 3` and `order_commission_30d > 0`: per-active average = commission_30d / active_customers, headline "Your {n} active customers earned you about ₦{X} this month." (b) Fewer than 3 active or zero commission, and `illustrative_avg_monthly_per_active > 0`: use the illustrative value, clearly labelled "based on a typical BiteExpress agent". (c) Neither: empty state "Sign up your first customers and this becomes your income projection", linking to /promote. Never mix modes.
- [x] The what-if control: a slider or stepper for hypothetical active-customer count (default max(10, current*2), cap 100) recomputing "about ₦{Y}/month" live. Estimate framing on every number; footnote "Estimate from your last 30 days. Commissions come from delivered orders."
- [x] Accessible: slider labelled, values announced, amounts tabular, works at 360px and 200% zoom.
- [x] Verify: `npm run build`. Commit: `feat: earnings what-if projector`.

### Task 5: Seeded live pass + ship prep

- [x] Live pass (production build, seeded certified agent against the F1 backend): opt-in card -> permission -> subscription row lands in DB; trigger a seeded commission event and see the real notification arrive (Chrome desktop or Android); KYC resolve happy + degraded paths; SLA line and express badge render per seeded settings; projector in all three data modes (adjust seeds to hit each).
- [x] Confirm the SW does not intercept fetches (network tab: no "(from ServiceWorker)" on page loads) and the app still hard-reloads fresh after a deploy.
- [x] A11y spot-pass per app standard; 360px no-overflow on all touched screens.
- [x] README notes if any; `npm run build` green; dependency-diff clean (`package.json` untouched); push.
- [x] Report for the CTO gate: screenshots per state (opt-in card, notification received, resolved-name panel, SLA + badge, projector modes), live-pass results, deviations.

---

## Out of scope

Notification history/inbox in the PWA, per-event notification preferences, quiet hours, offline caching, any change to E1 marketing kit or challenge screens.
