<?php

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\User;
use App\Services\Ares\AnnotationService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('create_annotation', function () {
    $user = User::factory()->create();
    $source = Source::factory()->create();
    $service = new AnnotationService();

    $annotation = $service->create($user, [
        'source_id' => $source->id,
        'chart_type' => 'gender',
        'x_value' => '8507',
        'y_value' => 45.2,
        'annotation_text' => 'Notable gender distribution skew',
    ]);

    expect($annotation)->toBeInstanceOf(ChartAnnotation::class);
    expect($annotation->created_by)->toBe($user->id);
    expect($annotation->chart_type)->toBe('gender');

    $this->assertDatabaseHas('chart_annotations', [
        'id' => $annotation->id,
        'created_by' => $user->id,
        'chart_type' => 'gender',
    ]);
});

test('for_chart_returns_matching_annotations', function () {
    $source = Source::factory()->create();
    $user = User::factory()->create();

    ChartAnnotation::factory()->create([
        'source_id' => $source->id,
        'chart_type' => 'gender',
        'created_by' => $user->id,
    ]);

    ChartAnnotation::factory()->create([
        'source_id' => $source->id,
        'chart_type' => 'age_at_first',
        'created_by' => $user->id,
    ]);

    $service = new AnnotationService();
    $results = $service->forChart('gender', $source->id);

    expect($results)->toHaveCount(1);
    expect($results->first()->chart_type)->toBe('gender');
    // Creator should be eager-loaded
    expect($results->first()->relationLoaded('creator'))->toBeTrue();
});

test('update_by_creator_succeeds', function () {
    $user = User::factory()->create();

    $annotation = ChartAnnotation::factory()->create([
        'created_by' => $user->id,
        'annotation_text' => 'Original text',
    ]);

    $service = new AnnotationService();
    $updated = $service->update($user, $annotation, [
        'annotation_text' => 'Updated text',
    ]);

    expect($updated->annotation_text)->toBe('Updated text');
});

test('update_by_non_creator_fails', function () {
    $creator = User::factory()->create();
    $other = User::factory()->create();

    $annotation = ChartAnnotation::factory()->create([
        'created_by' => $creator->id,
    ]);

    $service = new AnnotationService();

    $this->expectException(AuthorizationException::class);
    $service->update($other, $annotation, [
        'annotation_text' => 'Hacked text',
    ]);
});

test('delete_by_creator_succeeds', function () {
    $user = User::factory()->create();

    $annotation = ChartAnnotation::factory()->create([
        'created_by' => $user->id,
    ]);

    $service = new AnnotationService();
    $service->delete($user, $annotation);

    $this->assertDatabaseMissing('chart_annotations', [
        'id' => $annotation->id,
    ]);
});

test('delete_by_admin_succeeds', function () {
    $this->seed(RolePermissionSeeder::class);

    $creator = User::factory()->create();
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    $annotation = ChartAnnotation::factory()->create([
        'created_by' => $creator->id,
    ]);

    $service = new AnnotationService();
    $service->delete($admin, $annotation);

    $this->assertDatabaseMissing('chart_annotations', [
        'id' => $annotation->id,
    ]);
});
