<?php

declare(strict_types=1);

use App\Models\App\CohortDefinition;
use App\Models\App\FinnGen\AnalysisModule;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\WorkbenchSession;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\FinnGenUnmappedCode;

/**
 * Phase 13.1 Wave 0 — SC 6.
 *
 * Expected state: EndpointDefinition assertion GREEN from Plan 13.1-01;
 * the 5 existing FinnGen model assertions stay RED until Plan 13.1-03
 * flips their $connection and strips the 'app.' $table prefix.
 * CohortDefinition assertion GREEN immediately (model already on pgsql).
 *
 * Threat coverage: T-13.1-S2 (connection leakage) — freezes which models
 * route to which connection to prevent accidental cross-wiring of
 * app.cohort_definitions with the finngen connection.
 *
 * Phase 13.2-06 update: models now resolve $connection via
 * config('finngen.connection', 'finngen'), which in the testing env is
 * overridden to 'finngen_testing' via FINNGEN_DB_CONNECTION in
 * phpunit.xml. The assertions read the config value so they stay green
 * under both production (finngen) and testing (finngen_testing).
 */
it('EndpointDefinition uses the configured finngen connection', function (): void {
    $expected = config('finngen.connection', 'finngen');
    expect((new EndpointDefinition)->getConnectionName())->toBe($expected);
});

it('all 5 existing FinnGen models use the configured finngen connection', function (): void {
    $expected = config('finngen.connection', 'finngen');
    expect((new AnalysisModule)->getConnectionName())->toBe($expected);
    expect((new Run)->getConnectionName())->toBe($expected);
    expect((new WorkbenchSession)->getConnectionName())->toBe($expected);
    expect((new FinnGenUnmappedCode)->getConnectionName())->toBe($expected);
    expect((new FinnGenEndpointGeneration)->getConnectionName())->toBe($expected);
});

it('CohortDefinition stays on default pgsql', function (): void {
    // getConnectionName() returns null when the model has no explicit
    // $connection (resolves to the default 'pgsql' at query time).
    expect((new CohortDefinition)->getConnectionName())->toBeNull();
});
