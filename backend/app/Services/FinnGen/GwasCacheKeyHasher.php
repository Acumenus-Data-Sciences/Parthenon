<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

/**
 * Phase 14 (D-02 per .planning/phases/14-regenie-gwas-infrastructure/14-CONTEXT.md)
 *
 * Canonical JSON + SHA-256 cache-key hasher for regenie step-1 LOCO artifact
 * lookup. Hash is shared between PHP (this class) and R (gwas_regenie.R
 * `.gwas_cache_key` — lands in Wave 4). Both MUST produce identical hex for
 * identical inputs.
 *
 * Canonical JSON rules:
 *   - Keys sorted alphabetically (written in alpha order in the array literal
 *     below; PHP's `json_encode` preserves insertion order for associative
 *     arrays).
 *   - source_key lowercased before serialization.
 *   - No whitespace, no trailing newlines.
 *   - JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE — match R's
 *     `jsonlite::toJSON(auto_unbox = TRUE)` default (no slash escapes).
 *
 * Threat T-14-12 (Repudiation — cache-key drift): a fixture hex for the
 * input `(221, 1, 'deadbeef', 'PANCREAS')` is recorded in the Phase 14-03
 * SUMMARY. Wave 4's R-side test pins the same hex. Any drift surfaces in CI.
 */
final class GwasCacheKeyHasher
{
    public static function hash(
        int $cohortDefinitionId,
        int $covariateSetId,
        string $covariateSetVersionHash,
        string $sourceKey,
    ): string {
        return hash('sha256', self::canonicalJson(
            $cohortDefinitionId,
            $covariateSetId,
            $covariateSetVersionHash,
            $sourceKey,
        ));
    }

    /**
     * Convenience helper for tests + documentation: emits the canonical
     * JSON that the hash is computed over. Not used in production paths.
     */
    public static function canonicalJson(
        int $cohortDefinitionId,
        int $covariateSetId,
        string $covariateSetVersionHash,
        string $sourceKey,
    ): string {
        return json_encode(
            [
                // keys alphabetically ordered:
                'cohort_definition_id' => $cohortDefinitionId,
                'covariate_set_id' => $covariateSetId,
                'covariate_set_version_hash' => $covariateSetVersionHash,
                'source_key' => strtolower($sourceKey),
            ],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        );
    }
}
