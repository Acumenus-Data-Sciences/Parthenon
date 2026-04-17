<?php

use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Interfaces\EncodedImageInterface;
use Intervention\Image\Interfaces\ImageInterface;
use Intervention\Image\Interfaces\ImageManagerInterface;
use Intervention\Image\Laravel\Facades\Image;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    // Disable rate limiting so tests don't interfere with each other
    $this->withoutMiddleware(ThrottleRequests::class);
});

// ── Update Profile ───────────────────────────────────────────────────────────

it('requires authentication to update profile', function () {
    $this->putJson('/api/v1/user/profile', ['name' => 'Test'])
        ->assertStatus(401);
});

it('updates user profile with valid data', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/profile', [
            'name' => 'Updated Name',
            'phone_number' => '555-1234',
            'job_title' => 'Data Analyst',
            'department' => 'Research',
            'organization' => 'Acumenus',
            'bio' => 'Outcomes researcher specializing in observational studies.',
        ])
        ->assertOk()
        ->assertJsonPath('message', 'Profile updated successfully')
        ->assertJsonPath('user.name', 'Updated Name')
        ->assertJsonPath('user.job_title', 'Data Analyst');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Updated Name',
        'job_title' => 'Data Analyst',
    ]);
});

it('validates name is required on profile update', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/profile', [
            'phone_number' => '555-1234',
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

it('validates name max length on profile update', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/profile', [
            'name' => str_repeat('a', 256),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['name']);
});

it('validates bio max length on profile update', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/profile', [
            'name' => 'Valid Name',
            'bio' => str_repeat('a', 2001),
        ])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['bio']);
});

it('allows nullable optional fields on profile update', function () {
    $user = User::factory()->create([
        'phone_number' => '555-0000',
        'job_title' => 'Old Title',
    ]);
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/profile', [
            'name' => $user->name,
            'phone_number' => null,
            'job_title' => null,
            'department' => null,
            'organization' => null,
            'bio' => null,
        ])
        ->assertOk()
        ->assertJsonPath('message', 'Profile updated successfully');
});

// ── Update Locale ───────────────────────────────────────────────────────────

it('requires authentication to update locale', function () {
    $this->putJson('/api/v1/user/locale', ['locale' => 'fr-FR'])
        ->assertStatus(401);
});

it('updates user locale with a supported language', function () {
    $user = User::factory()->create(['locale' => 'en-US']);
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/locale', ['locale' => 'ko-KR'])
        ->assertOk()
        ->assertJsonPath('locale', 'ko-KR');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'locale' => 'ko-KR',
    ]);
});

it('rejects unsupported locales', function () {
    $user = User::factory()->create(['locale' => 'en-US']);
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->putJson('/api/v1/user/locale', ['locale' => 'tlh'])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['locale']);
});

// ── Upload Avatar ────────────────────────────────────────────────────────────

it('requires authentication to upload avatar', function () {
    $this->postJson('/api/v1/user/avatar', [])
        ->assertStatus(401);
});

it('uploads a valid avatar image', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $user->assignRole('viewer');

    $file = UploadedFile::fake()->image('avatar.jpg', 200, 200);

    // Mock Intervention ImageManager to avoid GD/Imagick dependency in CI
    $mockEncoded = Mockery::mock(EncodedImageInterface::class);
    $mockEncoded->shouldReceive('__toString')->andReturn('fake-image-bytes');

    $mockImage = Mockery::mock(ImageInterface::class);
    $mockImage->shouldReceive('scaleDown')->once()->andReturnSelf();
    $mockImage->shouldReceive('toJpeg')->andReturn($mockEncoded);

    $this->mock(ImageManagerInterface::class, function ($mock) use ($mockImage) {
        $mock->shouldReceive('read')->once()->andReturn($mockImage);
    });

    $this->actingAs($user)
        ->postJson('/api/v1/user/avatar', ['avatar' => $file])
        ->assertOk()
        ->assertJsonPath('message', 'Avatar uploaded successfully')
        ->assertJsonStructure(['message', 'avatar']);
})->skip(! class_exists(Image::class), 'Intervention Image facade not available in CI');

it('rejects non-image file for avatar', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $user->assignRole('viewer');

    $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

    $this->actingAs($user)
        ->postJson('/api/v1/user/avatar', ['avatar' => $file])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['avatar']);
});

it('rejects avatar exceeding max file size', function () {
    Storage::fake('public');

    $user = User::factory()->create();
    $user->assignRole('viewer');

    // Max is 5120 KB (5 MB) — create a 6 MB file
    $file = UploadedFile::fake()->image('large.jpg')->size(6000);

    $this->actingAs($user)
        ->postJson('/api/v1/user/avatar', ['avatar' => $file])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['avatar']);
});

it('validates avatar field is required', function () {
    $user = User::factory()->create();
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->postJson('/api/v1/user/avatar', [])
        ->assertStatus(422)
        ->assertJsonValidationErrors(['avatar']);
});

// ── Delete Avatar ────────────────────────────────────────────────────────────

it('requires authentication to delete avatar', function () {
    $this->deleteJson('/api/v1/user/avatar')
        ->assertStatus(401);
});

it('deletes existing avatar', function () {
    Storage::fake('public');

    $user = User::factory()->create(['avatar' => 'avatars/test.jpg']);
    $user->assignRole('viewer');

    Storage::disk('public')->put('avatars/test.jpg', 'fake-image-content');

    $this->actingAs($user)
        ->deleteJson('/api/v1/user/avatar')
        ->assertOk()
        ->assertJsonPath('message', 'Avatar removed successfully');

    $user->refresh();
    expect($user->avatar)->toBeNull();
    Storage::disk('public')->assertMissing('avatars/test.jpg');
});

it('handles delete when no avatar exists', function () {
    $user = User::factory()->create(['avatar' => null]);
    $user->assignRole('viewer');

    $this->actingAs($user)
        ->deleteJson('/api/v1/user/avatar')
        ->assertOk()
        ->assertJsonPath('message', 'Avatar removed successfully');
});
