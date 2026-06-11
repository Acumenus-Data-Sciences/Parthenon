<?php

use App\Enums\GateStatus;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyGate;
use App\Models\App\StudyResult;
use App\Models\User;
use App\Services\Analysis\StudyService;
use App\Services\Studies\StudyResultProjector;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

if (! function_exists('projectorStudy')) {
    function projectorStudy(User $user): Study
    {
        return Study::create([
            'title' => 'Projector study',
            'created_by' => $user->id,
            'principal_investigator_id' => $user->id,
            'status' => 'running',
            'primary_objective' => 'Validate result projection.',
        ]);
    }

    /**
     * @param  array<string, mixed>  $resultJson
     */
    function projectorExecution(object $analysis, Source $source, array $resultJson, string $status = 'completed'): object
    {
        return $analysis->executions()->create([
            'source_id' => $source->id,
            'status' => $status,
            'result_json' => $resultJson,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    function projectorEstimationJson(float $smdAfter = 0.02): array
    {
        return [
            'summary' => ['target_count' => 1000, 'comparator_count' => 800, 'outcome_counts' => []],
            'propensity_score' => ['auc' => 0.6, 'equipoise' => 0.9, 'max_smd_after' => $smdAfter],
            'estimates' => [[
                'outcome_id' => 1, 'outcome_name' => 'CKD',
                'hazard_ratio' => 1.4, 'ci_95_lower' => 1.1, 'ci_95_upper' => 1.8, 'p_value' => 0.01,
            ]],
            'calibration' => [
                'status' => 'completed', 'informative_negative_controls' => 8, 'ease' => 0.02,
                'calibrated_estimates' => [[
                    'outcome_id' => 1, 'outcome_name' => 'CKD', 'calibrated' => true,
                    'calibrated_hr' => 1.37, 'cal_ci_lower' => 1.05, 'cal_ci_upper' => 1.8, 'calibrated_p' => 0.02,
                ]],
            ],
        ];
    }
}

it('auto-projects a completed estimation execution into a publishable effect_estimate result', function () {
    $user = User::factory()->create();
    $study = projectorStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = EstimationAnalysis::create(['name' => 'PLE', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => EstimationAnalysis::class, 'analysis_id' => $analysis->id]);

    StudyGate::create([
        'study_id' => $study->id, 'stage' => 'study_diagnostics', 'gate_key' => 'default',
        'status' => GateStatus::Passed->value, 'metrics_json' => ['reasons' => []], 'decision' => 'auto',
    ]);

    // Creating a completed execution should fire AnalysisExecutionObserver → projector.
    $execution = projectorExecution($analysis, $source, projectorEstimationJson(0.02));

    $result = StudyResult::where('study_id', $study->id)->where('result_type', 'effect_estimate')->first();

    expect($result)->not->toBeNull()
        ->and($result->analysis_execution_id)->toBe($execution->id)
        ->and($result->is_publishable)->toBeTrue()
        ->and($result->diagnostics['cleared'])->toBeTrue()
        ->and($result->diagnostics['calibrated'])->toBeTrue()
        ->and($result->summary_data['summary']['target_count'])->toBe(1000);
});

it('withholds publishability when the estimation diagnostics do not clear', function () {
    $user = User::factory()->create();
    $study = projectorStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = EstimationAnalysis::create(['name' => 'PLE', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => EstimationAnalysis::class, 'analysis_id' => $analysis->id]);

    // Unbalanceable contrast (SMD 0.30 > 0.10) and no overriding gate → not cleared.
    projectorExecution($analysis, $source, projectorEstimationJson(0.30));

    $result = StudyResult::where('study_id', $study->id)->where('result_type', 'effect_estimate')->first();

    expect($result)->not->toBeNull()
        ->and($result->is_publishable)->toBeFalse()
        ->and($result->diagnostics['cleared'])->toBeFalse();
});

it('projects a characterization execution into a publishable descriptive result', function () {
    $user = User::factory()->create();
    $study = projectorStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = Characterization::create(['name' => 'Baseline', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => Characterization::class, 'analysis_id' => $analysis->id]);

    projectorExecution($analysis, $source, [
        'results' => [[
            'cohort_id' => 5441, 'cohort_name' => 'Target', 'person_count' => 109763,
            'features' => ['demographics' => [['feature_name' => 'Gender', 'category' => 'FEMALE', 'count' => 60000, 'percent' => 54.7]]],
        ]],
    ]);

    $result = StudyResult::where('study_id', $study->id)->where('result_type', 'characterization')->first();

    expect($result)->not->toBeNull()
        ->and($result->is_publishable)->toBeTrue()
        ->and($result->diagnostics)->toBeNull()
        ->and($result->summary_data['results'][0]['person_count'])->toBe(109763);
});

it('preserves reviewer-set is_primary across re-projection (backfill idempotency)', function () {
    $user = User::factory()->create();
    $study = projectorStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = EstimationAnalysis::create(['name' => 'PLE', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => EstimationAnalysis::class, 'analysis_id' => $analysis->id]);
    projectorExecution($analysis, $source, projectorEstimationJson(0.02));

    $result = StudyResult::where('study_id', $study->id)->where('result_type', 'effect_estimate')->firstOrFail();
    $result->update(['is_primary' => true]); // curator marks the primary contrast

    // Re-run the backfill projector — must not reset curation.
    app(StudyResultProjector::class)->projectStudy($study->fresh());

    expect(StudyResult::find($result->id)->is_primary)->toBeTrue()
        ->and(StudyResult::where('study_id', $study->id)->where('result_type', 'effect_estimate')->count())->toBe(1);
});

it('attaches a normalized latest_execution to each analysis (D3 normalization fix)', function () {
    $user = User::factory()->create();
    $study = projectorStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = IncidenceRateAnalysis::create(['name' => 'IR', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => IncidenceRateAnalysis::class, 'analysis_id' => $analysis->id]);

    // Upstream emits 0/0 CI placeholders; the normalizer must fill them (Byar's).
    projectorExecution($analysis, $source, [
        'results' => [[
            'outcome_cohort_id' => 99, 'outcome_cohort_name' => 'MACE',
            'persons_at_risk' => 1000, 'persons_with_outcome' => 50, 'person_years' => 2000.0,
            'incidence_rate' => 25.0, 'rate_95_ci_lower' => 0, 'rate_95_ci_upper' => 0, 'strata' => [],
        ]],
    ]);

    $study = $study->fresh();
    app(StudyService::class)->attachLatestExecutions($study);

    $latest = $study->analyses->first()->analysis->getAttribute('latest_execution');
    $upper = $latest->result_json['results'][0]['rate_95_ci_upper'];

    expect($latest)->not->toBeNull()
        ->and($latest->status->value)->toBe('completed')
        ->and($upper)->toBeGreaterThan(0.0); // proves normalization ran on this endpoint
});

it('backfills results via the studies:backfill-results command', function () {
    $user = User::factory()->create();
    $study = projectorStudy($user);
    $source = Source::create(['source_name' => 'Test CDM', 'source_key' => 'TEST']);

    $analysis = EstimationAnalysis::create(['name' => 'PLE', 'author_id' => $user->id, 'design_json' => []]);
    StudyAnalysis::create(['study_id' => $study->id, 'analysis_type' => EstimationAnalysis::class, 'analysis_id' => $analysis->id]);
    projectorExecution($analysis, $source, projectorEstimationJson(0.02));

    // Wipe the observer-projected row to prove the command repopulates it.
    StudyResult::where('study_id', $study->id)->delete();

    $this->artisan('studies:backfill-results', ['study' => (string) $study->id])
        ->assertExitCode(0);

    expect(StudyResult::where('study_id', $study->id)->where('result_type', 'effect_estimate')->count())->toBe(1);
});
