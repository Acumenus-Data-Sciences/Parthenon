# CE/EE Fork — Plan 02-04: AuditSink Extension Point

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. See [Plan 02-01](2026-05-08-ce-ee-fork-plan-02-01-auth-driver.md) for the canonical TDD pattern.

**Goal:** Add an `AuditSinkInterface` so audit log writes go through a pluggable destination. CE default writes to the existing `app.user_audit_logs` table (preserving current behavior). EE adds a `SignedAuditSink` that emits cryptographically-signed JSONL to S3/Azure Blob with WORM retention for HIPAA/SOC 2 audit trails.

**Architecture:** Multi-sink fan-out. The `AuditSinkRegistry` holds N sinks; every audit event is dispatched to all registered sinks in order. CE registers `DatabaseAuditSink` (writes to `user_audit_logs`). EE additionally registers `SignedAuditSink` (signs + ships to immutable storage). Each sink implements the same `write(AuditEvent)` interface; sinks can opt to be synchronous (DB) or queued (signed external storage).

**Tech Stack:** PHP 8.4, Laravel 11 queues, existing `UserAuditLog` model, Pest 3.

**Spec reference:** Spec §5 row 4.

**Umbrella:** [Plan 02 umbrella](2026-05-08-ce-ee-fork-plan-02-extension-points-umbrella.md).

**Prerequisites:**
- Plan 02-01 merged (AuthDriver provides authenticated user context)
- Plan 02-02 merged (TenantResolver provides tenant context that is recorded on every audit event)
- Plan 02-03 ideally merged (CryptoProvider provides HMAC for the AuditEvent fingerprint, though sinks can fall back to native `hash_hmac`)

---

## File structure

| Path | Purpose | LOC |
|---|---|---|
| `backend/app/Contracts/AuditSinkInterface.php` | Extension contract | ~60 |
| `backend/app/Audit/AuditEvent.php` | Value object — what gets written | ~120 |
| `backend/app/Audit/AuditSinkRegistry.php` | Fan-out coordinator | ~80 |
| `backend/app/Audit/Sinks/DatabaseAuditSink.php` | CE default — writes to user_audit_logs | ~80 |
| `backend/app/Audit/Sinks/NullAuditSink.php` | Test/disabled fixture | ~30 |
| `backend/app/Audit/AuditDispatcher.php` | Public API — `audit()->record(...)` | ~80 |
| `backend/app/Providers/AuditServiceProvider.php` | Wires registry + DatabaseAuditSink | ~50 |
| `backend/config/audit.php` | Active sinks list, queue config | ~50 |
| `backend/database/migrations/<ts>_extend_user_audit_logs_for_signed_sinks.php` | Adds `event_id`, `tenant_id`, `metadata`, `prev_event_hash`, `event_hash` (signed sink chain support) | ~70 |
| `backend/tests/Feature/Audit/DatabaseAuditSinkTest.php` | Default tests | ~120 |
| `backend/tests/Feature/Audit/AuditSinkRegistryTest.php` | Fan-out tests | ~100 |
| `backend/tests/Feature/Audit/StubSignedAuditSink.php` | Pluggability fixture | ~60 |
| `backend/tests/Feature/Audit/AuditDispatcherTest.php` | High-level dispatcher tests | ~100 |
| `docs/architecture/extension-points/audit-sink.md` | Detail doc | ~250 |

**Modified files:**
- `backend/app/Http/Middleware/RecordUserActivity.php` — call `AuditDispatcher::record()` instead of writing directly to UserAuditLog
- `backend/app/Observers/DesignProtection/DesignAuditObserver.php` — same
- Any other call sites that currently `UserAuditLog::create(...)` directly
- `backend/bootstrap/providers.php` — register `AuditServiceProvider`
- `docs/architecture/extension-points.md` — mark row 4 done

---

## Task 1: AuditEvent value object

```php
<?php
namespace App\Audit;

/**
 * Immutable value object describing one auditable event. Sinks
 * receive these and persist/transmit them. Field set is intentionally
 * superset of what UserAuditLog stores today, plus optional
 * cryptographic chaining fields the SignedAuditSink uses.
 */
final readonly class AuditEvent
{
    public function __construct(
        public string $eventId,                       // ULID (sortable, unique)
        public \DateTimeImmutable $occurredAt,
        public string $action,                        // e.g. 'auth.login', 'cohort.create'
        public ?int $actorUserId,                     // null for system / anonymous
        public ?string $actorRole,
        public int $tenantId,                         // resolved from TenantResolver
        public ?string $resourceType = null,          // e.g. 'cohort'
        public ?string $resourceId = null,            // e.g. '42'
        public ?string $sourceKey = null,             // CDM source if applicable (e.g. 'omop')
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
        public ?string $route = null,
        public string $outcome = 'success',           // 'success' | 'failure' | 'denied'
        /** @var array<string, mixed> */
        public array $metadata = [],
        public ?string $prevEventHash = null,         // for signed-chain sinks (set by sink, not caller)
    ) {}

    public function toArray(): array {
        return [
            'event_id' => $this->eventId,
            'occurred_at' => $this->occurredAt->format('Y-m-d\\TH:i:s.uP'),
            'action' => $this->action,
            'actor_user_id' => $this->actorUserId,
            'actor_role' => $this->actorRole,
            'tenant_id' => $this->tenantId,
            'resource_type' => $this->resourceType,
            'resource_id' => $this->resourceId,
            'source_key' => $this->sourceKey,
            'ip_address' => $this->ipAddress,
            'user_agent' => $this->userAgent,
            'route' => $this->route,
            'outcome' => $this->outcome,
            'metadata' => $this->metadata,
        ];
    }
}
```

---

## Task 2: AuditSinkInterface

```php
<?php
namespace App\Contracts;

use App\Audit\AuditEvent;

/**
 * Sink for audit events. Implementations can be synchronous (e.g.
 * DatabaseAuditSink) or queue work (e.g. SignedAuditSink ships to S3
 * via Horizon).
 *
 * Sinks MUST NOT throw on write failure. They MUST log internally and
 * return false; the dispatcher records partial-failure state. The only
 * exception: a sink can throw to ABORT the request (e.g. EE's
 * SignedAuditSink can refuse to allow a request if WORM storage is
 * unreachable, depending on customer policy).
 */
interface AuditSinkInterface
{
    public function name(): string;

    /** Whether this sink is currently functional. */
    public function isAvailable(): bool;

    /** Persist or transmit the event. Return true on success, false on failure (do not throw). */
    public function write(AuditEvent $event): bool;

    /** Whether this sink runs synchronously in-request. False = queued. */
    public function isSynchronous(): bool;
}
```

---

## Task 3: TDD — DatabaseAuditSink

- [ ] **Step 3.1: Migration to extend user_audit_logs**

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::connection('pgsql')->table('user_audit_logs', function (Blueprint $t) {
            if (!Schema::hasColumn('user_audit_logs', 'event_id')) $t->string('event_id', 32)->unique()->after('id');
            if (!Schema::hasColumn('user_audit_logs', 'tenant_id')) $t->unsignedBigInteger('tenant_id')->nullable()->default(1)->after('user_id');
            if (!Schema::hasColumn('user_audit_logs', 'outcome')) $t->string('outcome', 16)->default('success')->after('action');
            if (!Schema::hasColumn('user_audit_logs', 'metadata')) $t->json('metadata')->nullable();
            if (!Schema::hasColumn('user_audit_logs', 'prev_event_hash')) $t->string('prev_event_hash', 64)->nullable();
            if (!Schema::hasColumn('user_audit_logs', 'event_hash')) $t->string('event_hash', 64)->nullable();
        });
    }
    public function down(): void {
        Schema::connection('pgsql')->table('user_audit_logs', function (Blueprint $t) {
            $t->dropColumn(['event_id', 'tenant_id', 'outcome', 'metadata', 'prev_event_hash', 'event_hash']);
        });
    }
};
```

- [ ] **Step 3.2: Failing test**

```php
<?php
use App\Audit\AuditEvent;
use App\Audit\Sinks\DatabaseAuditSink;
use App\Models\App\UserAuditLog;
use Illuminate\Support\Str;

beforeEach(fn() => $this->sink = app(DatabaseAuditSink::class));

it('writes an event to user_audit_logs', function () {
    $event = new AuditEvent(
        eventId: (string) Str::ulid(),
        occurredAt: new \DateTimeImmutable(),
        action: 'auth.login',
        actorUserId: 42,
        actorRole: 'researcher',
        tenantId: 1,
        ipAddress: '10.0.0.1',
        outcome: 'success',
        metadata: ['ua' => 'curl/8'],
    );

    expect($this->sink->write($event))->toBeTrue();
    $row = UserAuditLog::where('event_id', $event->eventId)->first();
    expect($row)->not->toBeNull()
        ->and($row->action)->toBe('auth.login')
        ->and((int) $row->user_id)->toBe(42)
        ->and((int) $row->tenant_id)->toBe(1)
        ->and($row->outcome)->toBe('success')
        ->and($row->metadata['ua'])->toBe('curl/8');
});

it('reports availability + sync mode', function () {
    expect($this->sink->name())->toBe('database')
        ->and($this->sink->isAvailable())->toBeTrue()
        ->and($this->sink->isSynchronous())->toBeTrue();
});

it('returns false on DB failure but does not throw', function () {
    DB::shouldReceive('table->insert')->andThrow(new \PDOException('boom'));
    $event = new AuditEvent(
        eventId: (string) Str::ulid(),
        occurredAt: new \DateTimeImmutable(),
        action: 'cohort.create',
        actorUserId: 1, actorRole: 'researcher', tenantId: 1,
    );
    expect(@$this->sink->write($event))->toBeFalse();  // must not throw
});

it('survives concurrent writes (unique constraint on event_id)', function () {
    $eid = (string) Str::ulid();
    $event = new AuditEvent(
        eventId: $eid,
        occurredAt: new \DateTimeImmutable(),
        action: 'cohort.create',
        actorUserId: 1, actorRole: 'researcher', tenantId: 1,
    );
    expect($this->sink->write($event))->toBeTrue();
    // Second write of same event_id is a no-op (idempotent)
    expect($this->sink->write($event))->toBeTrue();
    expect(UserAuditLog::where('event_id', $eid)->count())->toBe(1);
});
```

- [ ] **Step 3.3: DatabaseAuditSink implementation**

```php
<?php
namespace App\Audit\Sinks;

use App\Audit\AuditEvent;
use App\Contracts\AuditSinkInterface;
use App\Models\App\UserAuditLog;
use Illuminate\Support\Facades\Log;

class DatabaseAuditSink implements AuditSinkInterface
{
    public function name(): string { return 'database'; }
    public function isAvailable(): bool { return true; }
    public function isSynchronous(): bool { return true; }

    public function write(AuditEvent $event): bool {
        try {
            UserAuditLog::firstOrCreate(
                ['event_id' => $event->eventId],
                [
                    'user_id' => $event->actorUserId,
                    'tenant_id' => $event->tenantId,
                    'action' => $event->action,
                    'outcome' => $event->outcome,
                    'ip_address' => $event->ipAddress,
                    'user_agent' => $event->userAgent,
                    'metadata' => $event->metadata,
                    'created_at' => $event->occurredAt,
                    'updated_at' => $event->occurredAt,
                ],
            );
            return true;
        } catch (\Throwable $e) {
            Log::error('DatabaseAuditSink write failed', ['event_id' => $event->eventId, 'error' => $e->getMessage()]);
            return false;
        }
    }
}
```

- [ ] **Step 3.4: Run + commit**

```bash
git commit -m "feat(audit): AuditEvent + AuditSinkInterface + DatabaseAuditSink"
```

---

## Task 4: AuditSinkRegistry + AuditDispatcher

- [ ] **Step 4.1: Registry**

```php
<?php
namespace App\Audit;

use App\Contracts\AuditSinkInterface;

class AuditSinkRegistry
{
    /** @var array<int, AuditSinkInterface> */
    private array $sinks = [];

    public function register(AuditSinkInterface $sink): void { $this->sinks[] = $sink; }

    /** @return array<int, AuditSinkInterface> */
    public function sinks(): array { return $this->sinks; }

    /** @return array<int, string> Names of registered sinks. */
    public function names(): array { return array_map(fn($s) => $s->name(), $this->sinks); }

    /** Fan-out write. Returns map of sink name → success bool. */
    public function dispatch(AuditEvent $event): array {
        $results = [];
        foreach ($this->sinks as $sink) {
            $results[$sink->name()] = $sink->isAvailable() ? $sink->write($event) : false;
        }
        return $results;
    }
}
```

- [ ] **Step 4.2: Dispatcher (call site for application code)**

```php
<?php
namespace App\Audit;

use App\Contracts\TenantResolverInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class AuditDispatcher
{
    public function __construct(
        private readonly AuditSinkRegistry $registry,
        private readonly TenantResolverInterface $tenants,
    ) {}

    public function record(string $action, ?Request $request = null, array $metadata = [], string $outcome = 'success', ?string $resourceType = null, ?string $resourceId = null): array {
        $user = Auth::user();
        $event = new AuditEvent(
            eventId: (string) Str::ulid(),
            occurredAt: new \DateTimeImmutable(),
            action: $action,
            actorUserId: $user?->id,
            actorRole: $user?->getRoleNames()->first(),
            tenantId: $this->tenants->currentId(),
            resourceType: $resourceType,
            resourceId: $resourceId,
            ipAddress: $request?->ip(),
            userAgent: $request?->userAgent(),
            route: $request?->path(),
            outcome: $outcome,
            metadata: $metadata,
        );
        return $this->registry->dispatch($event);
    }
}
```

- [ ] **Step 4.3: ServiceProvider**

```php
<?php
namespace App\Providers;

use App\Audit\AuditDispatcher;
use App\Audit\AuditSinkRegistry;
use App\Audit\Sinks\DatabaseAuditSink;
use App\Contracts\AuditSinkInterface;
use Illuminate\Support\ServiceProvider;

class AuditServiceProvider extends ServiceProvider {
    public function register(): void {
        $this->app->singleton(AuditSinkRegistry::class);
        $this->app->singleton(AuditDispatcher::class);
    }
    public function boot(): void {
        $registry = $this->app->make(AuditSinkRegistry::class);
        foreach (config('audit.sinks', [DatabaseAuditSink::class]) as $sinkClass) {
            $registry->register($this->app->make($sinkClass));
        }
    }
}
```

- [ ] **Step 4.4: config/audit.php**

```php
<?php

use App\Audit\Sinks\DatabaseAuditSink;

return [
    'sinks' => [
        DatabaseAuditSink::class,
        // Future: enterprise/SignedAuditSink::class registered by EE service provider.
    ],

    'queue_connection' => env('AUDIT_QUEUE', 'redis'),
];
```

- [ ] **Step 4.5: Test fan-out**

```php
<?php
use App\Audit\AuditDispatcher;
use App\Audit\AuditSinkRegistry;
use App\Audit\Sinks\DatabaseAuditSink;
use App\Models\App\UserAuditLog;

it('writes through every registered sink', function () {
    $registry = app(AuditSinkRegistry::class);
    expect($registry->names())->toContain('database');

    $countBefore = UserAuditLog::count();
    app(AuditDispatcher::class)->record('test.event', null, ['k' => 'v']);
    expect(UserAuditLog::count())->toBe($countBefore + 1);
});
```

- [ ] **Step 4.6: Commit**

```bash
git commit -m "feat(audit): AuditSinkRegistry + AuditDispatcher fan-out"
```

---

## Task 5: Migrate existing audit call sites

Search for direct `UserAuditLog::create(...)` calls and replace with `AuditDispatcher::record(...)`. The dispatcher records the same fields plus the new ones (event_id, tenant_id, outcome). Behavior preserved.

```bash
grep -rn 'UserAuditLog::create' backend/app/ backend/routes/ 2>/dev/null
# Refactor each to: app(\App\Audit\AuditDispatcher::class)->record('...action...', $request, $metadata)
```

- [ ] **Step 5.1: Refactor `RecordUserActivity` middleware**
- [ ] **Step 5.2: Refactor `DesignAuditObserver`**
- [ ] **Step 5.3: Refactor any other call sites**
- [ ] **Step 5.4: Existing audit tests still pass**
- [ ] **Step 5.5: Commit**

---

## Task 6: Pluggability proof — StubSignedAuditSink

```php
<?php
namespace Tests\Feature\Audit;

use App\Audit\AuditEvent;
use App\Contracts\AuditSinkInterface;

class StubSignedAuditSink implements AuditSinkInterface {
    /** @var array<int, AuditEvent> */
    public array $written = [];
    public function name(): string { return 'stub-signed'; }
    public function isAvailable(): bool { return true; }
    public function isSynchronous(): bool { return false; }
    public function write(AuditEvent $event): bool { $this->written[] = $event; return true; }
}
```

```php
<?php
use App\Audit\AuditDispatcher;
use App\Audit\AuditSinkRegistry;
use Tests\Feature\Audit\StubSignedAuditSink;

it('fans out to a runtime-registered sink', function () {
    $stub = new StubSignedAuditSink();
    app(AuditSinkRegistry::class)->register($stub);
    app(AuditDispatcher::class)->record('cohort.create');
    expect($stub->written)->toHaveCount(1)
        ->and($stub->written[0]->action)->toBe('cohort.create');
});
```

---

## Task 7: Documentation + PR

- [ ] Doc page covers: AuditEvent contract, sink lifecycle, sync vs queued, signed-chain semantics for EE, retention policy guidance.
- [ ] PR title: "feat(audit): AuditSink extension point (Phase 2 #4 of 8)"

---

## Plan 02-04 completion checklist

- [ ] AuditEvent + AuditSinkInterface + DatabaseAuditSink + AuditSinkRegistry + AuditDispatcher all in place
- [ ] Existing audit call sites migrated to dispatcher; behavior unchanged
- [ ] Existing audit tests + new tests all pass
- [ ] Pluggability fixture + test demonstrate fan-out
- [ ] Doc page published
- [ ] PR merged

## Out of scope

- EE SignedAuditSink (S3 + WORM + cryptographic chaining) — Plan 04
- Audit log search/export UI — separate plan
- Real-time audit streaming to SIEM — Plan 04 / Plan 02-05 overlap
- Tamper-evident verification CLI — Plan 04

*End of Plan 02-04.*
