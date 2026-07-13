# Agent Program Phase B1 (Backend) Implementation Plan — Referrals & Commissions

> **For agentic workers:** Execute task-by-task in order; steps use checkbox (`- [ ]`) syntax. Strict TDD: failing test → implement → pass → commit, exactly as in Phase A1.

**Goal:** Agents earn: referral capture at customer registration, agent-assisted OTP signup, the commission engine on delivered orders with refund clawback, and the agent-facing customers/earnings APIs.

**Architecture:** Extends the Phase A1 `Agent` domain in `dashboard.bite.express`. Commission accrual hooks into the existing `OrderObserver` using the gamification pattern (non-blocking, errors swallowed + logged loudly). Financial rows are immutable; corrections are offsetting reversal entries (house invariant). All tunables in `business_settings`.

**Tech Stack:** Laravel (existing app), MySQL, PHPUnit feature tests with `DatabaseTransactions`.

**Spec:** `docs/specs/2026-07-13-agent-program-design.md` §3, §5 (this repo). Phase B covers referrals + commissions only — no KYC, withdrawals (C), or challenges (D).

## Global Constraints

- **Repo:** all code in `C:\laragon\www\dashboard.bite.express`. Auto-deploy hook is live: every commit must leave the app bootable; all new behavior is gated behind `agent_program_active` (default `0`) — with the flag off, registration referral capture and commission accrual are no-ops.
- **Read-before-write rule:** for each integration point (Tasks 5, 6, 7) read the named existing file FIRST and follow its local idiom over this plan's example markup.
- No monetary value hardcoded: `agent_commission_rate` (percent of order subtotal), `agent_commission_min_order` (naira floor) join the settings keys from A1.
- **Financial immutability invariant:** `agent_commissions` rows are never UPDATEd after creation except the `status` transition pending→confirmed (not used in B1 — accrual happens at delivery so rows are born `confirmed`) — clawbacks are NEW rows with `type='reversal'` and negative-effect semantics. Balance columns on `agents` change only inside the same DB transaction as a ledger insert.
- Commission accrual and referral activation must NEVER block or fail order/customer writes — same guarantee the gamification observer documents.
- Test commands: `php artisan test --filter=<Name>`; never force-kill PHP on this machine.
- Phone numbers E.164 throughout.

## Carry-over fixes from the A2 gate (do these in Task 8)

1. `POST /quiz/submit` failing response must include `retry_at` (ISO8601) so the fail screen can show the countdown inline.
2. New `GET /quiz/info` (auth) returning `{question_count, pass_mark, cooldown_minutes}` from settings — no draw burned. **Units are percentages** for `pass_mark` and `score` (0–100), everywhere, documented in the response of both quiz endpoints via this contract.

---

### Task 1: Migrations — `agent_referrals` and `agent_commissions`

**Files:**
- Create: `database/migrations/2026_07_13_110000_create_agent_referrals_table.php`
- Create: `database/migrations/2026_07_13_110001_create_agent_commissions_table.php`

- [ ] **Step 1: Write both migrations**

```php
<?php
// database/migrations/2026_07_13_110000_create_agent_referrals_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per customer an agent onboarded. user_id is UNIQUE:
 * a customer belongs to at most one agent, forever (spec §3).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_referrals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('user_id')->unique();
            $table->string('signup_channel', 20)->default('code'); // code|assisted
            $table->string('status', 20)->default('registered');   // registered|activated
            $table->timestamp('first_order_at')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'status']);
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_referrals');
    }
};
```

```php
<?php
// database/migrations/2026_07_13_110001_create_agent_commissions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Immutable commission ledger. order_id is UNIQUE among
 * type=order_commission rows via order_id column (nullable for
 * bonus/reversal rows, so uniqueness is a composite guard enforced
 * in service code + a partial-style unique index on order_id where
 * MySQL allows NULL duplicates naturally).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_commissions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('referral_id')->nullable();
            $table->unsignedBigInteger('order_id')->nullable()->unique(); // NULLs may repeat; real ids may not
            $table->string('type', 30)->default('order_commission');
            // order_commission|challenge_bonus|manual_bonus|reversal
            $table->string('status', 20)->default('confirmed'); // confirmed|reversed
            $table->unsignedBigInteger('reversal_of_id')->nullable(); // set on type=reversal rows
            $table->decimal('order_amount', 24, 2)->nullable();
            $table->decimal('rate_snapshot', 8, 4)->nullable();   // percent captured at accrual time
            $table->decimal('amount', 24, 2);                     // negative on reversal rows
            $table->string('note', 255)->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'created_at']);
            $table->index('referral_id');
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
            $table->foreign('referral_id')->references('id')->on('agent_referrals')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_commissions');
    }
};
```

Note: a reversal row references the original via `reversal_of_id` and carries `order_id = null` (the unique slot stays with the original), `amount` negative.

- [ ] **Step 2:** `php artisan migrate` — both run clean.
- [ ] **Step 3:** Commit: `feat(agent): referral and commission ledger tables (Phase B1)`.

### Task 2: Models + balance invariant helpers

**Files:**
- Create: `app/Models/AgentReferral.php`, `app/Models/AgentCommission.php`
- Modify: `app/Models/Agent.php` (add `referrals()`, `commissions()` relations)
- Test: `tests/Feature/Agent/AgentCommissionModelTest.php`

**Interfaces produced:** `AgentReferral` constants `STATUS_REGISTERED/ACTIVATED`, `CHANNEL_CODE/ASSISTED`; `AgentCommission` constants `TYPE_ORDER/TYPE_CHALLENGE_BONUS/TYPE_MANUAL_BONUS/TYPE_REVERSAL`, `STATUS_CONFIRMED/REVERSED`; casts `amount/order_amount/rate_snapshot => float`.

- [ ] **Step 1: Failing test** — creating a commission row and a reversal row; assert an UPDATE to `amount` on a saved commission throws (add a model `updating` guard that only allows `status` and `updated_at` changes):

```php
<?php
// tests/Feature/Agent/AgentCommissionModelTest.php

namespace Tests\Feature\Agent;

use App\Models\Agent;
use App\Models\AgentCommission;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use RuntimeException;
use Tests\TestCase;

class AgentCommissionModelTest extends TestCase
{
    use DatabaseTransactions;

    private function makeAgent(): Agent
    {
        return Agent::create([
            'full_name' => 'Ledger Agent',
            'email'     => 'ledger' . uniqid() . '@test.com',
            'phone'     => '+23480' . random_int(10000000, 99999999),
            'status'    => Agent::STATUS_CERTIFIED,
        ]);
    }

    public function test_ledger_rows_are_immutable_except_status(): void
    {
        $agent = $this->makeAgent();
        $row = AgentCommission::create([
            'agent_id' => $agent->id,
            'type'     => AgentCommission::TYPE_ORDER,
            'status'   => AgentCommission::STATUS_CONFIRMED,
            'amount'   => 50.00,
        ]);

        $row->status = AgentCommission::STATUS_REVERSED;
        $row->save(); // allowed

        $row->amount = 999.99;
        $this->expectException(RuntimeException::class);
        $row->save(); // forbidden
    }
}
```

- [ ] **Step 2:** Run — FAIL (class missing).
- [ ] **Step 3: Implement** — models with the guard:

```php
<?php
// app/Models/AgentCommission.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use RuntimeException;

class AgentCommission extends Model
{
    public const TYPE_ORDER           = 'order_commission';
    public const TYPE_CHALLENGE_BONUS = 'challenge_bonus';
    public const TYPE_MANUAL_BONUS    = 'manual_bonus';
    public const TYPE_REVERSAL        = 'reversal';

    public const STATUS_CONFIRMED = 'confirmed';
    public const STATUS_REVERSED  = 'reversed';

    protected $guarded = ['id'];

    protected $casts = [
        'order_amount'  => 'float',
        'rate_snapshot' => 'float',
        'amount'        => 'float',
    ];

    protected static function booted(): void
    {
        // Financial immutability: ledger rows never change after insert,
        // except the status flag (confirmed -> reversed marker on originals).
        static::updating(function (self $row) {
            $dirty = array_keys($row->getDirty());
            $allowed = ['status', 'updated_at'];
            if (array_diff($dirty, $allowed)) {
                throw new RuntimeException('agent_commissions rows are immutable; write a reversal entry instead.');
            }
        });
    }

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }

    public function referral()
    {
        return $this->belongsTo(AgentReferral::class);
    }
}
```

```php
<?php
// app/Models/AgentReferral.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentReferral extends Model
{
    public const STATUS_REGISTERED = 'registered';
    public const STATUS_ACTIVATED  = 'activated';

    public const CHANNEL_CODE     = 'code';
    public const CHANNEL_ASSISTED = 'assisted';

    protected $guarded = ['id'];

    protected $casts = ['first_order_at' => 'datetime'];

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

Add to `app/Models/Agent.php`:

```php
    public function referrals()
    {
        return $this->hasMany(AgentReferral::class);
    }

    public function commissions()
    {
        return $this->hasMany(AgentCommission::class);
    }
```

- [ ] **Step 4:** Run — PASS. **Step 5:** Commit: `feat(agent): referral and commission models with immutability guard`.

### Task 3: Settings extension

**Files:**
- Modify: `app/Services/Agent/AgentSettings.php`, `database/seeders/AgentProgramSettingsSeeder.php`
- Test: extend `tests/Feature/Agent/AgentSettingsTest.php`

- [ ] **Step 1: Failing test additions** — `commissionRate()` default `0.0`, `commissionMinOrder()` default `0.0`, overridable via `business_settings` keys `agent_commission_rate`, `agent_commission_min_order`.
- [ ] **Step 2: Implement:**

```php
    public static function commissionRate(): float
    {
        return (float) self::raw('agent_commission_rate', '0');
    }

    public static function commissionMinOrder(): float
    {
        return (float) self::raw('agent_commission_min_order', '0');
    }
```

Seeder adds `'agent_commission_rate' => '0'`, `'agent_commission_min_order' => '0'`. Default rate **0** on purpose: even if the program flag is flipped early, zero rate = zero liability until finance sets the number.

- [ ] **Step 3:** PASS → Commit: `feat(agent): commission rate and floor settings`.

### Task 4: Referral capture service

**Files:**
- Create: `app/Services/Agent/AgentReferralService.php`
- Test: `tests/Feature/Agent/AgentReferralServiceTest.php`

**Interfaces produced:**
- `AgentReferralService::findAgentByCode(?string $code): ?Agent` — certified, non-suspended agents only; codes match `/^BX-/i` (case-insensitive lookup).
- `AgentReferralService::attach(Agent $agent, User $user, string $channel): AgentReferral` — creates the referral; throws `RuntimeException('already-referred')` if the user already has one, `('self-referral')` if the user's phone/email matches the agent's, `('program-inactive')` when `AgentSettings::programActive()` is false.

- [ ] **Step 1: Failing tests** covering: attach happy path; uniqueness (second attach for same user throws); self-referral blocked (same phone); inactive program throws; `findAgentByCode` returns null for suspended/uncertified agents and unknown codes, and is case-insensitive.

```php
<?php
// tests/Feature/Agent/AgentReferralServiceTest.php

namespace Tests\Feature\Agent;

use App\Models\Agent;
use App\Models\AgentReferral;
use App\Models\BusinessSetting;
use App\Models\User;
use App\Services\Agent\AgentReferralService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use RuntimeException;
use Tests\TestCase;

class AgentReferralServiceTest extends TestCase
{
    use DatabaseTransactions;

    private AgentReferralService $svc;

    protected function setUp(): void
    {
        parent::setUp();
        BusinessSetting::updateOrCreate(['key' => 'agent_program_active'], ['value' => '1']);
        $this->svc = app(AgentReferralService::class);
    }

    private function makeAgent(array $attrs = []): Agent
    {
        return Agent::create(array_merge([
            'full_name' => 'Ref Agent',
            'email' => 'ref' . uniqid() . '@test.com',
            'phone' => '+23480' . random_int(10000000, 99999999),
            'status' => Agent::STATUS_CERTIFIED,
            'referral_code' => Agent::generateReferralCode(),
        ], $attrs));
    }

    private function makeUser(array $attrs = []): User
    {
        return User::create(array_merge([
            'f_name' => 'Cust', 'l_name' => 'Omer',
            'email' => 'cust' . uniqid() . '@test.com',
            'phone' => '+23481' . random_int(10000000, 99999999),
            'password' => bcrypt('Secret123!'),
        ], $attrs));
    }

    public function test_attach_creates_referral_once(): void
    {
        $agent = $this->makeAgent();
        $user = $this->makeUser();

        $ref = $this->svc->attach($agent, $user, AgentReferral::CHANNEL_CODE);
        $this->assertSame(AgentReferral::STATUS_REGISTERED, $ref->status);

        $this->expectException(RuntimeException::class);
        $this->svc->attach($this->makeAgent(), $user, AgentReferral::CHANNEL_CODE);
    }

    public function test_self_referral_blocked_by_phone(): void
    {
        $agent = $this->makeAgent();
        $user = $this->makeUser(['phone' => $agent->phone]);

        $this->expectException(RuntimeException::class);
        $this->svc->attach($agent, $user, AgentReferral::CHANNEL_CODE);
    }

    public function test_inactive_program_blocks_attach(): void
    {
        BusinessSetting::updateOrCreate(['key' => 'agent_program_active'], ['value' => '0']);
        $this->expectException(RuntimeException::class);
        $this->svc->attach($this->makeAgent(), $this->makeUser(), AgentReferral::CHANNEL_CODE);
    }

    public function test_find_agent_by_code_filters_and_is_case_insensitive(): void
    {
        $agent = $this->makeAgent();
        $this->assertNotNull($this->svc->findAgentByCode(strtolower($agent->referral_code)));
        $this->assertNull($this->svc->findAgentByCode('BX-ZZZZZ'));

        $suspended = $this->makeAgent(['status' => Agent::STATUS_SUSPENDED]);
        $this->assertNull($this->svc->findAgentByCode($suspended->referral_code));
    }
}
```

Note: adjust `makeUser` columns to the real `users` table (check an existing factory/test helper such as `Tests\Support\CreatesCommerceTestData` first and reuse it if it creates users).

- [ ] **Step 2:** FAIL → **Step 3: Implement:**

```php
<?php
// app/Services/Agent/AgentReferralService.php

namespace App\Services\Agent;

use App\Models\Agent;
use App\Models\AgentReferral;
use App\Models\User;
use RuntimeException;

class AgentReferralService
{
    public function findAgentByCode(?string $code): ?Agent
    {
        if (!$code || stripos($code, 'BX-') !== 0) {
            return null;
        }
        return Agent::whereRaw('UPPER(referral_code) = ?', [strtoupper($code)])
            ->where('status', Agent::STATUS_CERTIFIED)
            ->first();
    }

    public function attach(Agent $agent, User $user, string $channel): AgentReferral
    {
        if (!AgentSettings::programActive()) {
            throw new RuntimeException('program-inactive');
        }
        if (AgentReferral::where('user_id', $user->id)->exists()) {
            throw new RuntimeException('already-referred');
        }
        if ($user->phone === $agent->phone || strcasecmp((string) $user->email, $agent->email) === 0) {
            throw new RuntimeException('self-referral');
        }

        return AgentReferral::create([
            'agent_id'       => $agent->id,
            'user_id'        => $user->id,
            'signup_channel' => $channel,
            'status'         => AgentReferral::STATUS_REGISTERED,
        ]);
    }
}
```

- [ ] **Step 4:** PASS → Commit: `feat(agent): referral capture service`.

### Task 5: Hook referral capture into customer registration

**Files:**
- Modify: `app/Http/Controllers/Api/V1/Auth/CustomerAuthController.php` (registration method, near the existing `ref_code` block at ~line 441)
- Modify: `routes/api/v1/api.php` (public code-check endpoint)
- Create: `app/Http/Controllers/Api/V1/Agent/AgentCodeController.php`
- Test: `tests/Feature/Agent/AgentReferralRegistrationTest.php`

- [ ] **Step 1: READ FIRST** — the whole registration method in `CustomerAuthController` and how it currently resolves `ref_code` to a referring USER (customer-to-customer referral, lines ~441–470). The agent path must not disturb it.
- [ ] **Step 2: Failing test** — registering a customer through the real endpoint with `ref_code = <agent code>` creates an `agent_referrals` row and does NOT trip the existing customer-referral error paths; with the program flag off, registration succeeds and no row is created; an unknown `BX-` code fails registration with the same 405 shape as an unknown customer code.
- [ ] **Step 3: Implement** — in the registration method, BEFORE the existing customer `ref_code` lookup: if the submitted code matches an agent (`AgentReferralService::findAgentByCode`), skip the customer-referrer branch entirely; after the user is created, call `attach($agent, $user, 'code')` inside try/catch — `program-inactive` and any other RuntimeException log at info level and never fail registration (the user is already committed; a lost referral is recoverable, a failed signup is not). Unknown `BX-`-prefixed codes fall through to the existing "referer_code_not_found" response.
- [ ] **Step 4:** Public validation endpoint for client UX (used by the user app / web app signup forms):

```php
// routes/api/v1/api.php — inside the public agent prefix group (next to auth)
Route::get('code/{code}/validate', 'AgentCodeController@validate')->middleware('throttle:30,1');
```

```php
<?php
// app/Http/Controllers/Api/V1/Agent/AgentCodeController.php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentReferralService;

class AgentCodeController extends Controller
{
    public function validate(string $code, AgentReferralService $svc)
    {
        $agent = $svc->findAgentByCode($code);
        return response()->json([
            'valid'      => (bool) $agent,
            'agent_name' => $agent ? $agent->full_name : null, // first name display is client's choice
        ]);
    }
}
```

- [ ] **Step 5:** PASS → Commit: `feat(agent): capture agent referral codes at customer registration`.

### Task 6: Assisted signup (OTP)

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentAssistedSignupController.php`
- Modify: `routes/api/v1/api.php` (authed agent group)
- Test: `tests/Feature/Agent/AgentAssistedSignupTest.php`

- [ ] **Step 1: READ FIRST** — `app/Models/PhoneVerification.php` and how `CustomerAuthController` creates/checks OTP rows and calls `App\CentralLogics\SMS_module::send($receiver, $otp)`; reuse both verbatim (same table, same OTP length/expiry conventions found there).
- [ ] **Step 2: Failing test** — initiate: creates a `PhoneVerification` row for a NEW phone (mock/fake the SMS gateway the way existing tests do — search `tests/` for `SMS_module` usage; if untestable, wrap the send in a `try/catch` and assert the verification row instead); initiate for an existing `users.phone` → 409 `{code:'phone-exists'}`; confirm with wrong OTP → 400; confirm with right OTP → creates user (f_name/l_name from request, random password, phone verified) + `agent_referrals` row with `signup_channel='assisted'`; certified agents only; program flag off → 403 `{code:'program-inactive'}`.
- [ ] **Step 3: Implement** endpoints inside the `agent.api` group:

```php
Route::group(['prefix' => 'customers'], function () {
    Route::post('assisted/initiate', 'AgentAssistedSignupController@initiate')->middleware('throttle:15,1');
    Route::post('assisted/confirm', 'AgentAssistedSignupController@confirm')->middleware('throttle:15,1');
});
```

Controller outline (follow the OTP conventions found in Step 1):

- `initiate {phone}` → validate E.164; reject existing customer phone (409); create/update PhoneVerification with fresh OTP + expiry; `SMS_module::send()` in try/catch (log failure, still 200 in local/dev where the gateway is absent — mirror however `CustomerAuthController` handles gateway failure).
- `confirm {phone, otp, first_name, last_name}` → check OTP + expiry (same rules as existing flow); create the `User` (email null-or-placeholder per existing guest/registration conventions — READ how the customer app creates phone-first users and copy it), mark phone verified, delete the verification row, `attach($agent, $user, 'assisted')`, return the new customer's masked name + referral status. The whole user+referral creation wraps in one DB transaction.
- Both endpoints require the caller to be certified (`status === certified`), else 403 `{code:'not-certified'}`.

- [ ] **Step 4:** PASS → Commit: `feat(agent): assisted customer signup via OTP`.

### Task 7: Commission engine + order lifecycle hook

**Files:**
- Create: `app/Services/Agent/AgentCommissionService.php`
- Modify: `app/Observers/OrderObserver.php` (mirror the gamification dispatch block)
- Test: `tests/Feature/Agent/AgentCommissionServiceTest.php`

**Interfaces produced:**
- `AgentCommissionService::handleOrderDelivered(Order $order): ?AgentCommission` — null when: program inactive, no referral for `$order->user_id`, rate ≤ 0, subtotal < floor, or commission for this `order_id` already exists (idempotent). Otherwise inside one transaction: insert `confirmed` ledger row (`amount = round(subtotal * rate/100, 2)`, `rate_snapshot`, `order_amount`), increment `agents.withdrawable_balance` and `earned_total`, and if the referral is not yet activated set `status=activated`, `first_order_at=now()`.
- `AgentCommissionService::handleOrderRefunded(Order $order): ?AgentCommission` — if a confirmed, un-reversed commission exists for this order: insert a `type=reversal` row (`amount` negative, `reversal_of_id` set, `order_id` null), mark the original `status=reversed`, decrement balances. Idempotent (second call returns null).

- [ ] **Step 1: READ FIRST** — `app/Observers/OrderObserver.php` in full: which status transitions it sees, how gamification derives "delivered" and "refunded" events, and what the order's subtotal field is in this codebase (`order_amount` vs a computed subtotal — match whatever gamification/commerce logic treats as the order's goods subtotal; check `GamificationOrderEventEmitter`). Use the same field and the same transition detection.
- [ ] **Step 2: Failing tests** — accrual on delivered (balance +, referral activated); no accrual when: flag off / rate 0 / below floor / non-referred customer; idempotency (second delivered event → null, single row); clawback on refund (reversal row, balances restored, original marked reversed); clawback idempotent; ledger immutability preserved (reversal never edits amounts). Build orders via the existing commerce test helpers (`Tests\Support\CreatesCommerceTestData`) — READ one gamification test that drives order status transitions and copy its approach.
- [ ] **Step 3: Implement the service** (transactional, lockForUpdate on the agent row when mutating balances):

```php
<?php
// app/Services/Agent/AgentCommissionService.php

namespace App\Services\Agent;

use App\Models\Agent;
use App\Models\AgentCommission;
use App\Models\AgentReferral;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

class AgentCommissionService
{
    public function handleOrderDelivered(Order $order): ?AgentCommission
    {
        if (!AgentSettings::programActive()) {
            return null;
        }

        $referral = AgentReferral::where('user_id', $order->user_id)->first();
        if (!$referral) {
            return null;
        }

        $rate = AgentSettings::commissionRate();
        $subtotal = (float) $order->order_amount; // CONFIRM field in Step 1; must be goods subtotal
        if ($rate <= 0 || $subtotal < AgentSettings::commissionMinOrder()) {
            $this->activateReferralIfFirst($referral);
            return null;
        }

        if (AgentCommission::where('order_id', $order->id)->exists()) {
            return null; // idempotent
        }

        return DB::transaction(function () use ($order, $referral, $rate, $subtotal) {
            $agent = Agent::whereKey($referral->agent_id)->lockForUpdate()->first();

            $row = AgentCommission::create([
                'agent_id'      => $agent->id,
                'referral_id'   => $referral->id,
                'order_id'      => $order->id,
                'type'          => AgentCommission::TYPE_ORDER,
                'status'        => AgentCommission::STATUS_CONFIRMED,
                'order_amount'  => $subtotal,
                'rate_snapshot' => $rate,
                'amount'        => round($subtotal * $rate / 100, 2),
            ]);

            $agent->increment('withdrawable_balance', $row->amount);
            $agent->increment('earned_total', $row->amount);

            $this->activateReferralIfFirst($referral);

            return $row;
        });
    }

    public function handleOrderRefunded(Order $order): ?AgentCommission
    {
        $original = AgentCommission::where('order_id', $order->id)
            ->where('type', AgentCommission::TYPE_ORDER)
            ->where('status', AgentCommission::STATUS_CONFIRMED)
            ->first();
        if (!$original) {
            return null; // nothing to claw back, or already reversed
        }

        return DB::transaction(function () use ($original) {
            $agent = Agent::whereKey($original->agent_id)->lockForUpdate()->first();

            $reversal = AgentCommission::create([
                'agent_id'       => $agent->id,
                'referral_id'    => $original->referral_id,
                'order_id'       => null,
                'type'           => AgentCommission::TYPE_REVERSAL,
                'status'         => AgentCommission::STATUS_CONFIRMED,
                'reversal_of_id' => $original->id,
                'amount'         => -$original->amount,
                'note'           => 'Refund clawback for order #' . $original->order_id,
            ]);

            $original->status = AgentCommission::STATUS_REVERSED;
            $original->save();

            $agent->decrement('withdrawable_balance', $original->amount);
            $agent->decrement('earned_total', $original->amount);

            return $reversal;
        });
    }

    private function activateReferralIfFirst(AgentReferral $referral): void
    {
        if ($referral->status !== AgentReferral::STATUS_ACTIVATED) {
            $referral->update([
                'status'         => AgentReferral::STATUS_ACTIVATED,
                'first_order_at' => now(),
            ]);
        }
    }
}
```

- [ ] **Step 4: Hook the observer** — add a private dispatch method to `OrderObserver` modeled character-for-character on `dispatchGamificationOrderTransition` (same event detection, same try/catch-swallow with a loud `Log::error('agent-commission observer failed', ...)`), calling `handleOrderDelivered` on the delivered transition and `handleOrderRefunded` on the refund transition the gamification emitter recognizes.
- [ ] **Step 5:** PASS (whole suite: `php artisan test --filter=Agent`) → Commit: `feat(agent): commission engine with refund clawback wired to order lifecycle`.

### Task 8: Agent APIs — customers, earnings, quiz contract fixes

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentCustomerController.php`, `app/Http/Controllers/Api/V1/Agent/AgentEarningsController.php`
- Modify: `app/Http/Controllers/Api/V1/Agent/AgentQuizController.php` (retry_at on submit; new `info`)
- Modify: `routes/api/v1/api.php`
- Test: `tests/Feature/Agent/AgentEarningsApiTest.php` (+ extend `AgentQuizApiTest`)

**Endpoints produced (all `agent.api`):**
- `GET /customers` → `{customers: [{id, name_masked, signup_channel, status, joined_at, first_order_at, orders_count, commission_total}], stats: {total, activated}}` — paginated (`?page=`), name masked as "Ada O." style.
- `GET /earnings` → `{balances: {withdrawable, pending, earned_total}, ledger: [{id, type, status, amount, order_id, note, created_at}]}` — paginated ledger, newest first.
- `POST /quiz/submit` failing response gains `"retry_at": <ISO8601>` (submitted_at + cooldown).
- `GET /quiz/info` → `{question_count, pass_mark, cooldown_minutes}` (percent units; no attempt created).

- [ ] **Step 1: Failing tests** for all four (earnings math from seeded ledger rows; masked names contain no full last name; retry_at present on fail; info burns no attempt).
- [ ] **Step 2: Implement** — thin controllers over the models; `orders_count`/`commission_total` via ledger aggregates per referral (`type=order_commission`, minus reversed originals — count only `status=confirmed`).
- [ ] **Step 3:** PASS → Commit: `feat(agent): customers and earnings APIs, quiz contract fixes`.

### Task 9: Admin — referrals/ledger on agent detail + program settings screen

**Files:**
- Modify: `app/Http/Controllers/Admin/Agent/AgentController.php` (`show` eager-loads referrals + commissions)
- Modify: `resources/views/admin-views/agent/show.blade.php` (two new cards: Referred customers, Commission ledger)
- Create: `app/Http/Controllers/Admin/Agent/AgentProgramSettingController.php` + `resources/views/admin-views/agent/settings.blade.php`
- Modify: `routes/admin/routes.php`, `resources/views/layouts/admin/partials/_sidebar.blade.php` (one "Program settings" link in the existing Agent Program cluster)

- [ ] **Step 1:** Settings screen: form fields for `agent_program_active` (toggle), `agent_commission_rate` (%), `agent_commission_min_order` (₦), `agent_quiz_pass_mark`, `agent_quiz_question_count`, `agent_quiz_cooldown_minutes` — writes via `BusinessSetting::updateOrCreate`. Follow the blade idioms already established in the A1 admin views. Show a plain warning line: "Commission rate changes apply to future orders only; past commissions keep their rate snapshot."
- [ ] **Step 2:** Agent detail additions: referred customers table (masked to admins is unnecessary — full names fine here) and the ledger with type/status/amount, reversals visibly linked to their originals.
- [ ] **Step 3:** `php artisan route:list --path=admin/agent-program` — settings routes present; manual smoke of both screens locally.
- [ ] **Step 4:** Commit: `feat(agent): admin program settings and agent referral/ledger detail`.

### Task 10: Verification pass

- [ ] `php artisan db:seed --class=AgentProgramSettingsSeeder` (new keys present, rate=0).
- [ ] Full `php artisan test --filter=Agent` green; run one gamification suite file to confirm the shared OrderObserver still passes its tests.
- [ ] End-to-end local: register a customer with a real agent code via HTTP, drive an order to delivered via the commerce test helper path or tinker, confirm ledger row + balances; refund it, confirm clawback.
- [ ] Deployment notes for srv02 (after push): `php artisan migrate --force` + re-run the settings seeder. Program still gated: flag 0 AND rate 0.
- [ ] Report: diff summary per task, full Agent test output, deviations, and anything Phase B2 (PWA earnings screens) needs to know about response shapes.

---

## Out of scope

Phase B2 (PWA: customers/earnings/assisted-signup screens), Phase C (KYC + withdrawals), Phase D (challenges). WhatsApp-bot referral capture lands with the WA roadmap, not here.
