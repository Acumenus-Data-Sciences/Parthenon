<?php

use App\Models\App\HeorAnalysis;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('soft-deletes a heor analysis instead of hard-deleting', function () {
    $user = User::factory()->create();
    $analysis = HeorAnalysis::create([
        'created_by' => $user->id,
        'name' => 'Test HEOR',
        'analysis_type' => 'cost_effectiveness',
        'status' => 'draft',
    ]);

    $analysis->delete();

    // Row still in DB with deleted_at set
    $this->assertDatabaseHas('heor_analyses', ['id' => $analysis->id]);
    $this->assertNotNull(HeorAnalysis::withTrashed()->find($analysis->id)?->deleted_at);

    // Not returned by default query
    $this->assertNull(HeorAnalysis::find($analysis->id));
});
