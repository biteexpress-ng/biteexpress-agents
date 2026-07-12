# Agent Program Phase A1 (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend for agent onboarding: lead approval → agent account, token auth, training videos, certification quiz, referral-code generation, and the admin screens to manage it all.

**Architecture:** New `Agent` domain inside `dashboard.bite.express` following the BiteExpense pattern (plain `app/` code, no Modules/). Token auth mirrors `delivery_man_sessions` + `DmTokenIsValid`. All tunables read from `business_settings` via a small `AgentSettings` service. API lives under `/api/v1/agent/...`; admin screens under `admin/agent-program/...`.

**Tech Stack:** Laravel (existing app), MySQL, PHPUnit feature tests with `DatabaseTransactions`.

**Spec:** `docs/specs/2026-07-13-agent-program-design.md` (this repo). This plan covers Phase A only — no referrals, commissions, KYC, withdrawals, or challenges (Phases B–D).

## Global Constraints

- **Repo:** all code in this plan goes into `C:\laragon\www\dashboard.bite.express`.
- **DANGER — auto-deploy:** a local hook auto-commits and pushes this repo to origin/main, and CI/CD deploys to production srv02 in ~1 minute. Every commit MUST leave the app bootable and existing behavior unchanged. New routes/tables are inert until admin approves an agent, which no one will do until sign-off.
- No monetary or tunable value hardcoded: quiz pass mark, question count, cooldown, and program toggle come from `business_settings` (Task 4 defines keys + defaults).
- Follow existing conventions: controllers `App\Http\Controllers\Admin\Agent\*` and `App\Http\Controllers\Api\V1\Agent\*`, views `resources/views/admin-views/agent/*`, tests `tests/Feature/Agent/*`, translations via `translate('messages.x')`.
- Referral codes: format `BX-` + 5 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L).
- Phone stored E.164 (`+234...`), consistent with the E.164 discipline from the WhatsApp roadmap.
- Never run `Stop-Process -Name php -Force` on this machine (standing environment rule). Run tests with `php artisan test --filter=...`.

---

### Task 1: Core migrations — `agents` and `agent_sessions`

**Files:**
- Create: `database/migrations/2026_07_13_100000_create_agents_table.php`
- Create: `database/migrations/2026_07_13_100001_create_agent_sessions_table.php`

**Interfaces:**
- Produces: tables `agents`, `agent_sessions` used by every later task. Column names below are canonical.

- [ ] **Step 1: Write the agents migration**

```php
<?php
// database/migrations/2026_07_13_100000_create_agents_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * BiteExpress Agent Program — Phase A.
 * Agents are field marketers who onboard customers for commission.
 * Balances / KYC columns are included now (nullable, unused until
 * Phases B/C) so we avoid a second structural migration on prod.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agents', function (Blueprint $table) {
            $table->id();
            $table->string('full_name', 160);
            $table->string('email', 200)->unique();
            $table->string('phone', 40)->unique();       // E.164
            $table->string('password')->nullable();      // null until setup completed
            $table->string('city_slug', 80)->nullable();
            $table->string('city_state', 80)->nullable();

            // pending|approved|certified|suspended
            $table->string('status', 20)->default('pending');
            $table->string('referral_code', 12)->nullable()->unique();
            $table->timestamp('certified_at')->nullable();

            $table->unsignedBigInteger('partner_lead_id')->nullable()->index();

            // Password-setup invite (hashed token)
            $table->string('setup_token', 64)->nullable()->index();
            $table->timestamp('setup_token_expires_at')->nullable();

            // Phase C placeholders (kyc + payout), inert in Phase A
            $table->string('kyc_status', 20)->default('incomplete');
            $table->string('photo', 255)->nullable();
            $table->string('identity_type', 40)->nullable();
            $table->string('identity_image', 255)->nullable();
            $table->string('bank_name', 120)->nullable();
            $table->string('bank_account_number', 40)->nullable();
            $table->string('bank_account_name', 160)->nullable();

            // Phase B placeholders (balances), inert in Phase A
            $table->decimal('earned_total', 24, 2)->default(0);
            $table->decimal('withdrawable_balance', 24, 2)->default(0);
            $table->decimal('pending_balance', 24, 2)->default(0);

            $table->timestamps();
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agents');
    }
};
```

- [ ] **Step 2: Write the agent_sessions migration** (mirror of `delivery_man_sessions`)

```php
<?php
// database/migrations/2026_07_13_100001_create_agent_sessions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->string('auth_token', 160)->unique();
            $table->string('device_label', 120)->nullable();
            $table->string('platform', 20)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('agent_id');
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_sessions');
    }
};
```

- [ ] **Step 3: Run the migrations locally**

Run: `php artisan migrate`
Expected: both migrations run without error.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_07_13_100000_create_agents_table.php database/migrations/2026_07_13_100001_create_agent_sessions_table.php
git commit -m "feat(agent): agents and agent_sessions tables (Phase A1)"
```

---

### Task 2: Training + quiz migrations

**Files:**
- Create: `database/migrations/2026_07_13_100002_create_agent_training_videos_table.php`
- Create: `database/migrations/2026_07_13_100003_create_agent_training_progress_table.php`
- Create: `database/migrations/2026_07_13_100004_create_agent_quiz_questions_table.php`
- Create: `database/migrations/2026_07_13_100005_create_agent_quiz_attempts_table.php`

**Interfaces:**
- Produces: tables `agent_training_videos(id, youtube_video_id, title, sort_order, duration_seconds, is_active)`, `agent_training_progress(agent_id, video_id unique pair, watched_at)`, `agent_quiz_questions(question, options json, correct_index, is_active)`, `agent_quiz_attempts(agent_id, status in_progress|passed|failed, questions json, answers json, score, submitted_at)`.

- [ ] **Step 1: Write all four migrations**

```php
<?php
// database/migrations/2026_07_13_100002_create_agent_training_videos_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_training_videos', function (Blueprint $table) {
            $table->id();
            $table->string('youtube_video_id', 20);
            $table->string('title', 200);
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_training_videos');
    }
};
```

```php
<?php
// database/migrations/2026_07_13_100003_create_agent_training_progress_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_training_progress', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->unsignedBigInteger('video_id');
            $table->timestamp('watched_at');
            $table->timestamps();

            $table->unique(['agent_id', 'video_id']);
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
            $table->foreign('video_id')->references('id')->on('agent_training_videos')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_training_progress');
    }
};
```

```php
<?php
// database/migrations/2026_07_13_100004_create_agent_quiz_questions_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_quiz_questions', function (Blueprint $table) {
            $table->id();
            $table->text('question');
            $table->json('options');                 // exactly 4 strings
            $table->unsignedTinyInteger('correct_index'); // 0..3
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_quiz_questions');
    }
};
```

```php
<?php
// database/migrations/2026_07_13_100005_create_agent_quiz_attempts_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_quiz_attempts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('agent_id');
            $table->string('status', 20)->default('in_progress'); // in_progress|passed|failed
            $table->json('questions');   // [question_id, ...] served to the agent
            $table->json('answers')->nullable(); // {question_id: chosen_index}
            $table->unsignedTinyInteger('score')->nullable(); // percentage 0-100
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['agent_id', 'created_at']);
            $table->foreign('agent_id')->references('id')->on('agents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agent_quiz_attempts');
    }
};
```

- [ ] **Step 2: Run migrations**

Run: `php artisan migrate`
Expected: four migrations run without error.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_07_13_1000*.php
git commit -m "feat(agent): training and quiz tables (Phase A1)"
```

---

### Task 3: Models

**Files:**
- Create: `app/Models/Agent.php`
- Create: `app/Models/AgentSession.php`
- Create: `app/Models/AgentTrainingVideo.php`
- Create: `app/Models/AgentTrainingProgress.php`
- Create: `app/Models/AgentQuizQuestion.php`
- Create: `app/Models/AgentQuizAttempt.php`
- Test: `tests/Feature/Agent/AgentModelTest.php`

**Interfaces:**
- Produces: `Agent` with constants `STATUS_PENDING/APPROVED/CERTIFIED/SUSPENDED`, relations `sessions()`, `trainingProgress()`, `quizAttempts()`, helper `trainingComplete(): bool`, static `generateReferralCode(): string`. Other models are plain Eloquent with casts as shown.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AgentModelTest.php

namespace Tests\Feature\Agent;

use App\Models\Agent;
use App\Models\AgentTrainingProgress;
use App\Models\AgentTrainingVideo;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AgentModelTest extends TestCase
{
    use DatabaseTransactions;

    private function makeAgent(array $attrs = []): Agent
    {
        return Agent::create(array_merge([
            'full_name' => 'Test Agent',
            'email'     => 'agent' . uniqid() . '@test.com',
            'phone'     => '+23480' . random_int(10000000, 99999999),
            'status'    => Agent::STATUS_APPROVED,
        ], $attrs));
    }

    public function test_referral_code_generation_format_and_uniqueness(): void
    {
        $code = Agent::generateReferralCode();
        $this->assertMatchesRegularExpression('/^BX-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/', $code);
        $this->assertNotEquals($code, Agent::generateReferralCode());
    }

    public function test_training_complete_reflects_active_videos_watched(): void
    {
        $agent = $this->makeAgent();
        $v1 = AgentTrainingVideo::create(['youtube_video_id' => 'abc12345678', 'title' => 'Intro', 'sort_order' => 1]);
        $v2 = AgentTrainingVideo::create(['youtube_video_id' => 'def12345678', 'title' => 'Apps', 'sort_order' => 2]);
        AgentTrainingVideo::create(['youtube_video_id' => 'ghi12345678', 'title' => 'Old', 'is_active' => false]);

        $this->assertFalse($agent->trainingComplete());

        AgentTrainingProgress::create(['agent_id' => $agent->id, 'video_id' => $v1->id, 'watched_at' => now()]);
        $this->assertFalse($agent->trainingComplete());

        AgentTrainingProgress::create(['agent_id' => $agent->id, 'video_id' => $v2->id, 'watched_at' => now()]);
        $this->assertTrue($agent->trainingComplete());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AgentModelTest`
Expected: FAIL — class `App\Models\Agent` not found.

- [ ] **Step 3: Write the models**

```php
<?php
// app/Models/Agent.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Agent extends Model
{
    public const STATUS_PENDING   = 'pending';
    public const STATUS_APPROVED  = 'approved';
    public const STATUS_CERTIFIED = 'certified';
    public const STATUS_SUSPENDED = 'suspended';

    /** Charset excludes ambiguous 0/O/1/I/L. */
    private const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    protected $guarded = ['id'];

    protected $hidden = ['password', 'setup_token'];

    protected $casts = [
        'certified_at'            => 'datetime',
        'setup_token_expires_at'  => 'datetime',
        'earned_total'            => 'float',
        'withdrawable_balance'    => 'float',
        'pending_balance'         => 'float',
    ];

    public function sessions()
    {
        return $this->hasMany(AgentSession::class);
    }

    public function trainingProgress()
    {
        return $this->hasMany(AgentTrainingProgress::class);
    }

    public function quizAttempts()
    {
        return $this->hasMany(AgentQuizAttempt::class);
    }

    public function partnerLead()
    {
        return $this->belongsTo(PartnerLead::class);
    }

    public function trainingComplete(): bool
    {
        $activeIds = AgentTrainingVideo::where('is_active', true)->pluck('id');
        if ($activeIds->isEmpty()) {
            return false;
        }
        $watched = $this->trainingProgress()->whereIn('video_id', $activeIds)->count();
        return $watched >= $activeIds->count();
    }

    public static function generateReferralCode(): string
    {
        do {
            $code = 'BX-';
            for ($i = 0; $i < 5; $i++) {
                $code .= self::CODE_CHARSET[random_int(0, strlen(self::CODE_CHARSET) - 1)];
            }
        } while (self::where('referral_code', $code)->exists());

        return $code;
    }
}
```

```php
<?php
// app/Models/AgentSession.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentSession extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['last_used_at' => 'datetime'];

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }
}
```

```php
<?php
// app/Models/AgentTrainingVideo.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentTrainingVideo extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['is_active' => 'boolean'];

    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }
}
```

```php
<?php
// app/Models/AgentTrainingProgress.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentTrainingProgress extends Model
{
    protected $table = 'agent_training_progress';

    protected $guarded = ['id'];

    protected $casts = ['watched_at' => 'datetime'];
}
```

```php
<?php
// app/Models/AgentQuizQuestion.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentQuizQuestion extends Model
{
    protected $guarded = ['id'];

    protected $casts = ['options' => 'array', 'is_active' => 'boolean'];
}
```

```php
<?php
// app/Models/AgentQuizAttempt.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AgentQuizAttempt extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_PASSED      = 'passed';
    public const STATUS_FAILED      = 'failed';

    protected $guarded = ['id'];

    protected $casts = [
        'questions'    => 'array',
        'answers'      => 'array',
        'submitted_at' => 'datetime',
    ];

    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=AgentModelTest`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Models/Agent*.php tests/Feature/Agent/AgentModelTest.php
git commit -m "feat(agent): Agent domain models (Phase A1)"
```

---

### Task 4: Settings service + business_settings defaults

**Files:**
- Create: `app/Services/Agent/AgentSettings.php`
- Create: `database/seeders/AgentProgramSettingsSeeder.php`
- Test: `tests/Feature/Agent/AgentSettingsTest.php`

**Interfaces:**
- Produces: `AgentSettings::quizPassMark(): int` (default 75), `AgentSettings::quizQuestionCount(): int` (default 10), `AgentSettings::quizCooldownMinutes(): int` (default 60), `AgentSettings::programActive(): bool` (default false). Reads `business_settings` keys `agent_quiz_pass_mark`, `agent_quiz_question_count`, `agent_quiz_cooldown_minutes`, `agent_program_active` via `BusinessSetting` model, falling back to defaults when rows are absent.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AgentSettingsTest.php

namespace Tests\Feature\Agent;

use App\Models\BusinessSetting;
use App\Services\Agent\AgentSettings;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AgentSettingsTest extends TestCase
{
    use DatabaseTransactions;

    public function test_defaults_apply_when_rows_missing(): void
    {
        BusinessSetting::whereIn('key', [
            'agent_quiz_pass_mark', 'agent_quiz_question_count',
            'agent_quiz_cooldown_minutes', 'agent_program_active',
        ])->delete();

        $this->assertSame(75, AgentSettings::quizPassMark());
        $this->assertSame(10, AgentSettings::quizQuestionCount());
        $this->assertSame(60, AgentSettings::quizCooldownMinutes());
        $this->assertFalse(AgentSettings::programActive());
    }

    public function test_business_settings_rows_override_defaults(): void
    {
        BusinessSetting::updateOrCreate(['key' => 'agent_quiz_pass_mark'], ['value' => '80']);
        BusinessSetting::updateOrCreate(['key' => 'agent_program_active'], ['value' => '1']);

        $this->assertSame(80, AgentSettings::quizPassMark());
        $this->assertTrue(AgentSettings::programActive());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AgentSettingsTest`
Expected: FAIL — class `AgentSettings` not found.

- [ ] **Step 3: Write the service and seeder**

```php
<?php
// app/Services/Agent/AgentSettings.php

namespace App\Services\Agent;

use App\Models\BusinessSetting;

/**
 * All agent-program tunables live in business_settings so finance/ops
 * can change them from the admin panel without a deploy (spec §2).
 */
class AgentSettings
{
    public static function quizPassMark(): int
    {
        return (int) self::raw('agent_quiz_pass_mark', '75');
    }

    public static function quizQuestionCount(): int
    {
        return (int) self::raw('agent_quiz_question_count', '10');
    }

    public static function quizCooldownMinutes(): int
    {
        return (int) self::raw('agent_quiz_cooldown_minutes', '60');
    }

    public static function programActive(): bool
    {
        return (bool) self::raw('agent_program_active', '0');
    }

    private static function raw(string $key, string $default): string
    {
        $row = BusinessSetting::where('key', $key)->first();
        return $row?->value ?? $default;
    }
}
```

```php
<?php
// database/seeders/AgentProgramSettingsSeeder.php

namespace Database\Seeders;

use App\Models\BusinessSetting;
use Illuminate\Database\Seeder;

class AgentProgramSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'agent_quiz_pass_mark'        => '75',
            'agent_quiz_question_count'   => '10',
            'agent_quiz_cooldown_minutes' => '60',
            'agent_program_active'        => '0',
        ];
        foreach ($defaults as $key => $value) {
            BusinessSetting::firstOrCreate(['key' => $key], ['value' => $value]);
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=AgentSettingsTest`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/Agent/AgentSettings.php database/seeders/AgentProgramSettingsSeeder.php tests/Feature/Agent/AgentSettingsTest.php
git commit -m "feat(agent): AgentSettings service with business_settings keys"
```

---

### Task 5: Lead approval service — partner lead → agent account + invite email

**Files:**
- Create: `app/Services/Agent/AgentOnboardingService.php`
- Create: `app/Mail/AgentAccountApprovedMail.php`
- Create: `resources/views/email-templates/agent-account-approved.blade.php`
- Modify: `config/app.php` (add `agents_url` key)
- Test: `tests/Feature/Agent/AgentOnboardingServiceTest.php`

**Interfaces:**
- Consumes: `PartnerLead` model (existing), `Agent` (Task 3).
- Produces: `AgentOnboardingService::approveFromLead(PartnerLead $lead, ?int $adminId): Agent` — throws `InvalidArgumentException` if lead audience is not `agent` or already converted, or if an agent with the same email/phone exists. Creates agent (status `approved`), sets hashed `setup_token` (plain token emailed, sha256 stored), 72h expiry, marks lead converted (`converted_to_type='agent'`), sends `AgentAccountApprovedMail` (failure logged, never thrown). Returns the plain setup token via `$agent->plain_setup_token` transient attribute for testability.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AgentOnboardingServiceTest.php

namespace Tests\Feature\Agent;

use App\Mail\AgentAccountApprovedMail;
use App\Models\Agent;
use App\Models\PartnerLead;
use App\Services\Agent\AgentOnboardingService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use InvalidArgumentException;
use Tests\TestCase;

class AgentOnboardingServiceTest extends TestCase
{
    use DatabaseTransactions;

    private function makeLead(array $attrs = []): PartnerLead
    {
        return PartnerLead::create(array_merge([
            'audience'  => 'agent',
            'status'    => 'new',
            'full_name' => 'Ada Agent',
            'email'     => 'ada' . uniqid() . '@test.com',
            'phone'     => '+23480' . random_int(10000000, 99999999),
            'city_slug' => 'uyo',
            'source'    => 'web',
        ], $attrs));
    }

    public function test_approve_creates_agent_converts_lead_and_sends_invite(): void
    {
        Mail::fake();
        $lead = $this->makeLead();

        $agent = app(AgentOnboardingService::class)->approveFromLead($lead, null);

        $this->assertSame(Agent::STATUS_APPROVED, $agent->status);
        $this->assertSame($lead->email, $agent->email);
        $this->assertNotNull($agent->setup_token);
        $this->assertNotNull($agent->plain_setup_token);
        $this->assertSame(hash('sha256', $agent->plain_setup_token), $agent->setup_token);

        $lead->refresh();
        $this->assertSame('converted', $lead->status);
        $this->assertSame('agent', $lead->converted_to_type);
        $this->assertSame($agent->id, (int) $lead->converted_to_id);
        $this->assertNotNull($lead->converted_at);

        Mail::assertQueued(AgentAccountApprovedMail::class) || Mail::assertSent(AgentAccountApprovedMail::class);
    }

    public function test_rejects_non_agent_or_converted_leads_and_duplicates(): void
    {
        Mail::fake();
        $svc = app(AgentOnboardingService::class);

        $vendorLead = $this->makeLead(['audience' => 'vendor']);
        $this->expectException(InvalidArgumentException::class);
        $svc->approveFromLead($vendorLead, null);
    }

    public function test_rejects_duplicate_email(): void
    {
        Mail::fake();
        $svc = app(AgentOnboardingService::class);
        $lead1 = $this->makeLead();
        $agent = $svc->approveFromLead($lead1, null);

        $lead2 = $this->makeLead(['email' => $agent->email]);
        $this->expectException(InvalidArgumentException::class);
        $svc->approveFromLead($lead2, null);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AgentOnboardingServiceTest`
Expected: FAIL — class `AgentOnboardingService` not found.

- [ ] **Step 3: Write service, mailable, template, config key**

Add to `config/app.php` (near other custom keys at the bottom of the array):

```php
'agents_url' => env('AGENTS_APP_URL', 'https://agents.bite.express'),
```

```php
<?php
// app/Services/Agent/AgentOnboardingService.php

namespace App\Services\Agent;

use App\Mail\AgentAccountApprovedMail;
use App\Models\Agent;
use App\Models\PartnerLead;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use InvalidArgumentException;

class AgentOnboardingService
{
    public function approveFromLead(PartnerLead $lead, ?int $adminId): Agent
    {
        if ($lead->audience !== 'agent') {
            throw new InvalidArgumentException('Lead is not an agent application.');
        }
        if ($lead->converted_at !== null || $lead->status === 'converted') {
            throw new InvalidArgumentException('Lead has already been converted.');
        }
        if (Agent::where('email', $lead->email)->orWhere('phone', $lead->phone)->exists()) {
            throw new InvalidArgumentException('An agent with this email or phone already exists.');
        }

        $plainToken = Str::random(48);

        $agent = DB::transaction(function () use ($lead, $adminId, $plainToken) {
            $agent = Agent::create([
                'full_name'               => $lead->full_name,
                'email'                   => $lead->email,
                'phone'                   => $lead->phone,
                'city_slug'               => $lead->city_slug,
                'city_state'              => $lead->city_state,
                'status'                  => Agent::STATUS_APPROVED,
                'partner_lead_id'         => $lead->id,
                'setup_token'             => hash('sha256', $plainToken),
                'setup_token_expires_at'  => now()->addHours(72),
            ]);

            $lead->update([
                'status'            => 'converted',
                'converted_to_type' => 'agent',
                'converted_to_id'   => $agent->id,
                'converted_at'      => now(),
                'assigned_admin_id' => $adminId ?? $lead->assigned_admin_id,
            ]);

            return $agent;
        });

        $setupUrl = rtrim(config('app.agents_url'), '/')
            . '/setup-password?token=' . $plainToken
            . '&email=' . urlencode($agent->email);

        try {
            Mail::to($agent->email)->send(new AgentAccountApprovedMail($agent, $setupUrl));
        } catch (\Throwable $e) {
            Log::error('agent-onboarding: invite email failed', [
                'agent_id' => $agent->id, 'error' => $e->getMessage(),
            ]);
        }

        // Transient, for admin display + tests; not persisted.
        $agent->plain_setup_token = $plainToken;

        return $agent;
    }
}
```

```php
<?php
// app/Mail/AgentAccountApprovedMail.php

namespace App\Mail;

use App\Models\Agent;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AgentAccountApprovedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Agent $agent, public string $setupUrl)
    {
    }

    public function build()
    {
        return $this->subject('Your BiteExpress Agent account is approved')
            ->view('email-templates.agent-account-approved', [
                'agent'    => $this->agent,
                'setupUrl' => $this->setupUrl,
            ]);
    }
}
```

```blade
{{-- resources/views/email-templates/agent-account-approved.blade.php --}}
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #111;">Welcome to the BiteExpress Agent Program!</h2>
    <p>Hi {{ $agent->full_name }},</p>
    <p>Your application has been approved. Set your password to access your agent dashboard, complete your training, and get certified.</p>
    <p style="margin: 28px 0;">
        <a href="{{ $setupUrl }}" style="background: #ef7822; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Set my password</a>
    </p>
    <p>This link expires in 72 hours. If it expires, contact support and we will send a new one.</p>
    <p>— The BiteExpress Team</p>
</div>
```

Note: `plain_setup_token` is a non-persisted dynamic attribute; Eloquent allows setting unknown attributes on an instance without saving. Do NOT add it to `$fillable` or the table.

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=AgentOnboardingServiceTest`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Services/Agent/AgentOnboardingService.php app/Mail/AgentAccountApprovedMail.php resources/views/email-templates/agent-account-approved.blade.php config/app.php tests/Feature/Agent/AgentOnboardingServiceTest.php
git commit -m "feat(agent): lead approval service with invite email"
```

---

### Task 6: Agent token middleware

**Files:**
- Create: `app/Http/Middleware/AgentTokenIsValid.php`
- Modify: `app/Http/Kernel.php` (register alias `agent.api` in `$routeMiddleware` / `$middlewareAliases`, next to the existing `vendor.api` / dm entries)

**Interfaces:**
- Consumes: `AgentSession` (Task 3).
- Produces: middleware alias `agent.api`. On valid `Authorization: Bearer <token>`, resolves the session, touches `last_used_at`, and injects the agent via `$request->merge(['agent' => $agent])` plus `$request->setUserResolver(fn () => $agent)`. Rejects with 401 JSON `{errors: [{code:'auth-001', message:'Unauthorized.'}]}` when the token is missing/unknown, or 403 with code `agent-suspended` when the agent is suspended. Model the response shape on `DmTokenIsValid` (read that file first and match its error JSON exactly).

- [ ] **Step 1: Read the existing pattern**

Read `app/Http/Middleware/DmTokenIsValid.php` fully. Match its structure and error response shape.

- [ ] **Step 2: Write the middleware**

```php
<?php
// app/Http/Middleware/AgentTokenIsValid.php

namespace App\Http\Middleware;

use App\Models\Agent;
use App\Models\AgentSession;
use Closure;
use Illuminate\Http\Request;

class AgentTokenIsValid
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json(['errors' => [
                ['code' => 'auth-001', 'message' => translate('messages.unauthorized')],
            ]], 401);
        }

        $session = AgentSession::where('auth_token', $token)->first();
        if (!$session || !$session->agent) {
            return response()->json(['errors' => [
                ['code' => 'auth-001', 'message' => translate('messages.unauthorized')],
            ]], 401);
        }

        $agent = $session->agent;
        if ($agent->status === Agent::STATUS_SUSPENDED) {
            return response()->json(['errors' => [
                ['code' => 'agent-suspended', 'message' => translate('messages.account_suspended')],
            ]], 403);
        }

        $session->forceFill(['last_used_at' => now()])->saveQuietly();

        $request->merge(['agent' => $agent]);
        $request->setUserResolver(fn () => $agent);

        return $next($request);
    }
}
```

- [ ] **Step 3: Register the alias in `app/Http/Kernel.php`**

Find the array containing `'vendor.api' => ...` and add alongside:

```php
'agent.api' => \App\Http\Middleware\AgentTokenIsValid::class,
```

- [ ] **Step 4: Sanity check**

Run: `php artisan route:list --path=api/v1/agent`
Expected: no error (no routes yet — command must not crash).

- [ ] **Step 5: Commit**

```bash
git add app/Http/Middleware/AgentTokenIsValid.php app/Http/Kernel.php
git commit -m "feat(agent): agent.api token middleware"
```

---

### Task 7: Auth API — setup password, login, logout, me

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentAuthController.php`
- Modify: `routes/api/v1/api.php` (add agent route group; place near the vendor groups)
- Test: `tests/Feature/Agent/AgentAuthApiTest.php`

**Interfaces:**
- Consumes: `Agent`, `AgentSession`, middleware `agent.api` (Task 6).
- Produces endpoints:
  - `POST /api/v1/agent/auth/setup-password` `{email, token, password, password_confirmation}` → 200 `{message}`; 400 on invalid/expired token.
  - `POST /api/v1/agent/auth/login` `{login (email or E.164 phone), password}` → 200 `{token, agent: {id, full_name, email, phone, status, referral_code, training_complete, certified}}`; 401 on bad credentials; 403 when suspended.
  - `POST /api/v1/agent/auth/logout` (auth) → 200.
  - `GET /api/v1/agent/me` (auth) → same agent payload as login. Later tasks reuse the payload builder `AgentAuthController::agentPayload(Agent $agent): array`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AgentAuthApiTest.php

namespace Tests\Feature\Agent;

use App\Models\Agent;
use App\Models\AgentSession;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AgentAuthApiTest extends TestCase
{
    use DatabaseTransactions;

    private function makeAgent(array $attrs = []): Agent
    {
        return Agent::create(array_merge([
            'full_name' => 'Auth Agent',
            'email'     => 'auth' . uniqid() . '@test.com',
            'phone'     => '+23480' . random_int(10000000, 99999999),
            'status'    => Agent::STATUS_APPROVED,
            'password'  => Hash::make('Secret123!'),
        ], $attrs));
    }

    public function test_setup_password_with_valid_token(): void
    {
        $plain = Str::random(48);
        $agent = $this->makeAgent([
            'password'                => null,
            'setup_token'             => hash('sha256', $plain),
            'setup_token_expires_at'  => now()->addHour(),
        ]);

        $res = $this->postJson('/api/v1/agent/auth/setup-password', [
            'email' => $agent->email,
            'token' => $plain,
            'password' => 'NewSecret123!',
            'password_confirmation' => 'NewSecret123!',
        ]);

        $res->assertOk();
        $agent->refresh();
        $this->assertTrue(Hash::check('NewSecret123!', $agent->password));
        $this->assertNull($agent->setup_token);
    }

    public function test_setup_password_rejects_expired_token(): void
    {
        $plain = Str::random(48);
        $agent = $this->makeAgent([
            'password'                => null,
            'setup_token'             => hash('sha256', $plain),
            'setup_token_expires_at'  => now()->subMinute(),
        ]);

        $this->postJson('/api/v1/agent/auth/setup-password', [
            'email' => $agent->email,
            'token' => $plain,
            'password' => 'NewSecret123!',
            'password_confirmation' => 'NewSecret123!',
        ])->assertStatus(400);
    }

    public function test_login_returns_token_and_flags(): void
    {
        $agent = $this->makeAgent();

        $res = $this->postJson('/api/v1/agent/auth/login', [
            'login' => $agent->email, 'password' => 'Secret123!',
        ]);

        $res->assertOk()
            ->assertJsonStructure(['token', 'agent' => ['id', 'full_name', 'status', 'training_complete', 'certified']]);
        $this->assertDatabaseHas('agent_sessions', ['agent_id' => $agent->id]);
    }

    public function test_login_rejects_bad_password_and_suspended(): void
    {
        $agent = $this->makeAgent();
        $this->postJson('/api/v1/agent/auth/login', ['login' => $agent->email, 'password' => 'wrong'])
            ->assertStatus(401);

        $suspended = $this->makeAgent(['status' => Agent::STATUS_SUSPENDED]);
        $this->postJson('/api/v1/agent/auth/login', ['login' => $suspended->email, 'password' => 'Secret123!'])
            ->assertStatus(403);
    }

    public function test_me_requires_token_and_returns_profile(): void
    {
        $this->getJson('/api/v1/agent/me')->assertStatus(401);

        $agent = $this->makeAgent();
        $session = AgentSession::create(['agent_id' => $agent->id, 'auth_token' => Str::random(80)]);

        $this->getJson('/api/v1/agent/me', ['Authorization' => 'Bearer ' . $session->auth_token])
            ->assertOk()->assertJsonPath('agent.id', $agent->id);
    }

    public function test_logout_revokes_session(): void
    {
        $agent = $this->makeAgent();
        $session = AgentSession::create(['agent_id' => $agent->id, 'auth_token' => Str::random(80)]);

        $this->postJson('/api/v1/agent/auth/logout', [], ['Authorization' => 'Bearer ' . $session->auth_token])
            ->assertOk();
        $this->assertDatabaseMissing('agent_sessions', ['id' => $session->id]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AgentAuthApiTest`
Expected: FAIL — 404s (routes not defined).

- [ ] **Step 3: Write the controller**

```php
<?php
// app/Http/Controllers/Api/V1/Agent/AgentAuthController.php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AgentSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AgentAuthController extends Controller
{
    public static function agentPayload(Agent $agent): array
    {
        return [
            'id'                => $agent->id,
            'full_name'         => $agent->full_name,
            'email'             => $agent->email,
            'phone'             => $agent->phone,
            'status'            => $agent->status,
            'referral_code'     => $agent->referral_code,
            'training_complete' => $agent->trainingComplete(),
            'certified'         => $agent->status === Agent::STATUS_CERTIFIED,
        ];
    }

    public function setupPassword(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'token'    => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $agent = Agent::where('email', $request->email)
            ->where('setup_token', hash('sha256', $request->token))
            ->first();

        if (!$agent || !$agent->setup_token_expires_at || $agent->setup_token_expires_at->isPast()) {
            return response()->json(['errors' => [
                ['code' => 'setup-001', 'message' => translate('messages.invalid_or_expired_token')],
            ]], 400);
        }

        $agent->update([
            'password'               => Hash::make($request->password),
            'setup_token'            => null,
            'setup_token_expires_at' => null,
        ]);

        return response()->json(['message' => translate('messages.password_set_successfully')]);
    }

    public function login(Request $request)
    {
        $request->validate([
            'login'    => 'required|string',
            'password' => 'required|string',
        ]);

        $agent = Agent::where('email', $request->login)
            ->orWhere('phone', $request->login)
            ->first();

        if (!$agent || !$agent->password || !Hash::check($request->password, $agent->password)) {
            return response()->json(['errors' => [
                ['code' => 'auth-002', 'message' => translate('messages.invalid_credentials')],
            ]], 401);
        }

        if ($agent->status === Agent::STATUS_SUSPENDED) {
            return response()->json(['errors' => [
                ['code' => 'agent-suspended', 'message' => translate('messages.account_suspended')],
            ]], 403);
        }

        $session = AgentSession::create([
            'agent_id'     => $agent->id,
            'auth_token'   => Str::random(80),
            'device_label' => substr((string) $request->header('User-Agent'), 0, 120),
            'platform'     => $request->input('platform'),
            'last_used_at' => now(),
        ]);

        return response()->json([
            'token' => $session->auth_token,
            'agent' => self::agentPayload($agent),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['agent' => self::agentPayload($request->user())]);
    }

    public function logout(Request $request)
    {
        AgentSession::where('auth_token', $request->bearerToken())->delete();
        return response()->json(['message' => translate('messages.logged_out')]);
    }
}
```

- [ ] **Step 4: Register routes**

In `routes/api/v1/api.php`, after the vendor route groups (near line 240), add:

```php
// BiteExpress Agent Program (Phase A) — agents.bite.express PWA
Route::group(['prefix' => 'agent', 'namespace' => 'Agent'], function () {
    Route::group(['prefix' => 'auth'], function () {
        Route::post('setup-password', 'AgentAuthController@setupPassword')->middleware('throttle:10,1');
        Route::post('login', 'AgentAuthController@login')->middleware('throttle:10,1');
        Route::post('logout', 'AgentAuthController@logout')->middleware('agent.api');
    });
    Route::group(['middleware' => 'agent.api'], function () {
        Route::get('me', 'AgentAuthController@me');
    });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test --filter=AgentAuthApiTest`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Api/V1/Agent/AgentAuthController.php routes/api/v1/api.php tests/Feature/Agent/AgentAuthApiTest.php
git commit -m "feat(agent): auth API (setup-password, login, logout, me)"
```

---

### Task 8: Training API — list videos, mark watched

**Files:**
- Create: `app/Http/Controllers/Api/V1/Agent/AgentTrainingController.php`
- Modify: `routes/api/v1/api.php` (extend the `agent.api` group from Task 7)
- Test: `tests/Feature/Agent/AgentTrainingApiTest.php`

**Interfaces:**
- Consumes: `agent.api` middleware, `AgentTrainingVideo`, `AgentTrainingProgress`.
- Produces:
  - `GET /api/v1/agent/training/videos` → `{videos: [{id, youtube_video_id, title, sort_order, duration_seconds, watched}], training_complete: bool}` (active videos only, ordered).
  - `POST /api/v1/agent/training/videos/{id}/watch` → 200 `{watched: true, training_complete: bool}`; idempotent; 404 for inactive/unknown video.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AgentTrainingApiTest.php

namespace Tests\Feature\Agent;

use App\Models\Agent;
use App\Models\AgentSession;
use App\Models\AgentTrainingVideo;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AgentTrainingApiTest extends TestCase
{
    use DatabaseTransactions;

    private Agent $agent;
    private array $headers;

    protected function setUp(): void
    {
        parent::setUp();
        $this->agent = Agent::create([
            'full_name' => 'Train Agent',
            'email'     => 'train' . uniqid() . '@test.com',
            'phone'     => '+23480' . random_int(10000000, 99999999),
            'status'    => Agent::STATUS_APPROVED,
            'password'  => Hash::make('Secret123!'),
        ]);
        $session = AgentSession::create(['agent_id' => $this->agent->id, 'auth_token' => Str::random(80)]);
        $this->headers = ['Authorization' => 'Bearer ' . $session->auth_token];
    }

    public function test_lists_active_videos_with_watch_state(): void
    {
        AgentTrainingVideo::query()->update(['is_active' => false]); // isolate
        $v = AgentTrainingVideo::create(['youtube_video_id' => 'vid00000001', 'title' => 'Ecosystem', 'sort_order' => 1]);
        AgentTrainingVideo::create(['youtube_video_id' => 'vid00000002', 'title' => 'Retired', 'is_active' => false]);

        $res = $this->getJson('/api/v1/agent/training/videos', $this->headers);
        $res->assertOk()
            ->assertJsonCount(1, 'videos')
            ->assertJsonPath('videos.0.id', $v->id)
            ->assertJsonPath('videos.0.watched', false)
            ->assertJsonPath('training_complete', false);
    }

    public function test_mark_watched_is_idempotent_and_completes_training(): void
    {
        AgentTrainingVideo::query()->update(['is_active' => false]);
        $v = AgentTrainingVideo::create(['youtube_video_id' => 'vid00000003', 'title' => 'Only One', 'sort_order' => 1]);

        $this->postJson("/api/v1/agent/training/videos/{$v->id}/watch", [], $this->headers)
            ->assertOk()->assertJsonPath('training_complete', true);

        // Second call must not error (idempotent)
        $this->postJson("/api/v1/agent/training/videos/{$v->id}/watch", [], $this->headers)
            ->assertOk();

        $this->assertSame(1, $this->agent->trainingProgress()->count());
    }

    public function test_watch_unknown_or_inactive_video_is_404(): void
    {
        $inactive = AgentTrainingVideo::create(['youtube_video_id' => 'vid00000004', 'title' => 'Off', 'is_active' => false]);
        $this->postJson("/api/v1/agent/training/videos/{$inactive->id}/watch", [], $this->headers)->assertStatus(404);
        $this->postJson('/api/v1/agent/training/videos/999999/watch', [], $this->headers)->assertStatus(404);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AgentTrainingApiTest`
Expected: FAIL — 404 (routes not defined).

- [ ] **Step 3: Write controller + routes**

```php
<?php
// app/Http/Controllers/Api/V1/Agent/AgentTrainingController.php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Http\Controllers\Controller;
use App\Models\AgentTrainingProgress;
use App\Models\AgentTrainingVideo;
use Illuminate\Http\Request;

class AgentTrainingController extends Controller
{
    public function videos(Request $request)
    {
        $agent = $request->user();
        $watchedIds = $agent->trainingProgress()->pluck('video_id')->all();

        $videos = AgentTrainingVideo::active()->get()->map(fn ($v) => [
            'id'               => $v->id,
            'youtube_video_id' => $v->youtube_video_id,
            'title'            => $v->title,
            'sort_order'       => $v->sort_order,
            'duration_seconds' => $v->duration_seconds,
            'watched'          => in_array($v->id, $watchedIds, true),
        ]);

        return response()->json([
            'videos'            => $videos,
            'training_complete' => $agent->trainingComplete(),
        ]);
    }

    public function watch(Request $request, $id)
    {
        $agent = $request->user();
        $video = AgentTrainingVideo::where('is_active', true)->find($id);
        if (!$video) {
            return response()->json(['errors' => [
                ['code' => 'training-001', 'message' => translate('messages.video_not_found')],
            ]], 404);
        }

        AgentTrainingProgress::firstOrCreate(
            ['agent_id' => $agent->id, 'video_id' => $video->id],
            ['watched_at' => now()]
        );

        return response()->json([
            'watched'           => true,
            'training_complete' => $agent->trainingComplete(),
        ]);
    }
}
```

Extend the `agent.api` group in `routes/api/v1/api.php` (inside the group added in Task 7):

```php
Route::group(['prefix' => 'training'], function () {
    Route::get('videos', 'AgentTrainingController@videos');
    Route::post('videos/{id}/watch', 'AgentTrainingController@watch');
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=AgentTrainingApiTest`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Api/V1/Agent/AgentTrainingController.php routes/api/v1/api.php tests/Feature/Agent/AgentTrainingApiTest.php
git commit -m "feat(agent): training videos API"
```

---

### Task 9: Quiz API — start, submit, certification + referral code

**Files:**
- Create: `app/Services/Agent/AgentQuizService.php`
- Create: `app/Http/Controllers/Api/V1/Agent/AgentQuizController.php`
- Modify: `routes/api/v1/api.php` (extend `agent.api` group)
- Test: `tests/Feature/Agent/AgentQuizApiTest.php`

**Interfaces:**
- Consumes: `AgentSettings` (Task 4): `quizPassMark()`, `quizQuestionCount()`, `quizCooldownMinutes()`; `Agent::generateReferralCode()`, `Agent::trainingComplete()`.
- Produces:
  - `AgentQuizService::start(Agent $agent): AgentQuizAttempt` — throws `\RuntimeException('training-incomplete')`, `('cooldown')`, `('no-questions')`, `('already-certified')`.
  - `AgentQuizService::submit(Agent $agent, AgentQuizAttempt $attempt, array $answers): AgentQuizAttempt` — grades, sets status passed/failed + score; on pass certifies agent (status `certified`, `certified_at`, `referral_code`). Idempotent guard: submitting a non-in_progress attempt throws `\RuntimeException('already-submitted')`.
  - `GET /api/v1/agent/quiz/start` → 200 `{attempt_id, pass_mark, questions: [{id, question, options}]}` (no `correct_index` leaked!); 403 `{code}` on any RuntimeException above (code = exception message), with `retry_at` included for `cooldown`.
  - `POST /api/v1/agent/quiz/submit` `{attempt_id, answers: {qid: index}}` → 200 `{status, score, pass_mark, certified, referral_code}`.

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AgentQuizApiTest.php

namespace Tests\Feature\Agent;

use App\Models\Agent;
use App\Models\AgentQuizAttempt;
use App\Models\AgentQuizQuestion;
use App\Models\AgentSession;
use App\Models\AgentTrainingProgress;
use App\Models\AgentTrainingVideo;
use App\Models\BusinessSetting;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AgentQuizApiTest extends TestCase
{
    use DatabaseTransactions;

    private Agent $agent;
    private array $headers;

    protected function setUp(): void
    {
        parent::setUp();
        BusinessSetting::updateOrCreate(['key' => 'agent_quiz_pass_mark'], ['value' => '75']);
        BusinessSetting::updateOrCreate(['key' => 'agent_quiz_question_count'], ['value' => '4']);
        BusinessSetting::updateOrCreate(['key' => 'agent_quiz_cooldown_minutes'], ['value' => '60']);

        $this->agent = Agent::create([
            'full_name' => 'Quiz Agent',
            'email'     => 'quiz' . uniqid() . '@test.com',
            'phone'     => '+23480' . random_int(10000000, 99999999),
            'status'    => Agent::STATUS_APPROVED,
            'password'  => Hash::make('Secret123!'),
        ]);
        $session = AgentSession::create(['agent_id' => $this->agent->id, 'auth_token' => Str::random(80)]);
        $this->headers = ['Authorization' => 'Bearer ' . $session->auth_token];

        // Complete training: one active video, watched.
        AgentTrainingVideo::query()->update(['is_active' => false]);
        $video = AgentTrainingVideo::create(['youtube_video_id' => 'quizvid0001', 'title' => 'T', 'sort_order' => 1]);
        AgentTrainingProgress::create(['agent_id' => $this->agent->id, 'video_id' => $video->id, 'watched_at' => now()]);

        // Question bank: 4 active questions, correct answer always index 1.
        AgentQuizQuestion::query()->update(['is_active' => false]);
        foreach (range(1, 4) as $i) {
            AgentQuizQuestion::create([
                'question'      => "Question {$i}?",
                'options'       => ['A', 'B', 'C', 'D'],
                'correct_index' => 1,
            ]);
        }
    }

    public function test_start_requires_completed_training(): void
    {
        AgentTrainingProgress::where('agent_id', $this->agent->id)->delete();
        $this->getJson('/api/v1/agent/quiz/start', $this->headers)
            ->assertStatus(403)->assertJsonPath('code', 'training-incomplete');
    }

    public function test_start_returns_questions_without_answers(): void
    {
        $res = $this->getJson('/api/v1/agent/quiz/start', $this->headers);
        $res->assertOk()->assertJsonCount(4, 'questions');
        $this->assertArrayNotHasKey('correct_index', $res->json('questions.0'));
        $this->assertDatabaseHas('agent_quiz_attempts', [
            'agent_id' => $this->agent->id, 'status' => AgentQuizAttempt::STATUS_IN_PROGRESS,
        ]);
    }

    public function test_pass_certifies_and_generates_referral_code(): void
    {
        $attemptId = $this->getJson('/api/v1/agent/quiz/start', $this->headers)->json('attempt_id');
        $attempt = AgentQuizAttempt::find($attemptId);
        $answers = collect($attempt->questions)->mapWithKeys(fn ($qid) => [$qid => 1])->all();

        $res = $this->postJson('/api/v1/agent/quiz/submit', [
            'attempt_id' => $attemptId, 'answers' => $answers,
        ], $this->headers);

        $res->assertOk()
            ->assertJsonPath('status', 'passed')
            ->assertJsonPath('score', 100)
            ->assertJsonPath('certified', true);

        $this->agent->refresh();
        $this->assertSame(Agent::STATUS_CERTIFIED, $this->agent->status);
        $this->assertMatchesRegularExpression('/^BX-/', (string) $this->agent->referral_code);
    }

    public function test_fail_sets_failed_and_enforces_cooldown(): void
    {
        $attemptId = $this->getJson('/api/v1/agent/quiz/start', $this->headers)->json('attempt_id');
        $attempt = AgentQuizAttempt::find($attemptId);
        $answers = collect($attempt->questions)->mapWithKeys(fn ($qid) => [$qid => 0])->all(); // all wrong

        $this->postJson('/api/v1/agent/quiz/submit', ['attempt_id' => $attemptId, 'answers' => $answers], $this->headers)
            ->assertOk()->assertJsonPath('status', 'failed')->assertJsonPath('certified', false);

        $this->agent->refresh();
        $this->assertSame(Agent::STATUS_APPROVED, $this->agent->status);

        // Cooldown blocks an immediate retry.
        $this->getJson('/api/v1/agent/quiz/start', $this->headers)
            ->assertStatus(403)->assertJsonPath('code', 'cooldown');
    }

    public function test_certified_agent_cannot_restart_quiz(): void
    {
        $this->agent->update(['status' => Agent::STATUS_CERTIFIED, 'referral_code' => Agent::generateReferralCode()]);
        $this->getJson('/api/v1/agent/quiz/start', $this->headers)
            ->assertStatus(403)->assertJsonPath('code', 'already-certified');
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AgentQuizApiTest`
Expected: FAIL — 404 (routes not defined).

- [ ] **Step 3: Write service, controller, routes**

```php
<?php
// app/Services/Agent/AgentQuizService.php

namespace App\Services\Agent;

use App\Models\Agent;
use App\Models\AgentQuizAttempt;
use App\Models\AgentQuizQuestion;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class AgentQuizService
{
    public function start(Agent $agent): AgentQuizAttempt
    {
        if ($agent->status === Agent::STATUS_CERTIFIED) {
            throw new RuntimeException('already-certified');
        }
        if (!$agent->trainingComplete()) {
            throw new RuntimeException('training-incomplete');
        }

        $lastSubmitted = $agent->quizAttempts()
            ->whereNotNull('submitted_at')
            ->latest('submitted_at')
            ->first();
        if ($lastSubmitted
            && $lastSubmitted->submitted_at->addMinutes(AgentSettings::quizCooldownMinutes())->isFuture()) {
            throw new RuntimeException('cooldown');
        }

        $count = AgentSettings::quizQuestionCount();
        $questionIds = AgentQuizQuestion::where('is_active', true)
            ->inRandomOrder()->limit($count)->pluck('id');
        if ($questionIds->count() < $count) {
            throw new RuntimeException('no-questions');
        }

        // Abandon any dangling in-progress attempt rather than resuming it,
        // so a refresh always serves a fresh random draw.
        $agent->quizAttempts()
            ->where('status', AgentQuizAttempt::STATUS_IN_PROGRESS)
            ->update(['status' => AgentQuizAttempt::STATUS_FAILED, 'submitted_at' => null]);

        return AgentQuizAttempt::create([
            'agent_id'  => $agent->id,
            'status'    => AgentQuizAttempt::STATUS_IN_PROGRESS,
            'questions' => $questionIds->all(),
        ]);
    }

    public function submit(Agent $agent, AgentQuizAttempt $attempt, array $answers): AgentQuizAttempt
    {
        if ($attempt->agent_id !== $agent->id) {
            throw new RuntimeException('not-your-attempt');
        }
        if ($attempt->status !== AgentQuizAttempt::STATUS_IN_PROGRESS) {
            throw new RuntimeException('already-submitted');
        }

        $questions = AgentQuizQuestion::whereIn('id', $attempt->questions)->get()->keyBy('id');
        $correct = 0;
        foreach ($attempt->questions as $qid) {
            $q = $questions->get($qid);
            if ($q && array_key_exists((string) $qid, $answers) === false && array_key_exists($qid, $answers) === false) {
                continue;
            }
            $given = $answers[$qid] ?? $answers[(string) $qid] ?? null;
            if ($q && $given !== null && (int) $given === (int) $q->correct_index) {
                $correct++;
            }
        }

        $score = (int) floor(($correct / max(count($attempt->questions), 1)) * 100);
        $passMark = AgentSettings::quizPassMark();
        $passed = $score >= $passMark;

        DB::transaction(function () use ($attempt, $agent, $answers, $score, $passed) {
            $attempt->update([
                'status'       => $passed ? AgentQuizAttempt::STATUS_PASSED : AgentQuizAttempt::STATUS_FAILED,
                'answers'      => $answers,
                'score'        => $score,
                'submitted_at' => now(),
            ]);

            if ($passed && $agent->status !== Agent::STATUS_CERTIFIED) {
                $agent->update([
                    'status'        => Agent::STATUS_CERTIFIED,
                    'certified_at'  => now(),
                    'referral_code' => $agent->referral_code ?: Agent::generateReferralCode(),
                ]);
            }
        });

        return $attempt->refresh();
    }
}
```

```php
<?php
// app/Http/Controllers/Api/V1/Agent/AgentQuizController.php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\AgentQuizAttempt;
use App\Models\AgentQuizQuestion;
use App\Services\Agent\AgentQuizService;
use App\Services\Agent\AgentSettings;
use Illuminate\Http\Request;
use RuntimeException;

class AgentQuizController extends Controller
{
    public function __construct(private AgentQuizService $quiz)
    {
    }

    public function start(Request $request)
    {
        try {
            $attempt = $this->quiz->start($request->user());
        } catch (RuntimeException $e) {
            $payload = ['code' => $e->getMessage()];
            if ($e->getMessage() === 'cooldown') {
                $last = $request->user()->quizAttempts()->whereNotNull('submitted_at')->latest('submitted_at')->first();
                $payload['retry_at'] = $last->submitted_at->addMinutes(AgentSettings::quizCooldownMinutes())->toIso8601String();
            }
            return response()->json($payload, 403);
        }

        $questions = AgentQuizQuestion::whereIn('id', $attempt->questions)->get()->keyBy('id');
        $ordered = collect($attempt->questions)->map(fn ($qid) => [
            'id'       => $qid,
            'question' => $questions[$qid]->question,
            'options'  => $questions[$qid]->options,
        ])->values();

        return response()->json([
            'attempt_id' => $attempt->id,
            'pass_mark'  => AgentSettings::quizPassMark(),
            'questions'  => $ordered,
        ]);
    }

    public function submit(Request $request)
    {
        $request->validate([
            'attempt_id' => 'required|integer',
            'answers'    => 'required|array',
        ]);

        $attempt = AgentQuizAttempt::find($request->attempt_id);
        if (!$attempt) {
            return response()->json(['code' => 'attempt-not-found'], 404);
        }

        try {
            $attempt = $this->quiz->submit($request->user(), $attempt, $request->answers);
        } catch (RuntimeException $e) {
            return response()->json(['code' => $e->getMessage()], 403);
        }

        $agent = $request->user()->refresh();

        return response()->json([
            'status'        => $attempt->status,
            'score'         => $attempt->score,
            'pass_mark'     => AgentSettings::quizPassMark(),
            'certified'     => $agent->status === Agent::STATUS_CERTIFIED,
            'referral_code' => $agent->referral_code,
        ]);
    }
}
```

Extend the `agent.api` group in `routes/api/v1/api.php`:

```php
Route::group(['prefix' => 'quiz'], function () {
    Route::get('start', 'AgentQuizController@start');
    Route::post('submit', 'AgentQuizController@submit');
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test --filter=AgentQuizApiTest`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the whole agent suite**

Run: `php artisan test --filter=Agent`
Expected: all Agent tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/Services/Agent/AgentQuizService.php app/Http/Controllers/Api/V1/Agent/AgentQuizController.php routes/api/v1/api.php tests/Feature/Agent/AgentQuizApiTest.php
git commit -m "feat(agent): quiz API with certification and referral code"
```

---

### Task 10: Admin — training video + quiz question management

**Files:**
- Create: `app/Http/Controllers/Admin/Agent/AgentTrainingVideoController.php`
- Create: `app/Http/Controllers/Admin/Agent/AgentQuizQuestionController.php`
- Create: `resources/views/admin-views/agent/training/index.blade.php`
- Create: `resources/views/admin-views/agent/quiz/index.blade.php`
- Modify: `routes/admin/routes.php` (new `agent-program` group)

**Interfaces:**
- Consumes: models from Task 3.
- Produces admin routes named `admin.agent-program.training.*` and `admin.agent-program.quiz.*` (index/store/update/toggle/delete). Views follow `admin-views/expense/index.blade.php` layout conventions (`@extends('layouts.admin.app')`, card + table + modal-less inline forms).

- [ ] **Step 1: Read the reference view**

Read `resources/views/admin-views/expense/index.blade.php` and the head of `app/Http/Controllers/Admin/Expense/ExpenseHeadController.php` to copy layout idioms (section blocks, toastr flash pattern, pagination style).

- [ ] **Step 2: Write the controllers**

```php
<?php
// app/Http/Controllers/Admin/Agent/AgentTrainingVideoController.php

namespace App\Http\Controllers\Admin\Agent;

use App\Http\Controllers\Controller;
use App\Models\AgentTrainingVideo;
use Illuminate\Http\Request;

class AgentTrainingVideoController extends Controller
{
    public function index()
    {
        $videos = AgentTrainingVideo::orderBy('sort_order')->paginate(25);
        return view('admin-views.agent.training.index', compact('videos'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'title'            => 'required|string|max:200',
            'youtube_video_id' => 'required|string|max:20',
            'sort_order'       => 'nullable|integer|min:0',
        ]);

        AgentTrainingVideo::create([
            'title'            => $request->title,
            'youtube_video_id' => $request->youtube_video_id,
            'sort_order'       => (int) $request->input('sort_order', 0),
            'is_active'        => true,
        ]);

        toastr()->success(translate('messages.video_added_successfully'));
        return back();
    }

    public function toggle($id)
    {
        $video = AgentTrainingVideo::findOrFail($id);
        $video->update(['is_active' => !$video->is_active]);
        toastr()->success(translate('messages.status_updated'));
        return back();
    }

    public function destroy($id)
    {
        AgentTrainingVideo::findOrFail($id)->delete();
        toastr()->success(translate('messages.video_deleted_successfully'));
        return back();
    }
}
```

```php
<?php
// app/Http/Controllers/Admin/Agent/AgentQuizQuestionController.php

namespace App\Http\Controllers\Admin\Agent;

use App\Http\Controllers\Controller;
use App\Models\AgentQuizQuestion;
use Illuminate\Http\Request;

class AgentQuizQuestionController extends Controller
{
    public function index()
    {
        $questions = AgentQuizQuestion::latest()->paginate(25);
        return view('admin-views.agent.quiz.index', compact('questions'));
    }

    public function store(Request $request)
    {
        $request->validate([
            'question'      => 'required|string',
            'options'       => 'required|array|size:4',
            'options.*'     => 'required|string|max:255',
            'correct_index' => 'required|integer|min:0|max:3',
        ]);

        AgentQuizQuestion::create([
            'question'      => $request->question,
            'options'       => array_values($request->options),
            'correct_index' => (int) $request->correct_index,
            'is_active'     => true,
        ]);

        toastr()->success(translate('messages.question_added_successfully'));
        return back();
    }

    public function toggle($id)
    {
        $q = AgentQuizQuestion::findOrFail($id);
        $q->update(['is_active' => !$q->is_active]);
        toastr()->success(translate('messages.status_updated'));
        return back();
    }

    public function destroy($id)
    {
        AgentQuizQuestion::findOrFail($id)->delete();
        toastr()->success(translate('messages.question_deleted_successfully'));
        return back();
    }
}
```

Note: if the codebase flashes messages with `Toastr::success(...)` instead of the `toastr()` helper, match whichever `ExpenseHeadController` uses — check in Step 1 and keep it consistent.

- [ ] **Step 3: Write the views**

`resources/views/admin-views/agent/training/index.blade.php`:

```blade
@extends('layouts.admin.app')

@section('title', translate('messages.agent_training_videos'))

@section('content')
<div class="content container-fluid">
    <div class="page-header">
        <h1 class="page-header-title">{{ translate('messages.agent_training_videos') }}</h1>
    </div>

    <div class="card mb-3">
        <div class="card-body">
            <form action="{{ route('admin.agent-program.training.store') }}" method="post">
                @csrf
                <div class="row g-3 align-items-end">
                    <div class="col-md-4">
                        <label class="form-label">{{ translate('messages.title') }}</label>
                        <input type="text" name="title" class="form-control" required maxlength="200">
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">{{ translate('messages.youtube_video_id') }}</label>
                        <input type="text" name="youtube_video_id" class="form-control" required maxlength="20"
                               placeholder="dQw4w9WgXcQ">
                    </div>
                    <div class="col-md-2">
                        <label class="form-label">{{ translate('messages.sort_order') }}</label>
                        <input type="number" name="sort_order" class="form-control" value="0" min="0">
                    </div>
                    <div class="col-md-3">
                        <button type="submit" class="btn btn--primary">{{ translate('messages.add') }}</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-borderless table-thead-bordered table-align-middle">
                <thead class="thead-light">
                    <tr>
                        <th>{{ translate('messages.sl') }}</th>
                        <th>{{ translate('messages.title') }}</th>
                        <th>{{ translate('messages.youtube_video_id') }}</th>
                        <th>{{ translate('messages.sort_order') }}</th>
                        <th>{{ translate('messages.status') }}</th>
                        <th>{{ translate('messages.action') }}</th>
                    </tr>
                </thead>
                <tbody>
                @foreach($videos as $key => $video)
                    <tr>
                        <td>{{ $videos->firstItem() + $key }}</td>
                        <td>{{ $video->title }}</td>
                        <td><a href="https://www.youtube.com/watch?v={{ $video->youtube_video_id }}" target="_blank">{{ $video->youtube_video_id }}</a></td>
                        <td>{{ $video->sort_order }}</td>
                        <td>
                            <span class="badge {{ $video->is_active ? 'badge-soft-success' : 'badge-soft-secondary' }}">
                                {{ $video->is_active ? translate('messages.active') : translate('messages.inactive') }}
                            </span>
                        </td>
                        <td>
                            <form action="{{ route('admin.agent-program.training.toggle', $video->id) }}" method="post" class="d-inline">
                                @csrf
                                <button class="btn btn-sm btn-outline-primary">{{ translate('messages.toggle') }}</button>
                            </form>
                            <form action="{{ route('admin.agent-program.training.delete', $video->id) }}" method="post" class="d-inline"
                                  onsubmit="return confirm('{{ translate('messages.are_you_sure') }}')">
                                @csrf @method('delete')
                                <button class="btn btn-sm btn-outline-danger">{{ translate('messages.delete') }}</button>
                            </form>
                        </td>
                    </tr>
                @endforeach
                </tbody>
            </table>
        </div>
        <div class="card-footer">{!! $videos->links() !!}</div>
    </div>
</div>
@endsection
```

`resources/views/admin-views/agent/quiz/index.blade.php`:

```blade
@extends('layouts.admin.app')

@section('title', translate('messages.agent_quiz_questions'))

@section('content')
<div class="content container-fluid">
    <div class="page-header">
        <h1 class="page-header-title">{{ translate('messages.agent_quiz_questions') }}</h1>
    </div>

    <div class="card mb-3">
        <div class="card-body">
            <form action="{{ route('admin.agent-program.quiz.store') }}" method="post">
                @csrf
                <div class="mb-3">
                    <label class="form-label">{{ translate('messages.question') }}</label>
                    <textarea name="question" class="form-control" rows="2" required></textarea>
                </div>
                <div class="row g-3">
                    @foreach(range(0, 3) as $i)
                        <div class="col-md-6">
                            <label class="form-label">{{ translate('messages.option') }} {{ chr(65 + $i) }}</label>
                            <input type="text" name="options[{{ $i }}]" class="form-control" required maxlength="255">
                        </div>
                    @endforeach
                    <div class="col-md-6">
                        <label class="form-label">{{ translate('messages.correct_option') }}</label>
                        <select name="correct_index" class="form-control" required>
                            @foreach(range(0, 3) as $i)
                                <option value="{{ $i }}">{{ chr(65 + $i) }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="col-md-6 d-flex align-items-end">
                        <button type="submit" class="btn btn--primary">{{ translate('messages.add') }}</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div class="card">
        <div class="table-responsive">
            <table class="table table-borderless table-thead-bordered table-align-middle">
                <thead class="thead-light">
                    <tr>
                        <th>{{ translate('messages.sl') }}</th>
                        <th>{{ translate('messages.question') }}</th>
                        <th>{{ translate('messages.correct_option') }}</th>
                        <th>{{ translate('messages.status') }}</th>
                        <th>{{ translate('messages.action') }}</th>
                    </tr>
                </thead>
                <tbody>
                @foreach($questions as $key => $q)
                    <tr>
                        <td>{{ $questions->firstItem() + $key }}</td>
                        <td>{{ \Illuminate\Support\Str::limit($q->question, 90) }}</td>
                        <td>{{ chr(65 + $q->correct_index) }}. {{ $q->options[$q->correct_index] ?? '' }}</td>
                        <td>
                            <span class="badge {{ $q->is_active ? 'badge-soft-success' : 'badge-soft-secondary' }}">
                                {{ $q->is_active ? translate('messages.active') : translate('messages.inactive') }}
                            </span>
                        </td>
                        <td>
                            <form action="{{ route('admin.agent-program.quiz.toggle', $q->id) }}" method="post" class="d-inline">
                                @csrf
                                <button class="btn btn-sm btn-outline-primary">{{ translate('messages.toggle') }}</button>
                            </form>
                            <form action="{{ route('admin.agent-program.quiz.delete', $q->id) }}" method="post" class="d-inline"
                                  onsubmit="return confirm('{{ translate('messages.are_you_sure') }}')">
                                @csrf @method('delete')
                                <button class="btn btn-sm btn-outline-danger">{{ translate('messages.delete') }}</button>
                            </form>
                        </td>
                    </tr>
                @endforeach
                </tbody>
            </table>
        </div>
        <div class="card-footer">{!! $questions->links() !!}</div>
    </div>
</div>
@endsection
```

Adjust table/button CSS classes to whatever `admin-views/expense/index.blade.php` actually uses (checked in Step 1) — class names above are the common theme idiom, but the reference file wins.

- [ ] **Step 4: Register admin routes**

In `routes/admin/routes.php`, inside the main authenticated admin group (same nesting level as the `partner-leads` group at ~line 380), add:

```php
Route::group(['prefix' => 'agent-program', 'as' => 'agent-program.', 'namespace' => 'Agent'], function () {
    Route::group(['prefix' => 'training', 'as' => 'training.'], function () {
        Route::get('/', 'AgentTrainingVideoController@index')->name('index');
        Route::post('store', 'AgentTrainingVideoController@store')->name('store');
        Route::post('toggle/{id}', 'AgentTrainingVideoController@toggle')->name('toggle');
        Route::delete('delete/{id}', 'AgentTrainingVideoController@destroy')->name('delete');
    });
    Route::group(['prefix' => 'quiz', 'as' => 'quiz.'], function () {
        Route::get('/', 'AgentQuizQuestionController@index')->name('index');
        Route::post('store', 'AgentQuizQuestionController@store')->name('store');
        Route::post('toggle/{id}', 'AgentQuizQuestionController@toggle')->name('toggle');
        Route::delete('delete/{id}', 'AgentQuizQuestionController@destroy')->name('delete');
    });
});
```

- [ ] **Step 5: Verify routes register**

Run: `php artisan route:list --path=admin/agent-program`
Expected: 8 routes listed.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Admin/Agent resources/views/admin-views/agent routes/admin/routes.php
git commit -m "feat(agent): admin management for training videos and quiz questions"
```

---

### Task 11: Admin — agent list/detail + approve-from-lead + sidebar

**Files:**
- Create: `app/Http/Controllers/Admin/Agent/AgentController.php`
- Create: `resources/views/admin-views/agent/index.blade.php`
- Create: `resources/views/admin-views/agent/show.blade.php`
- Modify: `routes/admin/routes.php` (extend `agent-program` group)
- Modify: `resources/views/layouts/admin/partials/_sidebar.blade.php` (Agent Program section)
- Modify: `resources/views/admin-views/partner-lead/...` detail view (add "Approve as agent" button — locate the exact blade with `grep -rn "partner" resources/views/admin-views --include=*.blade.php -l` first)
- Test: `tests/Feature/Agent/AdminAgentApprovalTest.php`

**Interfaces:**
- Consumes: `AgentOnboardingService::approveFromLead()` (Task 5).
- Produces routes: `admin.agent-program.agents.index`, `admin.agent-program.agents.show`, `admin.agent-program.agents.suspend`, `admin.agent-program.agents.approve-lead` (POST, param `partner_lead_id`).

- [ ] **Step 1: Write the failing test**

```php
<?php
// tests/Feature/Agent/AdminAgentApprovalTest.php

namespace Tests\Feature\Agent;

use App\Models\Admin;
use App\Models\Agent;
use App\Models\PartnerLead;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminAgentApprovalTest extends TestCase
{
    use DatabaseTransactions;

    public function test_admin_can_approve_agent_lead(): void
    {
        Mail::fake();
        $admin = Admin::first() ?? Admin::factory()->create();
        $lead = PartnerLead::create([
            'audience' => 'agent', 'status' => 'new',
            'full_name' => 'Field Agent', 'email' => 'field' . uniqid() . '@test.com',
            'phone' => '+23480' . random_int(10000000, 99999999), 'source' => 'web',
        ]);

        $res = $this->actingAs($admin, 'admin')
            ->post(route('admin.agent-program.agents.approve-lead', $lead->id));

        $res->assertRedirect();
        $this->assertDatabaseHas('agents', ['partner_lead_id' => $lead->id, 'status' => Agent::STATUS_APPROVED]);
        $lead->refresh();
        $this->assertSame('converted', $lead->status);
    }
}
```

Note: check how existing admin feature tests authenticate (look at any test in `tests/Feature/` that hits an `admin.*` route; if none exists, check `config/auth.php` for the admin guard name and use `actingAs($admin, '<guard>')`). If `Admin::factory()` does not exist, create the admin row with `Admin::create([...])` using the minimum columns from the `admins` table.

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test --filter=AdminAgentApprovalTest`
Expected: FAIL — route not defined.

- [ ] **Step 3: Write the controller**

```php
<?php
// app/Http/Controllers/Admin/Agent/AgentController.php

namespace App\Http\Controllers\Admin\Agent;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use App\Models\PartnerLead;
use App\Services\Agent\AgentOnboardingService;
use Illuminate\Http\Request;
use InvalidArgumentException;

class AgentController extends Controller
{
    public function index(Request $request)
    {
        $agents = Agent::when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, function ($q) use ($request) {
                $q->where(function ($qq) use ($request) {
                    $qq->where('full_name', 'like', "%{$request->search}%")
                       ->orWhere('email', 'like', "%{$request->search}%")
                       ->orWhere('phone', 'like', "%{$request->search}%")
                       ->orWhere('referral_code', 'like', "%{$request->search}%");
                });
            })
            ->latest()->paginate(25);

        return view('admin-views.agent.index', compact('agents'));
    }

    public function show($id)
    {
        $agent = Agent::with(['trainingProgress', 'quizAttempts' => fn ($q) => $q->latest()])->findOrFail($id);
        return view('admin-views.agent.show', compact('agent'));
    }

    public function suspend($id)
    {
        $agent = Agent::findOrFail($id);
        $agent->update([
            'status' => $agent->status === Agent::STATUS_SUSPENDED
                ? ($agent->certified_at ? Agent::STATUS_CERTIFIED : Agent::STATUS_APPROVED)
                : Agent::STATUS_SUSPENDED,
        ]);
        toastr()->success(translate('messages.status_updated'));
        return back();
    }

    public function approveLead(Request $request, $leadId)
    {
        $lead = PartnerLead::findOrFail($leadId);

        try {
            app(AgentOnboardingService::class)->approveFromLead($lead, auth('admin')->id());
        } catch (InvalidArgumentException $e) {
            toastr()->error($e->getMessage());
            return back();
        }

        toastr()->success(translate('messages.agent_approved_invite_sent'));
        return back();
    }
}
```

- [ ] **Step 4: Write the views**

`resources/views/admin-views/agent/index.blade.php`:

```blade
@extends('layouts.admin.app')

@section('title', translate('messages.agents'))

@section('content')
<div class="content container-fluid">
    <div class="page-header">
        <h1 class="page-header-title">{{ translate('messages.agents') }}</h1>
    </div>

    <div class="card">
        <div class="card-header">
            <form method="get" class="d-flex gap-2">
                <input type="text" name="search" class="form-control" value="{{ request('search') }}"
                       placeholder="{{ translate('messages.search_name_email_phone_code') }}">
                <select name="status" class="form-control" style="max-width: 180px;">
                    <option value="">{{ translate('messages.all_statuses') }}</option>
                    @foreach(['approved', 'certified', 'suspended'] as $s)
                        <option value="{{ $s }}" @selected(request('status') === $s)>{{ translate('messages.' . $s) }}</option>
                    @endforeach
                </select>
                <button class="btn btn--primary">{{ translate('messages.filter') }}</button>
            </form>
        </div>
        <div class="table-responsive">
            <table class="table table-borderless table-thead-bordered table-align-middle">
                <thead class="thead-light">
                    <tr>
                        <th>{{ translate('messages.sl') }}</th>
                        <th>{{ translate('messages.name') }}</th>
                        <th>{{ translate('messages.contact') }}</th>
                        <th>{{ translate('messages.status') }}</th>
                        <th>{{ translate('messages.referral_code') }}</th>
                        <th>{{ translate('messages.joined') }}</th>
                        <th>{{ translate('messages.action') }}</th>
                    </tr>
                </thead>
                <tbody>
                @foreach($agents as $key => $agent)
                    <tr>
                        <td>{{ $agents->firstItem() + $key }}</td>
                        <td>{{ $agent->full_name }}</td>
                        <td>{{ $agent->email }}<br><small>{{ $agent->phone }}</small></td>
                        <td><span class="badge badge-soft-info">{{ translate('messages.' . $agent->status) }}</span></td>
                        <td>{{ $agent->referral_code ?? '—' }}</td>
                        <td>{{ $agent->created_at->format('d M Y') }}</td>
                        <td>
                            <a class="btn btn-sm btn-outline-primary" href="{{ route('admin.agent-program.agents.show', $agent->id) }}">
                                {{ translate('messages.view') }}
                            </a>
                        </td>
                    </tr>
                @endforeach
                </tbody>
            </table>
        </div>
        <div class="card-footer">{!! $agents->links() !!}</div>
    </div>
</div>
@endsection
```

`resources/views/admin-views/agent/show.blade.php`:

```blade
@extends('layouts.admin.app')

@section('title', $agent->full_name)

@section('content')
<div class="content container-fluid">
    <div class="page-header d-flex justify-content-between align-items-center">
        <h1 class="page-header-title">{{ $agent->full_name }}</h1>
        <form action="{{ route('admin.agent-program.agents.suspend', $agent->id) }}" method="post"
              onsubmit="return confirm('{{ translate('messages.are_you_sure') }}')">
            @csrf
            <button class="btn {{ $agent->status === 'suspended' ? 'btn-outline-success' : 'btn-outline-danger' }}">
                {{ $agent->status === 'suspended' ? translate('messages.reinstate') : translate('messages.suspend') }}
            </button>
        </form>
    </div>

    <div class="row g-3">
        <div class="col-md-6">
            <div class="card h-100">
                <div class="card-header"><h5 class="card-title">{{ translate('messages.profile') }}</h5></div>
                <div class="card-body">
                    <p><strong>{{ translate('messages.email') }}:</strong> {{ $agent->email }}</p>
                    <p><strong>{{ translate('messages.phone') }}:</strong> {{ $agent->phone }}</p>
                    <p><strong>{{ translate('messages.city') }}:</strong> {{ $agent->city_slug ?? '—' }}</p>
                    <p><strong>{{ translate('messages.status') }}:</strong> {{ translate('messages.' . $agent->status) }}</p>
                    <p><strong>{{ translate('messages.referral_code') }}:</strong> {{ $agent->referral_code ?? '—' }}</p>
                    <p><strong>{{ translate('messages.certified_at') }}:</strong> {{ $agent->certified_at?->format('d M Y H:i') ?? '—' }}</p>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card h-100">
                <div class="card-header"><h5 class="card-title">{{ translate('messages.training_and_quiz') }}</h5></div>
                <div class="card-body">
                    <p><strong>{{ translate('messages.videos_watched') }}:</strong> {{ $agent->trainingProgress->count() }}</p>
                    <p><strong>{{ translate('messages.training_complete') }}:</strong>
                        {{ $agent->trainingComplete() ? translate('messages.yes') : translate('messages.no') }}</p>
                    <hr>
                    <h6>{{ translate('messages.quiz_attempts') }}</h6>
                    @forelse($agent->quizAttempts as $attempt)
                        <p class="mb-1">
                            {{ $attempt->created_at->format('d M Y H:i') }} —
                            <span class="badge {{ $attempt->status === 'passed' ? 'badge-soft-success' : 'badge-soft-secondary' }}">
                                {{ $attempt->status }}
                            </span>
                            @if($attempt->score !== null) ({{ $attempt->score }}%) @endif
                        </p>
                    @empty
                        <p class="text-muted">{{ translate('messages.no_attempts_yet') }}</p>
                    @endforelse
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
```

- [ ] **Step 5: Register routes**

Extend the `agent-program` group in `routes/admin/routes.php`:

```php
Route::group(['prefix' => 'agents', 'as' => 'agents.'], function () {
    Route::get('/', 'AgentController@index')->name('index');
    Route::get('{id}', 'AgentController@show')->name('show')->where('id', '[0-9]+');
    Route::post('{id}/suspend', 'AgentController@suspend')->name('suspend')->where('id', '[0-9]+');
    Route::post('approve-lead/{leadId}', 'AgentController@approveLead')->name('approve-lead');
});
```

- [ ] **Step 6: Add "Approve as agent" button to the partner-lead detail view**

Locate the partner-lead show blade (`grep -rn "updateStatus\|partner-leads" resources/views/admin-views -l`). In that view, where action buttons render, add — visible only for unconverted agent leads:

```blade
@if($lead->audience === 'agent' && $lead->converted_at === null)
    <form action="{{ route('admin.agent-program.agents.approve-lead', $lead->id) }}" method="post" class="d-inline"
          onsubmit="return confirm('{{ translate('messages.approve_agent_confirm') }}')">
        @csrf
        <button class="btn btn--primary">{{ translate('messages.approve_as_agent') }}</button>
    </form>
@endif
```

- [ ] **Step 7: Add sidebar section**

In `resources/views/layouts/admin/partials/_sidebar.blade.php`, after the expense-report block (~line 1156), add a small "Agent Program" group following the exact `<li>` idiom used by neighbouring single links:

```blade
{{-- BiteExpress Agent Program --}}
<li class="navbar-vertical-aside-has-menu {{ Request::is('admin/agent-program*') ? 'active' : '' }}">
    <a class="nav-link" href="{{ route('admin.agent-program.agents.index') }}" title="{{ translate('messages.agents') }}">
        <i class="tio-group-senior nav-icon"></i>
        <span class="text-truncate">{{ translate('messages.agents') }}</span>
    </a>
</li>
<li class="navbar-vertical-aside-has-menu {{ Request::is('admin/agent-program/training*') ? 'active' : '' }}">
    <a class="nav-link" href="{{ route('admin.agent-program.training.index') }}" title="{{ translate('messages.agent_training') }}">
        <i class="tio-play-circle-outlined nav-icon"></i>
        <span class="text-truncate">{{ translate('messages.agent_training') }}</span>
    </a>
</li>
<li class="navbar-vertical-aside-has-menu {{ Request::is('admin/agent-program/quiz*') ? 'active' : '' }}">
    <a class="nav-link" href="{{ route('admin.agent-program.quiz.index') }}" title="{{ translate('messages.agent_quiz') }}">
        <i class="tio-help-outlined nav-icon"></i>
        <span class="text-truncate">{{ translate('messages.agent_quiz') }}</span>
    </a>
</li>
```

**Icon rule (standing feedback):** before using ANY `tio-*` class, grep the icon CSS to confirm it exists: `grep -o "tio-group-senior\|tio-play-circle-outlined\|tio-help-outlined" public/assets/admin/css/*.css | sort -u` (adjust path to wherever the tio css lives — find it with `grep -rln "tio-appointment" public/assets | head -1`). Substitute any missing icon with one that exists.

- [ ] **Step 8: Run test to verify it passes**

Run: `php artisan test --filter=AdminAgentApprovalTest`
Expected: PASS.

- [ ] **Step 9: Full agent suite + route smoke check**

Run: `php artisan test --filter=Agent` and `php artisan route:list --path=admin/agent-program`
Expected: all pass; 12 admin routes.

- [ ] **Step 10: Commit**

```bash
git add app/Http/Controllers/Admin/Agent/AgentController.php resources/views/admin-views/agent routes/admin/routes.php resources/views/layouts/admin/partials/_sidebar.blade.php resources/views/admin-views/partner-lead* tests/Feature/Agent/AdminAgentApprovalTest.php
git commit -m "feat(agent): admin agent list/detail, lead approval, sidebar"
```

---

### Task 12: Production settings seed + verification pass

**Files:**
- Modify: none (operational task)

- [ ] **Step 1: Run the settings seeder locally**

Run: `php artisan db:seed --class=AgentProgramSettingsSeeder`
Expected: 4 `business_settings` rows exist (`agent_quiz_pass_mark=75`, `agent_quiz_question_count=10`, `agent_quiz_cooldown_minutes=60`, `agent_program_active=0`).

- [ ] **Step 2: Full regression filter**

Run: `php artisan test --filter=Agent`
Expected: entire Agent suite green (≈20 tests).

- [ ] **Step 3: Verify no existing behavior changed**

Run: `php artisan test tests/Feature/Commerce 2>&1 | tail -5` (or the project's fastest existing suite)
Expected: same pass/fail state as before this plan (no new failures).

- [ ] **Step 4: End-to-end smoke via HTTP (local)**

With the local app served by Laragon, run:

```bash
curl -s http://dashboard.bite.express.test/api/v1/agent/me -H "Authorization: Bearer nonsense" | head -c 200
```

Expected: 401 JSON `{"errors":[{"code":"auth-001",...}]}`.

- [ ] **Step 5: Deployment notes (production, after push)**

On srv02 (no sudo, biteexpress user): CI/CD deploys code; then run once via SSH:

```bash
php artisan migrate --force
php artisan db:seed --class=AgentProgramSettingsSeeder --force
```

Log both in `~/.deploy-history.log` per house convention. The program remains inert (`agent_program_active=0`, no approved agents) until sign-off.

- [ ] **Step 6: Commit any stragglers and push**

```bash
git status --short   # expect clean
```

---

## Out of Scope (later plans)

- **A2:** the agents.bite.express PWA (Next.js) — separate plan; MUST load `frontend-design`, `impeccable`, and `ui-ux-pro-max` skills at execution time (standing user rule).
- **B:** referral capture (code + assisted OTP signup), commission engine, earnings.
- **C:** KYC review flow, withdrawals via `withdraw_requests`.
- **D:** weekly challenges, notifications, analytics widget.
