<?php

declare(strict_types=1);

/**
 * Phase 19 Plan 05 — Wave 4 SMOKE TEST.
 *
 * End-to-end smoke that exercises the full Plan 02-03-04 chain on the
 * LIVE DEV `parthenon` database. NOT a unit test; NOT executed by
 * `make test` (excluded via the @group smoke / @group phase19 tags).
 *
 * What it proves:
 *  - gis schema deployed (Plan 02)
 *  - load_geography + load_crosswalk + load_ua_county populated rows
 *    (Plan 03 — gis.geographic_location, gis.location_geography,
 *    gis.patient_geography matview, gis.external_exposure)
 *  - IncidenceRateService.location_urban_pct stratification (Plan 04)
 *    actually returns >=2 strata with persons_at_risk >=5 each on
 *    ACUMENUS — proving the dormant-data → live-stratification chain.
 *  - app.gis_imports has at least one cli_loader row reconciled by
 *    GisImportTracker (Plan 03 panel reconciliation).
 *
 * Disposition references (from PLAN frontmatter):
 *  - B-01 — `app.sources.source_key`, NOT `source_code`
 *  - B-03 — Source lives at `App\Models\App\Source`
 *  - B-04 — IncidenceRateService::execute takes IncidenceRateAnalysis
 *  - B-05 — execute() signature: (IncidenceRateAnalysis, Source, AnalysisExecution)
 *
 * Run:
 *   docker compose exec -T php sh -c \
 *     "cd /var/www/html && vendor/bin/pest tests/Smoke/UrbanRuralStratificationSmokeTest.php --group=smoke"
 */

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\Source;                 // B-03
use App\Services\Analysis\IncidenceRateService;
use Illuminate\Support\Facades\DB;

beforeEach(function () {
    // Skip if we're running against parthenon_testing (no live data).
    // B-01 — `source_key` is the canonical column.
    $source = Source::where('source_key', 'ACUMENUS')->first();
    if (! $source) {
        $this->markTestSkipped(
            'ACUMENUS source not registered (likely parthenon_testing). '
            .'Smoke must run against DEV parthenon DB with Plan 03 data loaded.'
        );
    }
    $this->source = $source;

    // Verify gis schema exists (Plan 02).
    $schemaExists = DB::selectOne(
        "SELECT 1 AS ok FROM pg_namespace WHERE nspname = 'gis'"
    );
    if (! $schemaExists) {
        $this->markTestSkipped('gis schema not deployed (Plan 02 not applied).');
    }
})->group('smoke', 'phase19');

it('Phase 19 smoke — gis schema is deployed with Plan 03 data loaded (GIS-01, GIS-02)', function (): void {
    // gis.geographic_location county rows
    $countyCount = DB::selectOne(
        "SELECT COUNT(*) AS n FROM gis.geographic_location WHERE location_type = 'county'"
    )->n ?? 0;
    expect((int) $countyCount)->toBeGreaterThanOrEqual(3234);

    // gis.external_exposure urban_pct rows for ACUMENUS
    /** @var Source $source */
    $source = $this->source;
    $eeCount = DB::selectOne(
        'SELECT COUNT(*) AS n FROM gis.external_exposure '
        ."WHERE source_id = {$source->id} AND exposure_type = 'urban_pct' "
        ."AND source_dataset LIKE 'census_ua_2020%'"
    )->n ?? 0;
    expect((int) $eeCount)->toBeGreaterThanOrEqual(400_000);

    // app.gis_imports cli_loader rows (Plan 03 panel reconciliation)
    $importCount = DB::selectOne(
        "SELECT COUNT(*) AS n FROM app.gis_imports WHERE import_mode = 'cli_loader' AND status = 'completed'"
    )->n ?? 0;
    expect((int) $importCount)->toBeGreaterThanOrEqual(1);
})->group('smoke', 'phase19');

it('Phase 19 smoke — IncidenceRateService advertises location_urban_pct (GIS-03)', function (): void {
    expect(IncidenceRateService::supportedStratifications())->toContain('location_urban_pct');
})->group('smoke', 'phase19');

it('Phase 19 smoke — stratifyByLocation=urban_pct produces multi-stratum result on ACUMENUS (GIS-03, GIS-04)', function (): void {
    /** @var Source $source */
    $source = $this->source;

    // Resolve ACUMENUS results schema — B-03/Plan 04 pattern.
    $source->load('daimons');
    $resultsSchema = $source->getTableQualifier(DaimonType::Results);
    if ($resultsSchema === null) {
        $this->markTestSkipped('ACUMENUS results daimon not registered.');
    }

    // Pick the largest materialized cohort for ACUMENUS to ensure
    // meaningful stratification cell counts.
    $candidate = DB::connection('omop')->selectOne(
        'SELECT cohort_definition_id, COUNT(*) AS n '
        ."FROM {$resultsSchema}.cohort "
        .'GROUP BY cohort_definition_id HAVING COUNT(*) > 1000 '
        .'ORDER BY n DESC LIMIT 1'
    );
    if (! $candidate) {
        $this->markTestSkipped('No materialized ACUMENUS cohort with >1000 subjects available.');
    }
    $cohortId = (int) $candidate->cohort_definition_id;

    // B-04: IncidenceRateAnalysis::factory() — there is no shared
    // App\Models\Analysis class.
    $analysis = IncidenceRateAnalysis::factory()->create([
        'name' => 'phase19-smoke-'.now()->format('YmdHis'),
        'description' => 'Phase 19 Plan 05 smoke test',
        'design_json' => [
            'targetCohortId' => $cohortId,
            'outcomeCohortIds' => [$cohortId],   // self-outcome OK for smoke
            'timeAtRisk' => [
                'start' => ['dateField' => 'StartDate', 'offset' => 0],
                'end' => ['dateField' => 'EndDate', 'offset' => 0],
            ],
            'stratifyByGender' => false,
            'stratifyByAge' => false,
            'stratifyByLocation' => 'urban_pct',
            'minCellCount' => 5,
        ],
    ]);

    $execution = AnalysisExecution::factory()->for($analysis, 'analysis')->create([
        'source_id' => $source->id,
        'status' => ExecutionStatus::Pending,
    ]);

    $service = app(IncidenceRateService::class);
    // B-05: signature is (IncidenceRateAnalysis, Source, AnalysisExecution).
    $service->execute($analysis, $source, $execution);

    $execution->refresh();
    expect($execution->status)->toBe(ExecutionStatus::Completed);

    // result_json after IncidenceRateResultNormalizer keeps both shapes:
    //   - $result['results']           — flat list, each element carries a
    //                                    pre-flattened `strata` array
    //   - $result['outcomes'][$id]     — legacy keyed outcome map with a
    //                                    `strata.location_urban_pct` bucket
    // We prefer the legacy keyed map (lossless type info) and fall back to
    // the flat results list filtered by stratum_name when not present.
    $resultJson = $execution->result_json ?? [];
    expect($resultJson)->toBeArray();

    $allStrata = [];
    $legacy = $resultJson['outcomes'][$cohortId]['strata']['location_urban_pct'] ?? null;
    if (is_array($legacy)) {
        $allStrata = $legacy;
    } else {
        foreach (($resultJson['results'] ?? []) as $outcome) {
            $strata = $outcome['strata'] ?? [];
            if (! is_array($strata)) {
                continue;
            }
            foreach ($strata as $row) {
                $allStrata[] = $row;
            }
        }
    }

    // Phase 19 location_urban_pct CASE labels (D-03 thresholds).
    $urbanPctLabels = [
        'Highly Rural (<25% urban)',
        'Rural (25-50% urban)',
        'Mixed (50-75% urban)',
        'Urban (>=75% urban)',
        'Unknown',
    ];
    $locationStrata = array_values(array_filter(
        $allStrata,
        fn ($row) => in_array(
            (string) ($row['stratum_name'] ?? ''),
            $urbanPctLabels,
            true,
        ),
    ));

    expect(count($locationStrata))->toBeGreaterThanOrEqual(2);

    $totalAtRisk = 0;
    foreach ($locationStrata as $row) {
        $par = (int) ($row['persons_at_risk'] ?? 0);
        // applyMinCellCount uses -1 to redact small strata; include only
        // non-redacted rows for the >=5 / total assertions.
        if ($par >= 5) {
            $totalAtRisk += $par;
        } elseif ($par > 0) {
            // unexpected: cell count <5 should have been redacted to -1.
            throw new RuntimeException(
                "Unexpected unsuppressed small stratum: persons_at_risk={$par} "
                .'for stratum_name='.($row['stratum_name'] ?? '?')
            );
        }
    }

    expect($totalAtRisk)->toBeGreaterThanOrEqual(10_000);

    // Capture aggregate-only evidence for DEPLOY-LOG (T-19-13: never
    // per-person identifiers — only stratum counts).
    $evidence = [
        'cohort_id' => $cohortId,
        'source' => 'ACUMENUS',
        'source_id' => $source->id,
        'strata' => array_values(array_map(
            fn ($r) => [
                'stratum_name' => $r['stratum_name'] ?? null,
                'persons_at_risk' => (int) ($r['persons_at_risk'] ?? 0),
                'persons_with_outcome' => (int) ($r['persons_with_outcome'] ?? 0),
            ],
            $locationStrata,
        )),
        'total_at_risk' => $totalAtRisk,
        'execution_id' => $execution->id,
        'timestamp' => date(DATE_ATOM),
    ];
    @file_put_contents(
        '/tmp/phase19-smoke-evidence.json',
        json_encode($evidence, JSON_PRETTY_PRINT),
    );
})->group('smoke', 'phase19');
