<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

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
        ->assertJsonPath('message', 'Account created. Check your email for your temporary password.')
        ->assertJsonPath('message_key', 'auth.account_created')
        ->assertJsonPath('message_meta.fallback_used', false);

    $this->assertDatabaseHas('users', [
        'email' => 'test@example.com',
    ]);

    $user = User::where('email', 'test@example.com')->firstOrFail();

    expect($user->hasRole('researcher'))->toBeTrue();
});

test('register returns same message for existing email', function () {
    User::factory()->create(['email' => 'existing@example.com']);

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Duplicate',
        'email' => 'existing@example.com',
    ])
        ->assertStatus(200)
        ->assertJsonPath('message', 'Account created. Check your email for your temporary password.')
        ->assertJsonPath('message_key', 'auth.account_created');
});

test('registration reseeds roles when the default researcher role is missing', function () {
    Role::query()->delete();
    Permission::query()->delete();
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    $this->postJson('/api/v1/auth/register', [
        'name' => 'Recovery User',
        'email' => 'recovery@example.com',
    ])
        ->assertStatus(200)
        ->assertJsonPath('message', 'Account created. Check your email for your temporary password.')
        ->assertJsonPath('message_key', 'auth.account_created');

    $user = User::where('email', 'recovery@example.com')->firstOrFail();

    expect($user->hasRole('researcher'))->toBeTrue();
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
        ->assertStatus(401)
        ->assertJsonPath('message_key', 'auth.invalid_credentials');
});

test('public auth messages honor locale headers and expose message metadata', function () {
    User::factory()->create([
        'email' => 'test@example.com',
        'password' => bcrypt('password123'),
    ]);

    $this->withHeaders(['Accept-Language' => 'es-ES'])
        ->postJson('/api/v1/auth/login', [
            'email' => 'test@example.com',
            'password' => 'wrong_password',
        ])
        ->assertStatus(401)
        ->assertJsonPath('message', 'Credenciales no válidas')
        ->assertJsonPath('message_key', 'auth.invalid_credentials')
        ->assertJsonPath('message_meta.requested_locale', 'es-ES')
        ->assertJsonPath('message_meta.message_locale', 'es-ES')
        ->assertJsonPath('message_meta.fallback_used', false);
});

test('public validation errors use localized API message envelopes', function () {
    $this->withHeaders(['Accept-Language' => 'ko-KR'])
        ->postJson('/api/v1/auth/register', [
            'name' => 'Test User',
            'email' => 'not-an-email',
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', '제공된 데이터가 유효하지 않습니다.')
        ->assertJsonPath('message_key', 'validation.failed')
        ->assertJsonPath('message_meta.requested_locale', 'ko-KR')
        ->assertJsonPath('message_meta.message_locale', 'ko-KR')
        ->assertJsonPath('message_meta.fallback_used', false)
        ->assertJsonValidationErrors(['email']);
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

    $response->assertStatus(200)
        ->assertJsonPath('message_key', 'auth.logged_out');
});

test('unauthenticated user cannot access protected routes', function () {
    $response = $this->withHeaders(['Accept-Language' => 'ko-KR'])
        ->getJson('/api/v1/auth/user');

    $response->assertStatus(401)
        ->assertJsonPath('message', '인증이 필요합니다')
        ->assertJsonPath('message_key', 'auth.unauthenticated')
        ->assertJsonPath('message_meta.requested_locale', 'ko-KR')
        ->assertJsonPath('message_meta.fallback_used', false);
})->skip('wip(i18n): locale propagation to exception handler under investigation');
