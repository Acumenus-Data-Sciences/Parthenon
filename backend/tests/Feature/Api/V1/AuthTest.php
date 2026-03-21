<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Prevent rate-limiter interference across parallel tests
    $this->withoutMiddleware(ThrottleRequests::class);
    // Fake mail so registration doesn't need a real mail driver
    Mail::fake();
    // Seed roles/permissions required by registration flow
    $this->seed(RolePermissionSeeder::class);
});

test('user can register', function () {
    $response = $this->postJson('/api/v1/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);

    // Returns 200 with generic message (prevents email enumeration)
    $response->assertStatus(200)
        ->assertJsonPath('message', 'Account created. Check your email for your temporary password.');

    $this->assertDatabaseHas('users', [
        'email' => 'test@example.com',
    ]);
});

test('register returns same message for existing email', function () {
    User::factory()->create(['email' => 'existing@example.com']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Duplicate',
        'email' => 'existing@example.com',
    ])
        ->assertStatus(200)
        ->assertJsonPath('message', 'Account created. Check your email for your temporary password.');
});

test('user can login', function () {
    User::factory()->create([
        'email' => 'test@example.com',
        'password' => bcrypt('password123'),
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'test@example.com',
        'password' => 'password123',
    ]);

    $response->assertStatus(200)
        ->assertJsonStructure(['token', 'user']);
});

test('login fails with wrong password', function () {
    User::factory()->create([
        'email' => 'test@example.com',
        'password' => bcrypt('password123'),
    ]);

    $this->postJson('/api/v1/auth/login', [
        'email' => 'test@example.com',
        'password' => 'wrong_password',
    ])
        ->assertStatus(401);
});

test('user can get profile with token', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->getJson('/api/v1/auth/user', [
        'Authorization' => "Bearer {$token}",
    ]);

    $response->assertStatus(200)
        ->assertJsonPath('id', $user->id);
});

test('user can logout', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->postJson('/api/v1/auth/logout', [], [
        'Authorization' => "Bearer {$token}",
    ]);

    $response->assertStatus(200);
});

test('unauthenticated user cannot access protected routes', function () {
    $response = $this->getJson('/api/v1/auth/user');

    $response->assertStatus(401);
});
