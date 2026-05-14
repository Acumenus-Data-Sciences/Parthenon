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
