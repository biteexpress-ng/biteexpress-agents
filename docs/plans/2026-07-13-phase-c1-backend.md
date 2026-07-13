# Agent Program Phase C1 (Backend) Implementation Plan — KYC & Withdrawals

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. Strict TDD as in A1/B1: failing test → implement → pass → commit.

**Goal:** Agents get paid: KYC submission + admin review, withdrawal requests with safe balance mechanics, and the admin approval queue.

**Architecture:** Extends the `Agent` domain in `dashboard.bite.express`. Dedicated `agent_withdraw_requests` table (spec decision: never touch the ZoneScoped core `withdraw_requests`). Balance moves are transactional with `lockForUpdate`, mirroring the B1 commission engine. `pending_balance` gains its meaning: withdrawal-in-flight.

**Tech Stack:** Laravel (existing app), MySQL, PHPUnit with `DatabaseTransactions`.

**Spec:** `docs/specs/2026-07-13-agent-program-design.md` §3, §4 step 6, and the C-gate withdrawal decision block.

## Global Constraints

- **Repo:** `C:\laragon\www\dashboard.bite.express`. Every commit bootable (auto-deploy CI/CD once pushed). All withdrawal behavior additionally guarded by KYC + minimum checks; the program flag/rate double-gate still applies upstream.
- **Balance invariant:** `agents.withdrawable_balance` / `pending_balance` change ONLY inside a DB transaction that also writes the corresponding `agent_withdraw_requests` state change (or B1 ledger row). Request: withdrawable −A, pending +A. Deny: reverse. Approve: pending −A. No path may create or destroy balance.
- New settings key: `agent_withdraw_min` (naira, seeded `5000`, admin-tunable like everything else). No hardcoded values.
- KYC images via the existing `Helpers::upload(dir, format, image)` (`app/CentralLogics/helpers.php:2229`) — READ how existing controllers store + serve images (dir naming, disk) and copy the idiom, including however delivery-man identity images are stored.
- Read-before-write reference files: `app/Http/Controllers/Admin/DeliveryMan/DeliveryManController.php::withdraw_list` (~line 650) and its status-update action + blade, as the admin-queue idiom to mirror.
- Test with `php artisan test --filter=<Name>`; never force-kill PHP.

---

### Task 1: Migration — `agent_withdraw_requests`

**Files:**
- Create: `database/migrations/2026_07_13_120000_create_agent_withdraw_requests_table.php`

- [ ] **Step 1: Write it**

```php
<?php
// database/migrations/2026_07_13_120000_create_agent_withdraw_requests_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agent payout queue. Deliberately separate from the core
 * withdraw_requests table (vendor/DM-scoped + ZoneScope) — spec
 * decision at the C gate. Bank fields are SNAPSHOTTED at request
 * time so later profile edits can't change where past payouts went.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_withdraw_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->decimal('amount', 24, 2);
            $table->string('status', 20)->default('pending'); // pending|approved|denied
            $table->string('bank_name', 120);
            $table->string('bank_account_number', 40);
            $table->string('bank_account_name', 160);
            $table->string('admin_note', 255)->nullable();
            $table->unsignedBigInteger('processed_by')->nullable(); // admin id
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('agent_id');
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_withdraw_requests');
    }
};
```

- [ ] **Step 2:** `php artisan migrate` clean. **Step 3:** Commit: `feat(agent): agent withdraw requests table (Phase C1)`.

### Task 2: Model + settings

**Files:**
- Create: `app/Models/AgentWithdrawRequest.php`
- Modify: `app/Services/Agent/AgentSettings.php`, `database/seeders/AgentProgramSettingsSeeder.php`, `app/Models/Agent.php` (relation + KYC constants)
- Test: extend `tests/Feature/Agent/AgentSettingsTest.php`

- [ ] **Step 1: Failing test** — `AgentSettings::withdrawMin()` default `5000.0`, override via `agent_withdraw_min` row.
- [ ] **Step 2: Implement:**

```php
<?php
// app/Models/AgentWithdrawRequest.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentWithdrawRequest extends Model
{
    public const STATUS_PENDING  = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DENIED   = 'denied';

    protected $guarded = ['id'];

    protected $casts = [
        'amount'       => 'float',
        'processed_at' => 'datetime',
    ];

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }
}
```

`AgentSettings::withdrawMin(): float` → `(float) self::raw('agent_withdraw_min', '5000')`; seeder adds `'agent_withdraw_min' => '5000'`.

Add to `Agent`: `withdrawRequests()` hasMany; KYC status constants `KYC_INCOMPLETE = 'incomplete'`, `KYC_PENDING = 'pending'`, `KYC_VERIFIED = 'verified'`, `KYC_REJECTED = 'rejected'`.

- [ ] **Step 3:** PASS → Commit: `feat(agent): withdraw request model and minimum setting`.

### Task 3: KYC submission API

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentKycController.php`
- Modify: `routes/api/v1/api.php` (authed agent group)
- Test: `tests/Feature/Agent/AgentKycApiTest.php`

**Endpoints produced (all `agent.api`):**
- `GET /kyc` → `{kyc_status, rejection_reason, photo_url, identity_type, identity_image_url, bank: {bank_name, account_number_masked, account_name}}`
- `POST /kyc` (multipart) → fields `photo` (image, max 2MB), `identity_type` (in: nin, drivers_license, voters_card, passport), `identity_image` (image, max 2MB), `bank_name`, `bank_account_number` (digits, 10), `bank_account_name` → stores images via `Helpers::upload`, sets `kyc_status = pending`, clears any previous rejection reason. Allowed from states `incomplete` and `rejected` only; `pending`/`verified` → 409 `{code:'kyc-locked'}` (verified agents contact support to change bank details — Phase C keeps this manual on purpose).

- [ ] **Step 1:** READ how an existing controller handles multipart image upload + storage disk (search `Helpers::upload(` call sites; follow the delivery-man identity image convention including the storage dir naming and how URLs are rendered back).
- [ ] **Step 2: Failing tests** — submit from `incomplete` → status `pending`, images stored (fake storage disk per existing test conventions), account number masked in GET (`******7890`); resubmit while `pending` → 409; resubmit after `rejected` → back to `pending`; validation failures (bad identity_type, 9-digit account number) → 422.
- [ ] **Step 3: Implement** — add a `kyc_rejection_reason` string column via one small migration `2026_07_13_120001_add_kyc_rejection_reason_to_agents.php` (nullable, 255).
- [ ] **Step 4:** PASS → Commit: `feat(agent): KYC submission API`.

### Task 4: Withdrawal service — the balance mechanics

**Files:**
- Create: `app/Services/Agent/AgentWithdrawService.php`
- Test: `tests/Feature/Agent/AgentWithdrawServiceTest.php`

**Interfaces produced:**
- `request(Agent $agent, float $amount): AgentWithdrawRequest` — throws `RuntimeException` with codes: `'kyc-not-verified'`, `'below-minimum'`, `'insufficient-balance'`, `'request-pending'` (one open request at a time). On success, inside one transaction with `lockForUpdate` on the agent row: create the request with bank-field snapshots from the agent profile, `withdrawable_balance -= amount`, `pending_balance += amount`.
- `approve(AgentWithdrawRequest $req, int $adminId, ?string $note): AgentWithdrawRequest` — pending only (else `'already-processed'`); transaction: `pending_balance -= amount`, status approved, processed_by/at set.
- `deny(AgentWithdrawRequest $req, int $adminId, ?string $note): AgentWithdrawRequest` — pending only; transaction: `pending_balance -= amount`, `withdrawable_balance += amount`, status denied.

- [ ] **Step 1: Failing tests** — happy path request (balances move, snapshot fields populated); each guard code; approve clears pending; deny restores withdrawable; both idempotence guards (`already-processed`); conservation property: after any sequence request→deny, `withdrawable + pending` equals the starting total; after request→approve it equals start − amount.
- [ ] **Step 2: Implement:**

```php
<?php
// app/Services/Agent/AgentWithdrawService.php

namespace App\Services\Agent;

use App\Models\Agent;
use App\Models\AgentWithdrawRequest;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AgentWithdrawService
{
    public function request(Agent $agent, float $amount): AgentWithdrawRequest
    {
        if ($agent->kyc_status !== Agent::KYC_VERIFIED) {
            throw new RuntimeException('kyc-not-verified');
        }
        if ($amount < AgentSettings::withdrawMin()) {
            throw new RuntimeException('below-minimum');
        }
        if (AgentWithdrawRequest::where('agent_id', $agent->id)
            ->where('status', AgentWithdrawRequest::STATUS_PENDING)->exists()) {
            throw new RuntimeException('request-pending');
        }

        return DB::transaction(function () use ($agent, $amount) {
            $locked = Agent::whereKey($agent->id)->lockForUpdate()->first();

            if ($amount > $locked->withdrawable_balance) {
                throw new RuntimeException('insufficient-balance');
            }

            $req = AgentWithdrawRequest::create([
                'agent_id'            => $locked->id,
                'amount'              => $amount,
                'status'              => AgentWithdrawRequest::STATUS_PENDING,
                'bank_name'           => $locked->bank_name,
                'bank_account_number' => $locked->bank_account_number,
                'bank_account_name'   => $locked->bank_account_name,
            ]);

            $locked->decrement('withdrawable_balance', $amount);
            $locked->increment('pending_balance', $amount);

            return $req;
        });
    }

    public function approve(AgentWithdrawRequest $req, int $adminId, ?string $note = null): AgentWithdrawRequest
    {
        return $this->process($req, AgentWithdrawRequest::STATUS_APPROVED, $adminId, $note, restore: false);
    }

    public function deny(AgentWithdrawRequest $req, int $adminId, ?string $note = null): AgentWithdrawRequest
    {
        return $this->process($req, AgentWithdrawRequest::STATUS_DENIED, $adminId, $note, restore: true);
    }

    private function process(AgentWithdrawRequest $req, string $status, int $adminId, ?string $note, bool $restore): AgentWithdrawRequest
    {
        return DB::transaction(function () use ($req, $status, $adminId, $note, $restore) {
            $fresh = AgentWithdrawRequest::whereKey($req->id)->lockForUpdate()->first();
            if ($fresh->status !== AgentWithdrawRequest::STATUS_PENDING) {
                throw new RuntimeException('already-processed');
            }

            $agent = Agent::whereKey($fresh->agent_id)->lockForUpdate()->first();
            $agent->decrement('pending_balance', $fresh->amount);
            if ($restore) {
                $agent->increment('withdrawable_balance', $fresh->amount);
            }

            $fresh->update([
                'status'       => $status,
                'admin_note'   => $note,
                'processed_by' => $adminId,
                'processed_at' => now(),
            ]);

            return $fresh;
        });
    }
}
```

- [ ] **Step 3:** PASS → Commit: `feat(agent): withdrawal service with conservation-safe balance mechanics`.

### Task 5: Agent-facing withdrawal + eligibility APIs

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentWithdrawController.php`
- Modify: `app/Http/Controllers/Api/V1/Agent/AgentEarningsController.php` (add `eligibility`)
- Modify: `routes/api/v1/api.php`
- Test: `tests/Feature/Agent/AgentWithdrawApiTest.php`

**Endpoints produced:**
- `POST /withdraw {amount}` → 200 `{request: {id, amount, status, created_at}}`; 403 `{code}` for each service guard code.
- `GET /withdrawals?page=N` → `{withdrawals: [{id, amount, status, admin_note, created_at, processed_at}], pagination}` — newest first. Separate from the commission ledger (B2 friction decision).
- `GET /earnings` response gains `eligibility: {can_withdraw, min_amount, kyc_status, reason}` where `reason` is null when `can_withdraw` is true, else one of `kyc-not-verified|below-minimum|request-pending` (evaluated in that order against the current withdrawable balance).

- [ ] **Step 1: Failing tests** for all three (guard codes surface as 403 `{code}`; eligibility reflects each blocking state; withdrawals history paginates).
- [ ] **Step 2: Implement** thin controllers over the service. **Step 3:** PASS → Commit: `feat(agent): withdrawal and eligibility APIs`.

### Task 6: Admin — KYC review + withdrawal queue

**Files:**
- Modify: `app/Http/Controllers/Admin/Agent/AgentController.php` (KYC approve/reject actions)
- Modify: `resources/views/admin-views/agent/show.blade.php` (KYC card: photo + ID image previews, bank details, approve / reject-with-reason)
- Create: `app/Http/Controllers/Admin/Agent/AgentWithdrawRequestController.php` + `resources/views/admin-views/agent/withdrawals.blade.php`
- Modify: `routes/admin/routes.php`, `resources/views/layouts/admin/partials/_sidebar.blade.php` ("Withdrawals" link in the Agent Program cluster, with a pending-count badge if the sidebar idiom supports one — check how existing badges render; skip the badge if there's no precedent)
- Test: `tests/Feature/Agent/AdminAgentWithdrawTest.php`

- [ ] **Step 1:** READ `DeliveryManController::withdraw_list` (~line 650) + its blade + status action; mirror the queue UX: filter by status, row per request (agent name, amount, snapshotted bank details, requested date), approve/deny buttons with confirm + optional note.
- [ ] **Step 2: Failing test** — admin approve route flips status + clears pending (drive through HTTP with `actingAs` admin, reusing the A1 `AdminAgentApprovalTest` auth approach); deny restores balance; processing a non-pending request errors gracefully (redirect back with toastr error, no exception page).
- [ ] **Step 3:** KYC actions on agent detail: `POST agents/{id}/kyc-approve` → `kyc_status = verified`; `POST agents/{id}/kyc-reject {reason}` → `kyc_status = rejected`, reason stored. Only from `pending` state.
- [ ] **Step 4:** PASS → Commit: `feat(agent): admin KYC review and withdrawal approval queue`.

### Task 7: Agent notification emails (best-effort)

**Files:**
- Create: `app/Mail/AgentWithdrawProcessedMail.php`, `app/Mail/AgentKycReviewedMail.php`, blades under `resources/views/email-templates/`
- Modify: the admin actions from Task 6 to send them
- Test: extend `tests/Feature/Agent/AdminAgentWithdrawTest.php` (Mail::fake assertions)

- [ ] Simple transactional mails on withdraw approve/deny and KYC verify/reject (deny/reject mails include the note/reason). Send in try/catch, log on failure, never block the admin action — same pattern as the A1 invite mail. Match the A1 email template styling.
- [ ] PASS → Commit: `feat(agent): payout and KYC decision emails`.

### Task 8: Verification pass

- [ ] `php artisan db:seed --class=AgentProgramSettingsSeeder` — `agent_withdraw_min = 5000` present.
- [ ] Full `php artisan test --filter=Agent` green (expect ~95+ tests).
- [ ] Conservation audit query documented in the report: `SELECT id, earned_total, withdrawable_balance, pending_balance FROM agents` alongside summed ledger + approved withdrawals for the seeded test agent — totals must reconcile: `earned_total(net) = withdrawable + pending + approved_payouts`.
- [ ] End-to-end local: KYC submit → admin verify → withdraw request → admin approve; then a second run ending in deny; balances checked at every step.
- [ ] Do NOT push (per the B1 precedent the push + srv02 migrate/seed sequence is the user's ops step; note it in the report).
- [ ] Report: files per task, full Agent test output, deviations, the reconciliation numbers, and response shapes Phase C2 (PWA screens) needs.

---

## Out of scope

Phase C2 (PWA: KYC form, withdraw screen, history), Phase D (challenges, notifications, `pending` from unconfirmed commissions — pending means ONLY withdrawal-in-flight until D says otherwise). Changing verified bank details stays a manual support path in v1.
