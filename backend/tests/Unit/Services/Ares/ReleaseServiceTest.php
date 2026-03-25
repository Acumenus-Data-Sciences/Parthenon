<?php

use App\Events\ReleaseCreated;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Services\Ares\ReleaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

test('create_release_stores_and_fires_event', function () {
    Event::fake([ReleaseCreated::class]);

    $source = Source::factory()->create();
    $service = new ReleaseService;

    $release = $service->createRelease($source, [
        'release_name' => 'Q1 2026 Release',
        'release_type' => 'scheduled_etl',
        'cdm_version' => '5.4',
        'vocabulary_version' => 'v5.0',
        'notes' => 'First quarterly release',
    ]);

    expect($release)->toBeInstanceOf(SourceRelease::class);
    expect($release->source_id)->toBe($source->id);
    expect($release->release_name)->toBe('Q1 2026 Release');
    expect($release->release_key)->not->toBeEmpty();

    $this->assertDatabaseHas('source_releases', [
        'id' => $release->id,
        'source_id' => $source->id,
        'release_name' => 'Q1 2026 Release',
    ]);

    Event::assertDispatched(ReleaseCreated::class, function (ReleaseCreated $event) use ($release) {
        return $event->release->id === $release->id;
    });
});

test('auto_snapshot_creates_release_for_auto_mode', function () {
    Event::fake([ReleaseCreated::class]);

    $source = Source::factory()->create(['release_mode' => 'auto']);
    $service = new ReleaseService;

    $release = $service->autoSnapshot($source, 'run-abc-123');

    expect($release)->toBeInstanceOf(SourceRelease::class);
    expect($release->source_id)->toBe($source->id);
    expect($release->release_type)->toBe('snapshot');

    Event::assertDispatched(ReleaseCreated::class);
});

test('auto_snapshot_skips_for_manual_mode', function () {
    Event::fake([ReleaseCreated::class]);

    $source = Source::factory()->create(['release_mode' => 'manual']);
    $service = new ReleaseService;

    $result = $service->autoSnapshot($source, 'run-abc-123');

    expect($result)->toBeNull();

    Event::assertNotDispatched(ReleaseCreated::class);
});

test('get_timeline_returns_releases_ordered_by_date', function () {
    $source = Source::factory()->create();

    $oldest = SourceRelease::factory()->create([
        'source_id' => $source->id,
        'created_at' => now()->subDays(3),
    ]);
    $middle = SourceRelease::factory()->create([
        'source_id' => $source->id,
        'created_at' => now()->subDays(1),
    ]);
    $newest = SourceRelease::factory()->create([
        'source_id' => $source->id,
        'created_at' => now(),
    ]);

    $service = new ReleaseService;
    $timeline = $service->getTimeline($source);

    expect($timeline)->toHaveCount(3);
    expect($timeline->first()->id)->toBe($newest->id);
    expect($timeline->last()->id)->toBe($oldest->id);
});

test('release_key_is_unique_per_source', function () {
    $sourceA = Source::factory()->create(['source_key' => 'source-a']);
    $sourceB = Source::factory()->create(['source_key' => 'source-b']);

    $service = new ReleaseService;

    Event::fake([ReleaseCreated::class]);

    $releaseA = $service->createRelease($sourceA, [
        'release_name' => 'Release A',
        'release_type' => 'snapshot',
    ]);

    $releaseB = $service->createRelease($sourceB, [
        'release_name' => 'Release B',
        'release_type' => 'snapshot',
    ]);

    // Both should succeed — keys contain source_key so different sources can coexist
    expect($releaseA)->toBeInstanceOf(SourceRelease::class);
    expect($releaseB)->toBeInstanceOf(SourceRelease::class);
    expect($releaseA->release_key)->not->toBe($releaseB->release_key);
});
