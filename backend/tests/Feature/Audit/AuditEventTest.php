<?php

use App\Audit\AuditEvent;
use Illuminate\Support\Str;

it('serializes to a stable canonical JSON form (R4)', function () {
    $occurred = new DateTimeImmutable('2026-05-09T20:00:00.000000+00:00');

    $event = new AuditEvent(
        eventId: '01HXXX',
        occurredAt: $occurred,
        action: 'cohort.create',
        actorUserId: 7,
        actorRole: 'researcher',
        tenantId: 1,
        resourceType: 'cohort',
        resourceId: '42',
        outcome: 'success',
        metadata: ['name' => 'My Cohort', 'tags' => ['a', 'b']],
    );

    $canonical = $event->canonicalJson();

    // Lexicographic key order at top level
    expect(json_decode($canonical, true))->toBeArray();

    // Keys present and ordered (action < actor_role < actor_user_id < event_id < ...)
    $decoded = json_decode($canonical, true, 512, JSON_THROW_ON_ERROR);
    $keys = array_keys($decoded);
    $sortedKeys = $keys;
    sort($sortedKeys);
    expect($keys)->toBe($sortedKeys);
});

it('produces identical canonical JSON for two events with same content', function () {
    $occurred = new DateTimeImmutable('2026-05-09T20:00:00.000000+00:00');

    $event1 = new AuditEvent(
        eventId: 'X',
        occurredAt: $occurred,
        action: 'a',
        actorUserId: 1,
        actorRole: 'r',
        tenantId: 1,
        metadata: ['z' => 1, 'a' => 2],
    );

    $event2 = new AuditEvent(
        eventId: 'X',
        occurredAt: $occurred,
        action: 'a',
        actorUserId: 1,
        actorRole: 'r',
        tenantId: 1,
        metadata: ['a' => 2, 'z' => 1],   // different insertion order, same data
    );

    expect($event1->canonicalJson())->toBe($event2->canonicalJson());
});

it('canonicalJson encodes unicode without escaping', function () {
    $event = new AuditEvent(
        eventId: 'X',
        occurredAt: new DateTimeImmutable,
        action: 'note.add',
        actorUserId: 1,
        actorRole: null,
        tenantId: 1,
        metadata: ['note' => 'café — résumé'],
    );

    expect($event->canonicalJson())->toContain('café — résumé');
});

it('toArray includes all fields', function () {
    $event = new AuditEvent(
        eventId: (string) Str::ulid(),
        occurredAt: new DateTimeImmutable,
        action: 'test',
        actorUserId: 5,
        actorRole: 'admin',
        tenantId: 1,
        resourceType: 'foo',
        resourceId: '1',
        sourceKey: 'omop',
        ipAddress: '10.0.0.1',
        userAgent: 'curl',
        route: '/api/v1/test',
        outcome: 'denied',
        metadata: ['k' => 'v'],
    );

    $arr = $event->toArray();
    expect($arr)->toHaveKeys([
        'event_id', 'occurred_at', 'action', 'actor_user_id', 'actor_role',
        'tenant_id', 'resource_type', 'resource_id', 'source_key',
        'ip_address', 'user_agent', 'route', 'outcome', 'metadata',
    ]);
});
