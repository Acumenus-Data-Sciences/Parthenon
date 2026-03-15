<?php

use App\Models\App\CohortDefinition;
use App\Models\App\DesignAuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('logs a created action when a cohort definition is made', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name' => 'T2DM Cohort',
        'description' => 'Type 2 diabetes patients',
        'expression_json' => ['PrimaryCriteria' => []],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'created')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->old_json)->toBeNull()
        ->and($log->new_json['name'])->toBe('T2DM Cohort')
        ->and($log->entity_name)->toBe('T2DM Cohort');
});

it('logs an updated action with before/after state', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name' => 'Original Name',
        'description' => 'desc',
        'expression_json' => [],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $cohort->update(['name' => 'Updated Name']);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'updated')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->old_json['name'])->toBe('Original Name')
        ->and($log->new_json['name'])->toBe('Updated Name')
        ->and($log->changed_fields)->toContain('name');
});

it('logs a deleted action when a cohort is soft-deleted', function () {
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name' => 'To Delete',
        'expression_json' => [],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $cohort->delete();

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'deleted')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->old_json['name'])->toBe('To Delete')
        ->and($log->new_json)->toBeNull();
});

it('captures actor when authenticated', function () {
    $user = User::factory()->create(['email' => 'researcher@example.com']);

    $this->actingAs($user);

    $cohort = CohortDefinition::create([
        'name' => 'Authenticated Cohort',
        'expression_json' => [],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'created')
        ->first();

    expect($log->actor_id)->toBe($user->id)
        ->and($log->actor_email)->toBe('researcher@example.com');
});

it('sets actor to null for seeder/system creates', function () {
    // No actingAs() — simulates seeder context
    $user = User::factory()->create();

    $cohort = CohortDefinition::create([
        'name' => 'Seeded Cohort',
        'expression_json' => [],
        'author_id' => $user->id,
        'is_public' => false,
    ]);

    $log = DesignAuditLog::where('entity_type', 'cohort_definition')
        ->where('entity_id', $cohort->id)
        ->where('action', 'created')
        ->first();

    expect($log->actor_id)->toBeNull()
        ->and($log->actor_email)->toBeNull();
});
