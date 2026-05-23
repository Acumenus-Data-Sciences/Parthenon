<?php

use App\Models\App\Study;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it('authorizes the owner and rejects a stranger on the design-session channel', function () {
    $this->seed(RolePermissionSeeder::class);

    $owner = User::factory()->create();
    $study = Study::factory()->create(['created_by' => $owner->id]);
    $session = $study->designSessions()->create([
        'created_by' => $owner->id,
        'title' => 'Agent stream test session',
    ]);

    Sanctum::actingAs($owner);
    $this->post('/api/broadcasting/auth', [
        'socket_id' => '123.456',
        'channel_name' => "private-study-design.session.{$session->id}",
    ])->assertOk();

    $stranger = User::factory()->create();
    Sanctum::actingAs($stranger);
    $this->post('/api/broadcasting/auth', [
        'socket_id' => '123.456',
        'channel_name' => "private-study-design.session.{$session->id}",
    ])->assertForbidden();
});
