# Agent Program Phase G1.1 Implementation Plan: Admin KYC Alert

> **For agentic workers:** Small, single-repo phase. Execute task-by-task; steps use checkbox (`- [ ]`) syntax. The dashboard repo's quality floor binds verbatim. Verify, don't assume: trace each named mechanism before wiring into it.

**Goal:** Admins learn immediately when an agent submits or resubmits KYC, and can still see the queue an hour later: a real-time panel alert plus a persistent pending-count badge on the admin sidebar.

**Repo:** `C:\laragon\www\dashboard.bite.express`. Push-to-main auto-deploys srv02 in ~1 min. NO migration expected (KYC state already lives on the agent row). No new flag: this is admin-facing plumbing on an already-live flow.

## Frozen decisions

- **Real-time = the existing admin FCM topic mechanism.** `Helpers::send_push_notif_to_topic` with type `agent_kyc_request` and NO order_id. The admin panel JS routes order_id-less admin_message pushes to the generic chat banner automatically (verified in the WA-8-lite work), so no Blade/JS change is needed for v1. Do not add a dedicated modal in this phase.
- **Persistent = sidebar badge.** Pending-KYC count on the existing Agents sidebar entry, driven by one `pendingQuery()`/`pendingCount()` static pair on the relevant admin agent controller (WA-8.2 pattern: single source for page and badge).
- **Fires on the transition INTO pending only** (first submission and resubmission from incomplete/rejected). Never on decisions (F1 already notifies the agent side) and never on unrelated agent saves.
- **No email.** The dual-toggle admin email gate adds fragility for no gain when the badge is persistent.
- Alert copy: title "Agent KYC waiting for review", body "{agent name} submitted their KYC. {n} now waiting." Link: the admin agents list, filtered/ordered so pending-KYC agents are findable in one click (trace what the list already supports; add a simple `kyc=pending` filter to the index only if nothing exists).

## Global constraints

- Best-effort try/catch around the alert: a notification failure must never break the KYC submission.
- Pre-seed every new `translate()` key in `resources/lang/en/messages.php` (runtime-write hazard on srv02).
- Sidebar edits go in the module sidebars / shared partial that actually renders (base `_sidebar.blade.php` is dead). Note in the report that srv02 needs `php artisan view:clear` after deploy.
- No em-dashes in copy. Verification tooling outside the repo. `php artisan test --filter=Agent` green; full agent suite at the end.

### Task 1: Alert on the pending transition

- [x] Trace the agent KYC submit path (C1) to the exact point where KYC state becomes pending, both first submission and resubmission.
- [x] Fire the topic push there (type `agent_kyc_request`, no order_id, link per frozen decision), wrapped best-effort. Count in the body comes from the same pending query as Task 2.
- [x] Tests: submit fires once (fake/spy the helper), resubmission fires, KYC decision does not fire, helper throwing does not break submission.
- [x] Commit: `feat: admin alert when agent KYC enters review`.

### Task 2: Sidebar pending badge

- [x] `pendingQuery()`/`pendingCount()` statics on the admin agent controller that owns the review surface; badge on the Agents sidebar entry in the partial that all module sidebars include, red count shown only when > 0.
- [x] If a `kyc=pending` filter was added to the agents index, badge and alert link both use it.
- [x] Tests: count reflects only pending-KYC agents; badge query excludes everything else.
- [x] Full agent suite green. Commit: `feat: pending KYC badge on admin sidebar`.

### Task 3: Ship prep

- [x] Manual check in the local admin panel: badge renders with a seeded pending agent; submit flow fires the push (log or fake receiver); no Blade errors on any module's sidebar.
- [x] git status clean, no dependency changes. Push (or hand the commits to the operator if credentials block, per G1 precedent).
- [x] Report: commits, test counts, where the hook landed, the sidebar partial touched, view:clear reminder, deviations.

## Out of scope

Dedicated popup/sound (upgrade later only if care misses banners), email, agent-facing anything, WhatsApp alerts, KYC review UI changes beyond an optional index filter.
