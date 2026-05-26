<?php

use App\Models\App\Study;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

it('authorizes the owner and rejects a stranger on the design-session channel', function () {
    $this->seed(RolePermissionSeeder::class);

    // Force a broadcaster that actually enforces channel authorization. The default
    // connection is `null` (BROADCAST_CONNECTION unset → CI copies .env.example),
    // whose auth() short-circuits and returns 200 for any authenticated user, so the
    // reject leg can only be exercised under a real driver. PusherBroadcaster::auth
    // computes the channel signature locally (HMAC) — no network call is made.
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app-id',
        'broadcasting.connections.reverb.options.host' => '127.0.0.1',
        'broadcasting.connections.reverb.options.port' => 8080,
        'broadcasting.connections.reverb.options.scheme' => 'http',
        'broadcasting.connections.reverb.options.useTLS' => false,
    ]);

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
