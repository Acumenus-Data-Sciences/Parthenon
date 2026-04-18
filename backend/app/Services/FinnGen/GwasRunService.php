<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use App\Enums\CoverageBucket;
use App\Jobs\FinnGen\RunFinnGenAnalysisJob;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\Run;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\Source;
use App\Models\User;
use App\Services\FinnGen\Exceptions\ControlCohortNotPreparedException;
use App\Services\FinnGen\Exceptions\CovariateSetNotFoundException;
use App\Services\FinnGen\Exceptions\DuplicateRunException;
use App\Services\FinnGen\Exceptions\EndpointNotMaterializedException;
use App\Services\FinnGen\Exceptions\NotOwnedRunException;
use App\Services\FinnGen\Exceptions\RunInFlightException;
use App\Services\FinnGen\Exceptions\SourceNotFoundException;
use App\Services\FinnGen\Exceptions\SourceNotPreparedException;
use App\Services\FinnGen\Exceptions\Step1ArtifactMissingException;
use App\Services\FinnGen\Exceptions\UnresolvableConceptsException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

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
 * Phase 15 (GENOMICS-03) exposes POST /api/v1/finngen/endpoints/{name}/gwas
 * on top of this class via {@see dispatchFullGwas}. Phase 14 Wave 5/6's
 * smoke-test command calls dispatchStep1 / dispatchStep2 directly.
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
     * D-03 + Pitfall 5: dispatch step-2 WITHOUT the strict fit_pred.list on-disk check.
     *
     * Used by {@see dispatchFullGwas} when cache-miss auto-chain queues step-1 and
     * step-2 together. The R worker's step-2 entrypoint polls the expected cache
     * path with a deadline; the $step1RunId param lets Darkstar surface dependency
     * status in the job envelope.
     *
     * When $step1RunId === null, the caller is asserting step-1 was a cache hit;
     * the artifact file IS on disk, but this atom still skips the is_file() check
     * for symmetry with the cache-miss branch.
     *
     * @see dispatchStep2 for the strict-check variant (Phase 14 smoke test uses this)
     * @see dispatchFullGwas
     */
    public function dispatchStep2AfterStep1(
        int $userId,
        int $caseCohortId,
        int $controlCohortId,
        int $covariateSetId,
        string $sourceKey,
        ?string $step1RunId,
    ): Run {
        $normalizedSource = strtolower($sourceKey);
        $this->assertSourcePrepared($normalizedSource);
        $covariate = GwasCovariateSet::findOrFail($covariateSetId);
        $cacheKey = GwasCacheKeyHasher::hash(
            $caseCohortId,
            $covariateSetId,
            (string) $covariate->covariate_columns_hash,
            $normalizedSource,
        );

        return $this->runService->create(
            userId: $userId,
            sourceKey: strtoupper($normalizedSource),
            analysisType: self::ANALYSIS_TYPE_STEP2,
            params: [
                'cohort_definition_id' => $caseCohortId,
                'covariate_set_id' => $covariateSetId,
                'covariate_set_version_hash' => (string) $covariate->covariate_columns_hash,
                'source_key' => $normalizedSource,
                'cache_key' => $cacheKey,
                'step1_run_id' => $step1RunId,
                'control_cohort_definition_id' => $controlCohortId,
            ],
        );
    }

    /**
     * D-01, D-03: single-POST auto-chain dispatch for a GWAS.
     *
     * Orchestration:
     *   1. Run the D-04 precondition ladder (first-fail-wins typed exceptions).
     *   2. Resolve case cohort id = generation.id + OMOP_COHORT_ID_OFFSET (D-05).
     *   3. Duplicate / in-flight guard (D-07/D-08/D-09).
     *   4. INSERT tracking row with placeholder run_id (D-15 phase 1).
     *   5. Cache-miss → dispatchStep1; always → dispatchStep2AfterStep1 (Pitfall 5).
     *   6. Backfill tracking row with real step-2 run_id + optional step-1 run_id.
     *   7. Overwrite branch: mark prior row superseded; ownership check (Open Q5).
     *
     * Returns the freshly-inserted tracking row. {@see \App\Observers\FinnGen\FinnGenGwasRunObserver}
     * backfills status / case_n / control_n / top_hit_p_value when the runs succeed.
     */
    public function dispatchFullGwas(
        int $userId,
        string $endpointName,
        string $sourceKey,
        int $controlCohortId,
        ?int $covariateSetId = null,
        bool $overwrite = false,
    ): EndpointGwasRun {
        $normalizedSource = strtolower($sourceKey);

        // Precondition 1: endpoint exists (firstOrFail → ModelNotFoundException → 404 in controller).
        /** @var EndpointDefinition $endpoint */
        $endpoint = EndpointDefinition::query()->where('name', $endpointName)->firstOrFail();

        // Precondition 2: resolvable concepts.
        $this->assertResolvableConcepts($endpoint);

        // Precondition 3: source exists.
        $source = Source::query()->where('source_key', $sourceKey)->first();
        if ($source === null) {
            throw new SourceNotFoundException($sourceKey);
        }

        // Precondition 4: source has variant index (existing Phase 14 helper).
        $this->assertSourcePrepared($normalizedSource);

        // Precondition 5: endpoint materialized against source.
        /** @var FinnGenEndpointGeneration|null $generation */
        $generation = FinnGenEndpointGeneration::query()
            ->where('endpoint_name', $endpointName)
            ->where('source_key', $sourceKey)
            ->where('last_status', 'succeeded')
            ->where('last_subject_count', '>', 0)
            ->first();

        if ($generation === null) {
            throw new EndpointNotMaterializedException($endpointName, $sourceKey);
        }
        $caseCohortId = (int) $generation->id + FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET;

        // Precondition 6: control cohort exists + generated against source + not a FinnGen-offset id.
        $this->assertControlCohortPrepared($controlCohortId, $sourceKey);

        // Precondition 7: covariate set (auto-resolve default if null).
        $resolvedCovariateSetId = $covariateSetId ?? $this->resolveDefaultCovariateSetId();
        $this->assertCovariateSetExists($resolvedCovariateSetId);

        // Precondition 8: duplicate / in-flight guard.
        /** @var EndpointGwasRun|null $existing */
        $existing = EndpointGwasRun::query()
            ->where('endpoint_name', $endpointName)
            ->where('source_key', $sourceKey)
            ->where('control_cohort_id', $controlCohortId)
            ->where('covariate_set_id', $resolvedCovariateSetId)
            ->whereIn('status', [
                EndpointGwasRun::STATUS_QUEUED,
                EndpointGwasRun::STATUS_RUNNING,
                EndpointGwasRun::STATUS_SUCCEEDED,
            ])
            ->latest('id')
            ->first();

        if ($existing !== null) {
            if (in_array($existing->status, [EndpointGwasRun::STATUS_QUEUED, EndpointGwasRun::STATUS_RUNNING], true)) {
                throw new RunInFlightException((string) $existing->run_id, (int) $existing->id);
            }
            // status === 'succeeded'.
            if (! $overwrite) {
                throw new DuplicateRunException((string) $existing->run_id, (int) $existing->id);
            }
            // overwrite=true: ownership check happens inside the transaction before setting superseded.
        }

        // Cache probe (decides whether step-1 is dispatched or cache-hit).
        $covariate = GwasCovariateSet::findOrFail($resolvedCovariateSetId);
        $cacheKey = GwasCacheKeyHasher::hash(
            $caseCohortId,
            $resolvedCovariateSetId,
            (string) $covariate->covariate_columns_hash,
            $normalizedSource,
        );
        $fitPredPath = $this->step1CacheDir($normalizedSource, $cacheKey).'/fit_pred.list';
        $cacheHit = is_file($fitPredPath);

        // D-15 two-phase: tracking row INSERT before dispatch; backfill after.
        return DB::connection('finngen')->transaction(function () use (
            $userId,
            $endpointName,
            $sourceKey,
            $caseCohortId,
            $controlCohortId,
            $resolvedCovariateSetId,
            $cacheHit,
            $existing,
            $overwrite
        ): EndpointGwasRun {
            // Placeholder run_id — will be overwritten with the real ULID after dispatchStep2AfterStep1 returns.
            // Value fits VARCHAR(26): 'PENDING_' (8 chars) + 18 hex chars = 26.
            $placeholder = 'PENDING_'.bin2hex(random_bytes(9));

            $tracking = EndpointGwasRun::create([
                'endpoint_name' => $endpointName,
                'source_key' => $sourceKey,
                'control_cohort_id' => $controlCohortId,
                'covariate_set_id' => $resolvedCovariateSetId,
                'run_id' => $placeholder,
                'step1_run_id' => null,
                'status' => EndpointGwasRun::STATUS_QUEUED,
            ]);

            // Dispatch step-1 on cache miss (blocking — Horizon queues the job, returns Run).
            $step1Run = null;
            if (! $cacheHit) {
                $step1Run = $this->dispatchStep1($userId, $caseCohortId, $resolvedCovariateSetId, $sourceKey);
            }

            // Dispatch step-2 via the new atom — skips on-disk artifact check (Pitfall 5).
            $step2Run = $this->dispatchStep2AfterStep1(
                $userId,
                $caseCohortId,
                $controlCohortId,
                $resolvedCovariateSetId,
                $sourceKey,
                $step1Run?->id,
            );

            // Backfill tracking row with real run ids.
            $tracking->update([
                'run_id' => $step2Run->id,
                'step1_run_id' => $step1Run?->id,
            ]);

            // Overwrite supersede bookkeeping (with Open Q5 ownership guard).
            if ($overwrite && $existing !== null && $existing->status === EndpointGwasRun::STATUS_SUCCEEDED) {
                $this->assertCallerOwnsRunOrIsAdmin($userId, $existing);
                $existing->update([
                    'status' => EndpointGwasRun::STATUS_SUPERSEDED,
                    'superseded_by_tracking_id' => $tracking->id,
                ]);
            }

            $fresh = $tracking->fresh();
            if ($fresh === null) {
                throw new RuntimeException('EndpointGwasRun tracking row vanished post-insert');
            }

            return $fresh;
        });
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

    /** D-06: resolve the is_default=true row's id. Throws if no default is seeded. */
    private function resolveDefaultCovariateSetId(): int
    {
        $default = GwasCovariateSet::query()->where('is_default', true)->first();
        if ($default === null) {
            throw new CovariateSetNotFoundException(0);
        }

        return (int) $default->id;
    }

    /** D-04 step 2: endpoint must have resolvable concepts. */
    private function assertResolvableConcepts(EndpointDefinition $endpoint): void
    {
        $bucket = $endpoint->coverage_bucket;
        $bucketString = $bucket instanceof CoverageBucket ? $bucket->value : (string) $bucket;

        if (in_array($bucketString, [CoverageBucket::CONTROL_ONLY->value, CoverageBucket::UNMAPPED->value], true)) {
            throw new UnresolvableConceptsException($bucketString);
        }
    }

    /** D-04 step 6: control cohort exists, is NOT a FinnGen-offset id, AND has a succeeded generation in the source. */
    private function assertControlCohortPrepared(int $controlCohortId, string $sourceKey): void
    {
        // Defensive: reject FinnGen-offset ids (D-23, Pitfall 7 — excludes endpoint-backed cohorts as controls).
        if ($controlCohortId >= FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET) {
            throw new ControlCohortNotPreparedException($controlCohortId, $sourceKey);
        }

        // Cohort must exist in app.cohort_definitions.
        $cohort = DB::connection('pgsql')
            ->table('cohort_definitions')
            ->where('id', $controlCohortId)
            ->first();
        if ($cohort === null) {
            throw new ControlCohortNotPreparedException($controlCohortId, $sourceKey);
        }

        // Resolve source → cohort schema (source_key lowercased; admin-curated allow-list).
        $source = Source::query()->where('source_key', $sourceKey)->first();
        if ($source === null) {
            throw new ControlCohortNotPreparedException($controlCohortId, $sourceKey);
        }
        $cohortSchema = strtolower((string) $source->source_key);

        // T-15-10 mitigation: regex allow-list before string interpolation into SQL.
        if (preg_match('/^[a-z][a-z0-9_]*$/', $cohortSchema) !== 1) {
            throw new ControlCohortNotPreparedException($controlCohortId, $sourceKey);
        }

        $exists = DB::connection('pgsql')->selectOne(
            "SELECT 1 AS ok FROM {$cohortSchema}.cohort WHERE cohort_definition_id = ? LIMIT 1",
            [$controlCohortId],
        );
        if ($exists === null) {
            throw new ControlCohortNotPreparedException($controlCohortId, $sourceKey);
        }
    }

    /** D-04 step 7: covariate set row exists. */
    private function assertCovariateSetExists(int $covariateSetId): void
    {
        if (! GwasCovariateSet::query()->where('id', $covariateSetId)->exists()) {
            throw new CovariateSetNotFoundException($covariateSetId);
        }
    }

    /**
     * Open Q5: overwrite=true requires caller to own the prior run OR hold admin / super-admin role.
     *
     * No FK on EndpointGwasRun::run_id → finngen.runs.id (per D-13 / Pitfall 4); explicit lookup.
     * If the prior run has vanished, allow the supersede (no owner to contest).
     */
    private function assertCallerOwnsRunOrIsAdmin(int $callerUserId, EndpointGwasRun $existing): void
    {
        /** @var Run|null $priorRun */
        $priorRun = Run::query()->where('id', $existing->run_id)->first();
        if ($priorRun === null) {
            return;
        }
        $ownerUserId = (int) $priorRun->user_id;
        if ($ownerUserId === $callerUserId) {
            return;
        }
        /** @var User|null $caller */
        $caller = User::query()->find($callerUserId);
        if ($caller !== null && $caller->hasAnyRole(['admin', 'super-admin'])) {
            return;
        }
        throw new NotOwnedRunException((int) $existing->id, $ownerUserId);
    }
}
