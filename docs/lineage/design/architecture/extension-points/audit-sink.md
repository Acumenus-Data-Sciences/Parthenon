---
doc_type: spec
status: historical
date: 2026-05-09
owner: acumenus
module: extension-points
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Contracts/AuditSinkInterface.php
related_prs: []
---
# Extension Point: Audit Sink

**Interface:** `App\Contracts\AuditSinkInterface`
**Default sink (CE):** `App\Audit\Sinks\DatabaseAuditSink`
**Service provider:** `App\Providers\AuditServiceProvider`
**Public API:** `App\Audit\AuditDispatcher` (`app(AuditDispatcher::class)->record(...)`)
**Registry:** `App\Audit\AuditSinkRegistry`
**Config:** `backend/config/audit.php`
**Status:** Live since [Phase 2 #4](../../superpowers/plans/2026-05-09-ce-ee-fork-plan-02-04-audit-sink.md)

## Purpose

Decouple audit-event persistence from a specific destination. CE writes synchronously to `app.user_audit_logs`. EE additionally registers a `SignedAuditSink` that signs events with HMAC-SHA-256 (chained per-tenant) and ships JSONL to S3 / Azure Blob with WORM retention. Both run in fan-out — the EE sink is additive, never a replacement.

The architecture has four collaborating pieces:

1. **`AuditEvent`** — immutable value object describing one event (eventId, occurredAt, action, actor, tenant, resource, ip/UA, outcome, metadata, optional chain hashes).
2. **`AuditSinkInterface`** — the extension contract. Each sink implements `name()`, `isAvailable()`, `isSynchronous()`, and `write(AuditEvent): bool`.
3. **`AuditSinkRegistry`** — singleton, holds N sinks, dispatches every event to all of them.
4. **`AuditDispatcher`** — public API. Application code calls `record('action', $request, [...])`; the dispatcher builds the `AuditEvent` from auth + tenant context and fans out.

## The contract

```php
interface AuditSinkInterface
{
    public function name(): string;
    public function isAvailable(): bool;
    public function isSynchronous(): bool;
    public function write(AuditEvent $event): bool;
}
```

### Sinks must NOT throw

`write()` MUST log internally and return `false` on failure. The dispatcher records partial failures in its return map; one sink failing doesn't abort the request and doesn't prevent other sinks from receiving the event. The only exception: a sink can throw to ABORT the request if customer policy requires (e.g., EE's `SignedAuditSink` may throw if WORM storage is unreachable when the customer has a "no-audit-no-action" policy).

### Synchronous vs queued

`isSynchronous()` returns `true` for in-request sinks (DatabaseAuditSink). EE's SignedAuditSink returns `false` and dispatches via Laravel queue (Horizon) — `write()` enqueues the JSONL ship and returns true immediately. The CE-EE boundary respects this naturally: synchronous sinks must be fast (database insert is OK).

## `AuditEvent` and the canonical JSON form (R4)

```php
final readonly class AuditEvent
{
    public string $eventId;                      // ULID — unique, sortable
    public \DateTimeImmutable $occurredAt;
    public string $action;                       // 'auth.login', 'cohort.create', etc.
    public ?int $actorUserId;
    public ?string $actorRole;
    public int $tenantId;
    public ?string $resourceType;
    public ?string $resourceId;
    public ?string $sourceKey;                   // CDM source if applicable
    public ?string $ipAddress;
    public ?string $userAgent;
    public ?string $route;
    public string $outcome;                      // 'success' | 'failure' | 'denied'
    public array $metadata;
    public ?string $prevEventHash;               // set by signed-chain sinks

    public function toArray(): array;
    public function canonicalJson(): string;
}
```

`canonicalJson()` is the load-bearing piece for HMAC chains:

1. `toArray()` produces the field map
2. Sort top-level keys lexicographically
3. Sort any nested array keys lexicographically (deterministic metadata ordering)
4. JSON encode with `JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR`

Result: identical canonical bytes for the same event regardless of which implementation produced it. EE's SignedAuditSink computes `event_hash = HMAC-SHA-256(signing_key, canonicalJson || prev_event_hash)`. An auditor can independently verify the chain end-to-end given the signing key.

## CE-shipped sink

### `DatabaseAuditSink`

- Synchronous; persists to `app.user_audit_logs`
- Idempotent on `event_id` via `firstOrCreate(['event_id' => ...])` — re-writing the same event is a no-op
- Returns `false` (not throws) on `\Throwable`, with a `Log::error(...)` call documenting what failed
- Always `isAvailable()` (no external deps)

The `user_audit_logs` table has the standard columns (user_id, action, ip_address, user_agent, metadata, occurred_at) plus the new chain support: `event_id` (unique ULID), `outcome`, `prev_event_hash`, `event_hash`. `tenant_id` was added by the Plan 02-02 migration.

## How application code records events

```php
use App\Audit\AuditDispatcher;

// Anywhere with $request in scope:
app(AuditDispatcher::class)->record(
    action: 'cohort.create',
    request: $request,
    metadata: ['cohort_id' => $cohort->id, 'name' => $cohort->name],
    outcome: 'success',
    resourceType: 'cohort',
    resourceId: (string) $cohort->id,
);
```

The dispatcher reads `Auth::user()` for `actorUserId` + `actorRole` and `app(TenantResolverInterface::class)->currentId()` for `tenantId`. Anonymous events (e.g. failed login) work too — `actorUserId` and `actorRole` are nullable.

## Registering a custom sink

### Pattern A — config-driven (CE convention)

Add to `config/audit.php`:

```php
'sinks' => [
    \App\Audit\Sinks\DatabaseAuditSink::class,
    \My\Vendor\Audit\Sinks\SyslogSink::class,
],
```

`AuditServiceProvider::boot()` instantiates each at boot and registers with the singleton registry.

### Pattern B — runtime registration (EE convention)

EE's `EnterpriseServiceProvider::boot()`:

```php
$registry = $this->app->make(\App\Audit\AuditSinkRegistry::class);
if ($licenseService->hasEntitlement('audit.signed')) {
    $registry->register($this->app->make(SignedAuditSink::class));
}
```

This is preferred when registration depends on runtime entitlements.

## Hypothetical EE `SignedAuditSink`

```php
class SignedAuditSink implements AuditSinkInterface
{
    public function __construct(
        private readonly CryptoProviderInterface $crypto,
        private readonly string $signingKey,
        private readonly Filesystem $wormStorage,   // S3 with object-lock
    ) {}

    public function name(): string { return 'signed'; }
    public function isAvailable(): bool { /* check WORM reachability */ }
    public function isSynchronous(): bool { return false; }   // queued

    public function write(AuditEvent $event): bool {
        // Per-tenant chain head from app.audit_chain_state
        $prevHash = AuditChainState::lockAndGetPrevHash($event->tenantId);

        // Recompute event_hash deterministically
        $canonical = $event->canonicalJson();
        $eventHash = $this->crypto->hmac($this->signingKey, $canonical . $prevHash);

        AuditChainState::advance($event->tenantId, $eventHash);

        // Queue the JSONL ship to WORM
        ShipSignedAuditEventJob::dispatch([
            'event' => $event->toArray(),
            'prev_event_hash' => $prevHash,
            'event_hash' => $eventHash,
            'signed_at' => now()->toIso8601String(),
        ])->onQueue('audit-worm');

        return true;
    }
}
```

The job PUTs the JSONL line to S3 with `x-amz-object-lock-mode: COMPLIANCE` (S3 Object Lock) or `x-ms-immutability-policy-mode: locked` (Azure Blob). Once written, neither the customer nor Acumenus can modify or delete the record before the retention period expires.

## Migration to existing call sites

Code currently writes audit logs directly via `UserAuditLog::create([...])` in:

- `App\Http\Controllers\Api\V1\AuthController` (login)
- `App\Http\Controllers\Api\V1\Admin\UserController` (admin user actions)
- `App\Http\Controllers\Api\V1\Admin\UserAuditController` (admin audit views — read-only, no migration needed)
- `App\Http\Middleware\RecordUserActivity` (per-request feature access)
- `App\Observers\DesignProtection\DesignAuditObserver` (model-level design tracking)

These are NOT migrated to `AuditDispatcher::record()` in this PR. Reasons:

1. Each call site has its own action name, metadata shape, and audit semantics — migrating mechanically risks dropping fields.
2. The new `event_id` / `outcome` columns are nullable on existing rows, so legacy direct-creates still work (UserAuditLog model has them in `$fillable`).
3. Mixing the extension-point introduction with a behavioral refactor of 5 call sites makes review harder.

The follow-up rolling-refactor PR migrates each call site one at a time, with per-call-site test verification.

## Testing patterns

- **Value object:** `tests/Feature/Audit/AuditEventTest.php` — canonical JSON stability, key ordering, unicode passthrough, complete `toArray()`.
- **CE sink:** `tests/Feature/Audit/DatabaseAuditSinkTest.php` — write roundtrip, idempotency on event_id, anonymous-actor handling.
- **Dispatcher:** `tests/Feature/Audit/AuditDispatcherTest.php` — fan-out to default sink, auth-context capture, runtime stub registration via `StubSignedAuditSink`, per-sink result map.
- **Pluggability fixture:** `tests/Feature/Audit/StubSignedAuditSink.php` — minimal in-memory sink demonstrating the contract.

## Security notes

- **PHI/PII in metadata.** The `metadata` array goes into `user_audit_logs.metadata` (JSONB) and into any signed-chain sink. Do NOT pass raw patient identifiers, free-text clinical notes, or other PHI through `metadata`. Use opaque resource ids (cohort_id, study_id) and let auditors join against authoritative tables when investigating.
- **Audit log integrity.** CE's DatabaseAuditSink offers tamper-resistance only as far as DB row-level write protection. EE's SignedAuditSink adds cryptographic chain verification, but only if the customer keeps the signing key separate from the database. Document this in customer onboarding.
- **Backpressure.** A failing sink that's also synchronous + slow can degrade request latency. Sinks that may block (network calls) MUST return `isSynchronous() === false` and queue the work.
- **Race on chain head.** EE SignedAuditSink uses a row-level lock on `app.audit_chain_state(tenant_id)` to serialize chain advancement. Without the lock, concurrent writes can fork the chain.

## Out of scope (deferred)

- EE `SignedAuditSink` implementation — Plan 04
- WORM retention policy configuration UI — separate plan
- Real-time audit streaming to SIEM (Splunk HEC, Datadog logs) — overlaps with Plan 02-05 + Plan 04 EE shippers
- Audit log search/export UI — separate plan
- Tamper-evident verification CLI (`php artisan audit:verify-chain --tenant=N`) — Plan 04 EE
- Migrating existing UserAuditLog::create call sites to AuditDispatcher — follow-up rolling-refactor PR
