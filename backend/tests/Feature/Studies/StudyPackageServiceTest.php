<?php

use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Models\App\StudyCohort;
use App\Models\App\StudyPackage;
use App\Models\User;
use App\Services\Studies\StudyPackageService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('clioMakeStudyWithCohort')) {
    /**
     * @return array{0: Study, 1: CohortDefinition}
     */
    function clioMakeStudyWithCohort(User $user): array
    {
        $study = Study::create([
            'title' => 'Clio package test study',
            'created_by' => $user->id,
            'status' => 'draft',
        ]);

        $cohort = CohortDefinition::create([
            'name' => 'Target cohort',
            'author_id' => $user->id,
            'version' => 1,
            'expression_json' => ['PrimaryCriteria' => ['CriteriaList' => [['domain' => 'Condition']]]],
            'is_public' => false,
        ]);

        StudyCohort::create([
            'study_id' => $study->id,
            'cohort_definition_id' => $cohort->id,
            'role' => 'target',
            'label' => 'Target cohort',
        ]);

        return [$study, $cohort];
    }
}

it('builds a study package capturing cohort definition hashes', function () {
    $user = User::factory()->create();
    [$study] = clioMakeStudyWithCohort($user);

    $package = app(StudyPackageService::class)->build($study, $user->id);

    expect($package)->toBeInstanceOf(StudyPackage::class)
        ->and($package->version)->toBe(1)
        ->and($package->bundle_sha256)->toMatch('/^[0-9a-f]{64}$/')
        ->and($package->bundle_json['gate_ledger'])->toBe([])
        ->and($package->bundle_json['concept_sets_and_cohorts'][0]['expression_sha256'])->not->toBeNull()
        ->and($package->bundle_json['concept_sets_and_cohorts'][0]['role'])->toBe('target');

    $this->assertDatabaseHas('study_packages', [
        'study_id' => $study->id,
        'version' => 1,
    ]);
});

it('is reproducible: rebuilding an unchanged study yields the same bundle hash but a new version', function () {
    $user = User::factory()->create();
    [$study] = clioMakeStudyWithCohort($user);
    $service = app(StudyPackageService::class);

    $first = $service->build($study, $user->id);
    $second = $service->build($study->fresh(), $user->id);

    expect($second->version)->toBe(2)
        ->and($second->bundle_sha256)->toBe($first->bundle_sha256);
});

it('changes the bundle hash when the cohort definition expression changes', function () {
    $user = User::factory()->create();
    [$study, $cohort] = clioMakeStudyWithCohort($user);
    $service = app(StudyPackageService::class);

    $first = $service->build($study, $user->id);

    $cohort->update(['expression_json' => ['PrimaryCriteria' => ['CriteriaList' => [['domain' => 'Drug']]]]]);

    $second = $service->build($study->fresh(), $user->id);

    expect($second->bundle_sha256)->not->toBe($first->bundle_sha256);
});
