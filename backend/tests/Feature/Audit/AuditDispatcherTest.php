<?php

use App\Audit\AuditDispatcher;
use App\Audit\AuditSinkRegistry;
use App\Models\App\UserAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\Audit\StubSignedAuditSink;

uses(RefreshDatabase::class);

it('dispatches an event through every registered sink (CE default = database)', function () {
    $countBefore = UserAuditLog::count();

    /** @var AuditDispatcher $dispatcher */
    $dispatcher = app(AuditDispatcher::class);
    $dispatcher->record('test.event', null, ['k' => 'v']);

    expect(UserAuditLog::count())->toBe($countBefore + 1);
});

it('records the authenticated user when present', function () {
    $user = User::factory()->create([
        'email' => 'auditor-aud@parthenon.local',
    ]);
    $this->actingAs($user);

    /** @var AuditDispatcher $dispatcher */
    $dispatcher = app(AuditDispatcher::class);
    $dispatcher->record('cohort.read', null, ['cohort_id' => 99]);

    $row = UserAuditLog::where('action', 'cohort.read')
        ->where('user_id', $user->id)
        ->latest('id')
        ->first();
    expect($row)->not->toBeNull()
        ->and($row->metadata)->toMatchArray(['cohort_id' => 99]);
});

it('fans out to a runtime-registered alternate sink (proves pluggability)', function () {
    $stub = new StubSignedAuditSink;

    /** @var AuditSinkRegistry $registry */
    $registry = app(AuditSinkRegistry::class);
    $registry->register($stub);

    /** @var AuditDispatcher $dispatcher */
    $dispatcher = app(AuditDispatcher::class);
    $dispatcher->record('cohort.create', null, []);

    expect($stub->written)->toHaveCount(1)
        ->and($stub->written[0]->action)->toBe('cohort.create');

    // And the database sink also received it (fan-out, not replacement).
    expect(UserAuditLog::where('action', 'cohort.create')->latest('id')->first())->not->toBeNull();
});

it('returns a per-sink success/failure map', function () {
    /** @var AuditDispatcher $dispatcher */
    $dispatcher = app(AuditDispatcher::class);
    $result = $dispatcher->record('test.event2');

    expect($result)->toHaveKey('database')
        ->and($result['database'])->toBeTrue();
});
