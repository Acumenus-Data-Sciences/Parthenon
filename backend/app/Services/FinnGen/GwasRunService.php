<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Services\FinnGen\Exceptions\SourceNotPreparedException;
use App\Services\FinnGen\Exceptions\Step1ArtifactMissingException;

/**
 * Phase 14 (D-01, D-13) — GWAS dispatch wrapper.
 *
 * Delegates Run row creation + Horizon job dispatch to the existing
 * {@see FinnGenRunService}::create — which handles JSON-schema validation,
 * the pause-dispatch gate, transactional row insert, and queueing of
 * {@see RunFinnGenAnalysisJob}. That job calls
 * {@see FinnGenClient}::postAsyncDispatch on the analysis module's
 * darkstar_endpoint (registered by FinnGenAnalysisModuleSeeder).
 *
 * This service adds two GWAS-specific preconditions over plain
 * FinnGenRunService::create:
 *
 *   1. SourceVariantIndex existence check
 *      (throws {@see SourceNotPreparedException} — semantic 422)
 *
 *   2. (step-2 only) Step-1 LOCO cache artifact existence
 *      (throws {@see Step1ArtifactMissingException} — semantic 422).
 *
 * Phase 15 (GENOMICS-03) will expose POST /api/v1/finngen/endpoints/{name}/gwas
 * on top of this class. Phase 14 Wave 5/6's smoke-test command calls
 * dispatchStep1 / dispatchStep2 directly.
 *
 * The cache_key passed to the R worker is computed via
 * {@see GwasCacheKeyHasher}; PHP and R produce byte-identical hex per
 * the Plan 14-03 SUMMARY fixture (T-14-12 mitigation).
 */
final class GwasRunService
{
    public const ANALYSIS_TYPE_STEP1 = 'gwas.regenie.step1';

    public const ANALYSIS_TYPE_STEP2 = 'gwas.regenie.step2';

    public function __construct(
        private readonly FinnGenRunService $runService,
    ) {}

    public function dispatchStep1(
        int $userId,
        int $cohortDefinitionId,
        int $covariateSetId,
        string $sourceKey,
    ): Run {
        $normalizedSource = strtolower($sourceKey);
        $this->assertSourcePrepared($normalizedSource);
        $covariate = GwasCovariateSet::findOrFail($covariateSetId);
        $cacheKey = GwasCacheKeyHasher::hash(
            $cohortDefinitionId,
            $covariateSetId,
            (string) $covariate->covariate_columns_hash,
            $normalizedSource,
        );

        return $this->runService->create(
            userId: $userId,
            sourceKey: strtoupper($normalizedSource),
            analysisType: self::ANALYSIS_TYPE_STEP1,
            params: [
                'cohort_definition_id' => $cohortDefinitionId,
                'covariate_set_id' => $covariateSetId,
                'covariate_set_version_hash' => (string) $covariate->covariate_columns_hash,
                'source_key' => $normalizedSource,
                'cache_key' => $cacheKey,
            ],
        );
    }

    public function dispatchStep2(
        int $userId,
        int $cohortDefinitionId,
        int $covariateSetId,
        string $sourceKey,
    ): Run {
        $normalizedSource = strtolower($sourceKey);
        $this->assertSourcePrepared($normalizedSource);
        $covariate = GwasCovariateSet::findOrFail($covariateSetId);
        $cacheKey = GwasCacheKeyHasher::hash(
            $cohortDefinitionId,
            $covariateSetId,
            (string) $covariate->covariate_columns_hash,
            $normalizedSource,
        );
        $this->assertStep1ArtifactPresent($normalizedSource, $cacheKey);

        return $this->runService->create(
            userId: $userId,
            sourceKey: strtoupper($normalizedSource),
            analysisType: self::ANALYSIS_TYPE_STEP2,
            params: [
                'cohort_definition_id' => $cohortDefinitionId,
                'covariate_set_id' => $covariateSetId,
                'covariate_set_version_hash' => (string) $covariate->covariate_columns_hash,
                'source_key' => $normalizedSource,
                'cache_key' => $cacheKey,
            ],
        );
    }

    /**
     * Resolve the absolute path of the step-1 LOCO cache directory for the
     * given (source, cache_key). Layout is owned by D-02 / Plan 14-03 and
     * mirrored byte-for-byte by gwas_regenie.R::.gwas_step1_cache_dir.
     */
    public function step1CacheDir(string $sourceKeyLower, string $cacheKey): string
    {
        $artifactsRoot = rtrim((string) config('finngen.artifacts_path', '/opt/finngen-artifacts'), '/');

        return $artifactsRoot.'/gwas/step1/'.$sourceKeyLower.'/'.$cacheKey;
    }

    private function assertSourcePrepared(string $normalizedSource): void
    {
        if (! SourceVariantIndex::where('source_key', $normalizedSource)->exists()) {
            throw new SourceNotPreparedException($normalizedSource);
        }
    }

    private function assertStep1ArtifactPresent(string $normalizedSource, string $cacheKey): void
    {
        $fitPred = $this->step1CacheDir($normalizedSource, $cacheKey).'/fit_pred.list';
        if (! is_file($fitPred)) {
            throw new Step1ArtifactMissingException($cacheKey);
        }
    }
}
