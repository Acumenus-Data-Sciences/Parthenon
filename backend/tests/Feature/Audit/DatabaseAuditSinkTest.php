<?php

use App\Audit\AuditEvent;
use App\Audit\Sinks\DatabaseAuditSink;
use App\Models\App\UserAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->sink = app(DatabaseAuditSink::class);
});

it('reports name and synchronous mode', function () {
    expect($this->sink->name())->toBe('database')
        ->and($this->sink->isAvailable())->toBeTrue()
        ->and($this->sink->isSynchronous())->toBeTrue();
});

it('writes an AuditEvent to user_audit_logs', function () {
    $user = User::factory()->create(['email' => 'sink-write-test@parthenon.local']);

    $event = new AuditEvent(
        eventId: (string) Str::ulid(),
        occurredAt: new DateTimeImmutable,
        action: 'auth.login',
        actorUserId: $user->id,
        actorRole: 'researcher',
        tenantId: 1,
        ipAddress: '10.0.0.1',
        userAgent: 'curl/8',
        outcome: 'success',
        metadata: ['driver' => 'local'],
    );

    expect($this->sink->write($event))->toBeTrue();

    $row = UserAuditLog::where('event_id', $event->eventId)->first();
    expect($row)->not->toBeNull()
        ->and($row->action)->toBe('auth.login')
        ->and((int) $row->user_id)->toBe($user->id)
        ->and((int) $row->tenant_id)->toBe(1)
        ->and($row->outcome)->toBe('success')
        ->and($row->ip_address)->toBe('10.0.0.1')
        ->and($row->user_agent)->toBe('curl/8')
        ->and($row->metadata)->toMatchArray(['driver' => 'local']);
});

it('is idempotent on event_id (re-writing same event is a no-op)', function () {
    $user = User::factory()->create(['email' => 'sink-idempotent-test@parthenon.local']);

    $eid = (string) Str::ulid();
    $event = new AuditEvent(
        eventId: $eid,
        occurredAt: new DateTimeImmutable,
        action: 'cohort.create',
        actorUserId: $user->id,
        actorRole: 'researcher',
        tenantId: 1,
    );

    expect($this->sink->write($event))->toBeTrue();
    expect($this->sink->write($event))->toBeTrue();

    expect(UserAuditLog::where('event_id', $eid)->count())->toBe(1);
});

it('records null actor for anonymous events', function () {
    $event = new AuditEvent(
        eventId: (string) Str::ulid(),
        occurredAt: new DateTimeImmutable,
        action: 'auth.login_failure',
        actorUserId: null,
        actorRole: null,
        tenantId: 1,
        ipAddress: '203.0.113.5',
        outcome: 'failure',
    );

    expect($this->sink->write($event))->toBeTrue();
    $row = UserAuditLog::where('event_id', $event->eventId)->first();
    expect($row->user_id)->toBeNull()
        ->and($row->outcome)->toBe('failure');
});
