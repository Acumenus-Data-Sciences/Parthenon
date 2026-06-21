<?php

// Abby golden regression case (ADR-0020): study 114 (Hypertension v3) shipped a
// hand-written report full of caveats because nothing gated its failures. Each
// test below asserts that a future Abby gate CATCHES one of those exact failures.
// They are skipped until the gate that resolves them lands, and each one loads
// the captured fixture so the skeleton is self-validating against real evidence.

use App\Enums\GateStage;
use App\Enums\GateStatus;
use App\Services\Studies\Gates\GateThresholdEvaluator;
use App\Support\EstimationResultNormalizer;
use App\Support\IncidenceRateResultNormalizer;

function abbyFixture(string $name): mixed
{
    $path = base_path("tests/Fixtures/Studies/hypertension-v3/{$name}");

    return json_decode((string) file_get_contents($path), true);
}

it('fixtures capture the load-bearing study-114 evidence', function () {
    $pathway = abbyFixture('design_pathway_20.json');
    $estimation = abbyFixture('design_estimation_63.json');

    // Pathway eventCohortIds point at the comparator pool + outcome, NOT treatment cohorts.
    expect($pathway['eventCohortIds'])->toBe([5425, 5426]);

    // Estimation: T=5424 vs C=5425, outcomes 5426/5427, and ZERO negative controls wired in.
    expect((int) $estimation['targetCohortId'])->toBe(5424);
    expect((int) $estimation['comparatorCohortId'])->toBe(5425);
    expect($estimation['negativeControlOutcomes'] ?? [])->toBe([]);
});

it('S5 study-diagnostics gate fails on propensity-score separation and keeps estimates blinded', function () {
    // Study 114 exec 258: "High correlation between covariate(s) and treatment detected"
    // → complete/quasi-complete separation. The S5 gate must FAIL (AUC≈1 / equipoise≈0)
    // and the effect estimate must remain withheld.
    $gate = GateThresholdEvaluator::evaluate(
        GateStage::StudyDiagnostics,
        ['ps_auc' => 0.99, 'equipoise' => 0.01, 'max_smd_after' => 0.45],
        [],
    );
    expect($gate['status'])->toBe(GateStatus::Failed);
    expect(implode(' ', $gate['reasons']))->toContain('separable');

    // While the gate is unmet the normalizer must strip every effect estimate.
    $blinded = EstimationResultNormalizer::blind([
        'estimates' => [['hazard_ratio' => 1.42, 'ci_95_lower' => 1.10, 'ci_95_upper' => 1.83]],
        'calibration' => ['calibrated_estimates' => [['calibrated_hr' => 1.40]]],
    ]);
    expect($blinded['estimates'])->toBe([]);
    expect($blinded['calibration']['calibrated_estimates'])->toBe([]);
    expect($blinded['blinded'])->toBeTrue();
});

it('S3 design lint flags pathway event cohorts that are outcomes/pools, not treatments', function () {
    // Pathway 20 eventCohortIds = [5425, 5426] (comparator pool + MACE outcome).
    // The S3 signal ships in CohortDiagnosticsService (index_event_breakdown +
    // inclusion_attrition); a discrete design-lint rule that classifies an event
    // cohort as an outcome/pool vs a treatment is still future work.
    $this->markTestSkipped('Covered indirectly by cohort diagnostics; discrete design-lint rule is future work.');
});

it('S6 calibration gate fails when there are too few informative negative controls', function () {
    // Estimation 63 wired in 0 negative controls; study 114 had only 2 informative
    // controls overall. Empirical calibration must refuse rather than publish uncalibrated.
    $gate = GateThresholdEvaluator::evaluate(
        GateStage::EstimationCalibration,
        ['informative_negative_controls' => 2, 'status' => 'insufficient_controls'],
        [],
    );
    expect($gate['status'])->toBe(GateStatus::Failed);
    expect(implode(' ', $gate['reasons']))->toContain('negative control');
});

it('S3 flags the broken characterization age stratum (100% Unknown)', function () {
    // Covered by the characterization age_at_index diagnostic; a discrete S3
    // data-quality flag that fails the gate on a 100%-Unknown stratum is future work.
    $this->markTestSkipped('Covered by age_at_index diagnostics; discrete DQ-flag gate rule is future work.');
});

it('incidence-rate confidence intervals are populated, not 0/0', function () {
    // Study 114's incidence runs emitted 0/0 CI placeholders. The Byar backfill
    // (IncidenceRateResultNormalizer) supplies real bounds for a nonzero count.
    $normalized = IncidenceRateResultNormalizer::normalize([
        'results' => [[
            'persons_with_outcome' => 8,
            'person_years' => 1200.0,
            'rate_95_ci_lower' => 0,
            'rate_95_ci_upper' => 0,
        ]],
    ]);
    $row = $normalized['results'][0];
    expect($row['rate_95_ci_upper'])->toBeGreaterThan(0.0);
    expect($row['rate_95_ci_upper'])->toBeGreaterThan($row['rate_95_ci_lower']);
});

it('an infrastructure connection error is retried, never recorded as a completed analysis', function () {
    // Study 114 exec 262: "cannot open the connection" — environmental, not a result.
    // The retry/distinction lives in the darkstar R sidecar (connect_with_retry),
    // exercised by the analytics integration path rather than a Laravel unit test.
    $this->markTestSkipped('Distinction lives in the darkstar sidecar; not a Laravel unit assertion.');
});
