<?php

declare(strict_types=1);

use App\Models\App\PublicationDraft;
use App\Models\App\Study;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

/**
 * @param  array<string, mixed>  $overrides
 */
function makePolicyDraft(User $user, array $overrides = []): PublicationDraft
{
    return PublicationDraft::create(array_merge([
        'user_id' => $user->id,
        'title' => 'X',
        'template' => 'generic-ohdsi',
        'document_json' => [
            'version' => 1,
            'title' => 'X',
            'authors' => [],
            'template' => 'generic-ohdsi',
            'step' => 1,
            'selectedExecutions' => [],
            'sections' => [],
        ],
        'status' => 'draft',
        'visibility' => 'private',
    ], $overrides));
}

it('owner can view their private draft', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $draft = makePolicyDraft($user);

    $this->actingAs($user)->getJson("/api/v1/publish/drafts/{$draft->id}")->assertOk();
});

it('study collaborator can view a study-shared draft', function () {
    $owner = User::factory()->create();
    $owner->assignRole('researcher');
    $collab = User::factory()->create();
    $collab->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $owner->id]);
    DB::table('study_team_members')->insert([
        'study_id' => $study->id,
        'user_id' => $collab->id,
        'role' => 'collaborator',
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $draft = makePolicyDraft($owner, ['study_id' => $study->id, 'visibility' => 'study']);

    $this->actingAs($collab)->getJson("/api/v1/publish/drafts/{$draft->id}")->assertOk();
});

it('outsider cannot view a private draft owned by someone else', function () {
    $owner = User::factory()->create();
    $owner->assignRole('researcher');
    $outsider = User::factory()->create();
    $outsider->assignRole('researcher');

    $draft = makePolicyDraft($owner);

    $this->actingAs($outsider)->getJson("/api/v1/publish/drafts/{$draft->id}")->assertNotFound();
});

it('rejects visibility=study when study_id is null', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $this->actingAs($user)
        ->postJson('/api/v1/publish/drafts', [
            'title' => 'X',
            'template' => 'generic-ohdsi',
            'document_json' => [
                'version' => 1,
                'title' => 'X',
                'authors' => [],
                'template' => 'generic-ohdsi',
                'step' => 1,
                'selectedExecutions' => [],
                'sections' => [],
            ],
            'visibility' => 'study',
            'study_id' => null,
        ])
        ->assertStatus(422);
});

it('listDrafts returns drafts shared with the user via study membership', function () {
    $owner = User::factory()->create();
    $owner->assignRole('researcher');
    $collab = User::factory()->create();
    $collab->assignRole('researcher');

    $study = Study::factory()->create(['created_by' => $owner->id]);
    DB::table('study_team_members')->insert([
        'study_id' => $study->id,
        'user_id' => $collab->id,
        'role' => 'collaborator',
        'is_active' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $sharedDraft = makePolicyDraft($owner, ['study_id' => $study->id, 'visibility' => 'study']);
    $privateDraft = makePolicyDraft($owner, ['title' => 'Private']); // private, should not appear

    $ids = collect(
        $this->actingAs($collab)
            ->getJson('/api/v1/publish/drafts')
            ->assertOk()
            ->json('data')
    )->pluck('id')->all();

    expect($ids)->toContain($sharedDraft->id);
    expect($ids)->not->toContain($privateDraft->id);
});

// ── Regression tests for write-permission gaps (audit 2026-05-14) ──────────

it('view-only collaborator cannot delete an owner draft', function () {
    $owner = User::factory()->create();
    $owner->assignRole('researcher');
    $viewer = User::factory()->create();
    $viewer->assignRole('researcher'); // researcher has studies.view but the
    // policy gate for delete is owner-only, not permission-driven.

    $study = Study::factory()->create(['created_by' => $owner->id]);
    DB::table('study_team_members')->insert([
        'study_id' => $study->id, 'user_id' => $viewer->id,
        'role' => 'collaborator', 'is_active' => true,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    $draft = makePolicyDraft($owner, [
        'study_id' => $study->id, 'visibility' => 'study',
    ]);

    $this->actingAs($viewer)
        ->deleteJson("/api/v1/publish/drafts/{$draft->id}")
        ->assertForbidden();

    // Draft still exists
    expect(PublicationDraft::find($draft->id))->not->toBeNull();
});

it('view-only collaborator cannot create a snapshot on a shared draft', function () {
    $owner = User::factory()->create();
    $owner->assignRole('researcher');
    $viewer = User::factory()->create();
    // Researcher role grants studies.edit so we use 'viewer' role
    // which has studies.view but not studies.edit.
    $viewer->assignRole('viewer');

    $study = Study::factory()->create(['created_by' => $owner->id]);
    DB::table('study_team_members')->insert([
        'study_id' => $study->id, 'user_id' => $viewer->id,
        'role' => 'collaborator', 'is_active' => true,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    $draft = makePolicyDraft($owner, [
        'study_id' => $study->id, 'visibility' => 'study',
    ]);

    // Viewer can read but not snapshot
    $this->actingAs($viewer)
        ->getJson("/api/v1/publish/drafts/{$draft->id}")
        ->assertOk();

    $this->actingAs($viewer)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'Sneaky'])
        ->assertForbidden();
});

it('view-only collaborator cannot revert a snapshot on a shared draft', function () {
    $owner = User::factory()->create();
    $owner->assignRole('researcher');
    $viewer = User::factory()->create();
    $viewer->assignRole('viewer');

    $study = Study::factory()->create(['created_by' => $owner->id]);
    DB::table('study_team_members')->insert([
        'study_id' => $study->id, 'user_id' => $viewer->id,
        'role' => 'collaborator', 'is_active' => true,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    $draft = makePolicyDraft($owner, [
        'study_id' => $study->id, 'visibility' => 'study',
    ]);

    // Owner creates a snapshot
    $snapshot = $this->actingAs($owner)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'V1'])
        ->assertCreated()
        ->json('data');

    // Viewer cannot revert
    $this->actingAs($viewer)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots/{$snapshot['id']}/revert")
        ->assertForbidden();
});
