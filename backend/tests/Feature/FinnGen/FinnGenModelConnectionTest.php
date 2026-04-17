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
 * @note RED until Plan 13.1-03 model wiring ships for the 5 existing models.
 */
it('EndpointDefinition uses the finngen connection', function (): void {
    expect((new EndpointDefinition)->getConnectionName())->toBe('finngen');
});

it('all 5 existing FinnGen models use the finngen connection', function (): void {
    expect((new AnalysisModule)->getConnectionName())->toBe('finngen');
    expect((new Run)->getConnectionName())->toBe('finngen');
    expect((new WorkbenchSession)->getConnectionName())->toBe('finngen');
    expect((new FinnGenUnmappedCode)->getConnectionName())->toBe('finngen');
    expect((new FinnGenEndpointGeneration)->getConnectionName())->toBe('finngen');
});

it('CohortDefinition stays on default pgsql', function (): void {
    // getConnectionName() returns null when the model has no explicit
    // $connection (resolves to the default 'pgsql' at query time).
    expect((new CohortDefinition)->getConnectionName())->toBeNull();
});
