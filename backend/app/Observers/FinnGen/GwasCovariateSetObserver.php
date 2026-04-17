<?php

declare(strict_types=1);

namespace App\Observers\FinnGen;

use App\Models\App\FinnGen\GwasCovariateSet;

/**
 * Phase 14 (RESEARCH §Open Questions Q5) — maintains
 * covariate_columns_hash as SHA-256 hex of the canonical JSON of
 * covariate_columns. Keeps the hash consistent with the
 * FinnGenGwasCovariateSetSeeder's hash computation and with
 * GwasCacheKeyHasher's covariate_set_version_hash input.
 *
 * Observer scope — the T-14-15 threat register entry covers this:
 *   - All runtime writes (Eloquent create/update/save) invoke this observer.
 *   - The seeder uses DB::table(...)->updateOrInsert(...) which bypasses
 *     observers — acceptable because the seeder computes the hash directly.
 *   - No other code path should write to app.finngen_gwas_covariate_sets.
 */
final class GwasCovariateSetObserver
{
    public function saving(GwasCovariateSet $model): void
    {
        $columns = $model->covariate_columns ?? [];
        $canonical = json_encode(
            $columns,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
        $model->covariate_columns_hash = hash('sha256', $canonical);
    }
}
