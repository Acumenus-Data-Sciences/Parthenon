<?php

declare(strict_types=1);

use App\Models\App\PublicationDraft;
use App\Models\App\PublicationReportBundle;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function makeDraft(User $user, array $overrides = []): PublicationDraft
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
            'step' => 2,
            'selectedExecutions' => [],
            'sections' => [],
        ],
        'status' => 'draft',
    ], $overrides));
}

it('creates a named snapshot of a draft', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $draft = makeDraft($user);

    $response = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", [
            'label' => 'Pre-IRB',
            'comment' => 'For Sanjay review',
        ])
        ->assertCreated()
        ->json('data');

    expect($response['label'])->toBe('Pre-IRB');

    $bundle = PublicationReportBundle::find($response['id']);
    expect($bundle->direction)->toBe('snapshot');
    expect($bundle->format)->toBe('snapshot');
    expect($bundle->publication_draft_id)->toBe($draft->id);
    expect($bundle->metadata_json['snapshot_label'])->toBe('Pre-IRB');
});

it('lists snapshots for a draft newest first', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $draft = makeDraft($user);

    foreach (['S1', 'S2'] as $label) {
        $this->actingAs($user)
            ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => $label])
            ->assertCreated();
    }

    $list = $this->actingAs($user)
        ->getJson("/api/v1/publish/drafts/{$draft->id}/snapshots")
        ->assertOk()
        ->json('data');

    expect($list)->toHaveCount(2);
    expect($list[0]['label'])->toBe('S2');
});

it('reverts a snapshot and auto-snapshots the prior state', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $draft = makeDraft($user, ['title' => 'Original']);

    $snapshot = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'Original snapshot'])
        ->json('data');

    $draft->update([
        'title' => 'Modified',
        'document_json' => [
            'version' => 1,
            'title' => 'Modified',
            'authors' => [],
            'template' => 'generic-ohdsi',
            'step' => 3,
            'selectedExecutions' => [],
            'sections' => [],
        ],
    ]);

    $reverted = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots/{$snapshot['id']}/revert")
        ->assertOk()
        ->json('data');

    expect($reverted['title'])->toBe('Original');
    expect($reverted['document_json']['step'])->toBe(2);

    $autoSnapshot = PublicationReportBundle::where('publication_draft_id', $draft->id)
        ->where('direction', 'snapshot')
        ->where('metadata_json->snapshot_label', 'Before revert (auto)')
        ->first();
    expect($autoSnapshot)->not->toBeNull();
});

it('returns 412 on stale If-Unmodified-Since', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $draft = makeDraft($user);

    // Update once to advance updated_at
    $draft->update(['title' => 'Updated elsewhere']);
    $stale = now()->subMinute()->toRfc7231String();

    $this->actingAs($user)
        ->withHeaders(['If-Unmodified-Since' => $stale])
        ->patchJson("/api/v1/publish/drafts/{$draft->id}", ['title' => 'My change'])
        ->assertStatus(412);
});

it('dedupes snapshot creates within idempotency window', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');
    $draft = makeDraft($user);

    $key = (string) Str::uuid();

    $first = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'S', 'idempotency_key' => $key])
        ->assertCreated()
        ->json('data');

    $second = $this->actingAs($user)
        ->postJson("/api/v1/publish/drafts/{$draft->id}/snapshots", ['label' => 'S', 'idempotency_key' => $key])
        ->assertCreated()
        ->json('data');

    expect($second['id'])->toBe($first['id']);
});
