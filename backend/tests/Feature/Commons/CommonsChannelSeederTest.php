<?php

namespace Tests\Feature\Commons;

use App\Models\Commons\Channel;
use App\Models\User;
use Database\Seeders\CommonsChannelSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(RefreshDatabase::class);

test('seeds exactly four skeleton channels', function () {
    User::factory()->create(['email' => 'admin@acumenus.net']);

    $this->seed(CommonsChannelSeeder::class);

    $slugs = Channel::pluck('slug')->sort()->values()->toArray();
    expect($slugs)->toBe(['announcements', 'concept-sets', 'data-quality', 'general']);
});

test('seeder is idempotent — running twice does not duplicate channels', function () {
    User::factory()->create(['email' => 'admin@acumenus.net']);

    $this->seed(CommonsChannelSeeder::class);
    $this->seed(CommonsChannelSeeder::class);

    expect(Channel::count())->toBe(4);
});

test('seeder does not delete channels that already exist with messages', function () {
    $admin = User::factory()->create(['email' => 'admin@acumenus.net']);

    $this->seed(CommonsChannelSeeder::class);

    // Re-running the seeder should not touch existing channels
    $generalId = Channel::where('slug', 'general')->value('id');
    $this->seed(CommonsChannelSeeder::class);

    expect(Channel::where('slug', 'general')->value('id'))->toBe($generalId);
});
