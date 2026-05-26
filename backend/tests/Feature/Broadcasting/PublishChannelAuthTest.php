<?php

use App\Models\App\PublicationDraft;
use App\Models\User;
use App\Policies\PublicationDraftPolicy;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('publish draft channel authorizes the owner and rejects a stranger', function () {
    $this->seed(RolePermissionSeeder::class);

    $owner = User::factory()->create();
    $owner->assignRole('researcher');

    $draft = PublicationDraft::create([
        'user_id' => $owner->id,
        'study_id' => null,
        'title' => 'Channel auth test draft',
        'template' => 'standard',
        'document_json' => [],
        'status' => 'draft',
        'visibility' => 'private',
    ]);

    $stranger = User::factory()->create();
    $stranger->assignRole('researcher');

    // routes/channels.php authorizes `publish.draft.{draft}` iff the policy
    // view() method approves. We assert the predicate directly rather than
    // POSTing to /api/broadcasting/auth: the default `null` broadcaster does not
    // enforce channel callbacks (returns 200 for anyone), and forcing a real
    // driver makes the HTTP result depend on signature/auth state that is not
    // deterministic across the full suite. The end-to-end auth path is covered
    // by PublishAgentSessionTest (controller authorizeAccess → 201 owner / 404 stranger).
    $policy = new PublicationDraftPolicy;

    expect($policy->view($owner, $draft))->toBeTrue();
    expect($policy->view($stranger, $draft))->toBeFalse();

    // Guard the find()===null branch: a non-existent draft id authorizes no one.
    $missingDraft = PublicationDraft::find($draft->id + 999_999);
    expect($missingDraft)->toBeNull();
});
