<?php

// Abby golden regression case (ADR-0020): study 114 (Hypertension v3) shipped a
// hand-written report full of caveats because nothing gated its failures. Each
// test below asserts that a future Abby gate CATCHES one of those exact failures.
// They are skipped until the gate that resolves them lands, and each one loads
// the captured fixture so the skeleton is self-validating against real evidence.

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
    $this->markTestSkipped('Awaits Phase 3/5: S5 study-diagnostics gate + estimate blinding.');
});

it('S3 design lint flags pathway event cohorts that are outcomes/pools, not treatments', function () {
    // Pathway 20 eventCohortIds = [5425, 5426] (comparator pool + MACE outcome).
    $this->markTestSkipped('Awaits Phase 4/5: cohort-diagnostics + design-lint gate.');
});

it('S6 calibration gate fails when there are too few informative negative controls', function () {
    // Estimation 63 wired in 0 negative controls; study 114 had only 2 informative
    // controls overall. Empirical calibration must refuse rather than publish uncalibrated.
    $this->markTestSkipped('Awaits Phase 2/3: empirical-calibration service + S6 gate.');
});

it('S3 flags the broken characterization age stratum (100% Unknown)', function () {
    $this->markTestSkipped('Awaits Phase 4: characterization data-quality flag.');
});

it('incidence-rate confidence intervals are populated, not 0/0', function () {
    // Byar backfill (IncidenceRateResultNormalizer) supplies real bounds.
    $this->markTestSkipped('Verified by IncidenceRateResultNormalizer; wire into the regression assertion in Phase 4.');
});

it('an infrastructure connection error is retried, never recorded as a completed analysis', function () {
    // Study 114 exec 262: "cannot open the connection" — environmental, not a result.
    $this->markTestSkipped('Awaits Phase 5: darkstar retry distinction in the orchestrator.');
});
