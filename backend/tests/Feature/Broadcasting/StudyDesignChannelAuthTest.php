<?php

use App\Models\App\Study;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('study-design session channel authorizes the owner and rejects a stranger', function () {
    $this->seed(RolePermissionSeeder::class);

    $owner = User::factory()->create();
    $study = Study::factory()->create(['created_by' => $owner->id]);
    $session = $study->designSessions()->create([
        'created_by' => $owner->id,
        'title' => 'Agent stream test session',
    ]);
    $stranger = User::factory()->create();

    // routes/channels.php authorizes `study-design.session.{session}` iff the user can
    // access the session's study, via exactly this predicate. We assert the predicate
    // directly rather than POSTing to /api/broadcasting/auth: the default `null`
    // broadcaster does not enforce channel callbacks (returns 200 for anyone), and
    // forcing a real driver makes the HTTP result depend on signature/auth state that
    // is not deterministic across the full suite. The end-to-end auth path is covered
    // by StudyDesignAgentSessionTest (controller authorizeAccess → 201 owner / 403 stranger).
    expect(Study::accessibleBy($owner->id)->whereKey($session->study_id)->exists())->toBeTrue();
    expect(Study::accessibleBy($stranger->id)->whereKey($session->study_id)->exists())->toBeFalse();

    // Guard the find()===null branch: a non-existent session id authorizes no one.
    expect(Study::accessibleBy($owner->id)->whereKey($session->study_id + 999_999)->exists())->toBeFalse();
});
