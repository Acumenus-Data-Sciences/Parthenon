<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\ComputePrsRequest;
use App\Http\Requests\FinnGen\DispatchEndpointGwasRequest;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGen\EndpointGwasRun;
use App\Models\App\FinnGen\GwasCovariateSet;
use App\Models\App\FinnGen\SourceVariantIndex;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\FinnGenUnmappedCode;
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
use App\Services\FinnGen\Exceptions\UnresolvableConceptsException;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\GwasRunService;
use App\Services\FinnGen\PrsDispatchService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * SP4 Genomics #1 follow-on — researcher-facing browser for the imported
 * FinnGen endpoint library (~5,161 phenotype defs from DF14).
 *
 * Phase 13.1: reads finngen.endpoint_definitions via EndpointDefinition on
 * the read-only finngen_ro connection (D-09 ro/rw split). Writes (generate
 * dispatch, generation tracking) use the default finngen rw connection.
 *
 * Surfaces the typed coverage_bucket column so researchers can filter by
 * mapping quality before adopting an endpoint into their workbench.
 *
 * Permission: finngen.workbench.use (same gate as the rest of SP4).
 */
final class EndpointBrowserController extends Controller
{
    /** Allowed buckets accepted as filter values. */
    private const BUCKETS = ['FULLY_MAPPED', 'PARTIAL', 'SPARSE', 'UNMAPPED', 'CONTROL_ONLY'];

    /** Maximum page size — protects the pgsql/JSONB query path. */
    private const MAX_PER_PAGE = 100;

    /**
     * Source keys whose CDM carries Finnish source vocabularies (ICD-8,
     * ICDO3-FI, NOMESCO, KELA_REIMB, ICD-10-FI, Finnish ICD-9). Populated
     * in Phase 18.5 when a THL HILMO / AvoHILMO / KanTa CDM attaches. For
     * v1.0 this list is INTENTIONALLY empty — no Finnish CDM is connected,
     * so finland_only endpoints cannot generate on any current source.
     *
     * Phase 13 T-13-04 mitigation: server-side defense-in-depth for the
     * frontend disabled-CTA UX (see FinnGenEndpointBrowserPage.tsx).
     *
     * @var list<string>
     */
    private const FINNISH_SOURCE_KEYS = [];

    public function __construct(
        private readonly FinnGenRunService $runs,
        private readonly GwasRunService $gwasRunService,
    ) {}

    /**
     * GET /api/v1/finngen/endpoints
     *
     * Filters:
     *   q          — substring search across name, longname, description, and
     *                the raw ICD code text in qualifying_event_spec->source_codes.*.raw
     *   tag        — single tag (case-sensitive); e.g. 'cardiovascular',
     *                'cancer', 'finngen:df14'
     *   bucket     — single coverage bucket; one of BUCKETS
     *   release    — convenience alias for tag = "finngen:{release}" OR direct
     *                release column match ('df12'|'df13'|'df14')
     *   per_page   — 1..100, default 25
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = max(1, min(self::MAX_PER_PAGE, (int) $request->query('per_page', '25')));
        $q = trim((string) $request->query('q', ''));
        $tag = trim((string) $request->query('tag', ''));
        $bucket = trim((string) $request->query('bucket', ''));
        $release = trim((string) $request->query('release', ''));

        $query = EndpointDefinition::on('finngen_ro')
            ->orderBy('name');

        if ($q !== '') {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
            $query->where(function ($qb) use ($like): void {
                $qb->where('name', 'ILIKE', $like)
                    ->orWhere('longname', 'ILIKE', $like)
                    ->orWhere('description', 'ILIKE', $like)
                    ->orWhereRaw('qualifying_event_spec::text ILIKE ?', [$like]);
            });
        }

        if (in_array($bucket, self::BUCKETS, true)) {
            $query->where('coverage_bucket', $bucket);
        }

        if ($tag !== '') {
            $query->whereRaw('tags @> ?::jsonb', [json_encode([$tag])]);
        }
        if ($release !== '') {
            $query->where('release', $release);
        }

        /** @var LengthAwarePaginator $page */
        $page = $query->paginate($perPage);

        // Batch-load generations for all rows on this page so the frontend
        // can render "Generated on: X" badges without N+1 round-trips.
        $names = $page->getCollection()->pluck('name')->all();
        $genByEndpoint = [];
        if ($names !== []) {
            FinnGenEndpointGeneration::query()
                ->whereIn('endpoint_name', $names)
                ->get(['endpoint_name', 'source_key', 'last_status', 'last_subject_count'])
                ->each(function ($g) use (&$genByEndpoint): void {
                    $genByEndpoint[$g->endpoint_name][] = [
                        'source_key' => $g->source_key,
                        'status' => $g->last_status,
                        'subject_count' => $g->last_subject_count,
                    ];
                });
        }

        $page->getCollection()->transform(function (EndpointDefinition $row) use ($genByEndpoint): array {
            $summary = $this->summarize($row);
            $summary['generations'] = $genByEndpoint[$row->name] ?? [];

            return $summary;
        });

        return response()->json($page);
    }

    /**
     * GET /api/v1/finngen/endpoints/stats
     *
     * Returns counts by coverage bucket and the most common tags. Powers
     * the dashboard stat cards on the browser page. Costs one indexed
     * COUNT per bucket; cheap.
     */
    public function stats(): JsonResponse
    {
        $base = EndpointDefinition::on('finngen_ro');

        $byBucket = (clone $base)
            ->selectRaw('COALESCE(coverage_bucket, ?) AS bucket, COUNT(*) AS n', ['UNKNOWN'])
            ->groupBy('coverage_bucket')
            ->pluck('n', 'bucket');

        // Top 20 tags excluding the boilerplate ones (finngen:dfXX release tags
        // and any historical 'finngen-endpoint' sentinel rows).
        $topTags = DB::connection('finngen_ro')->select("
            SELECT tag, COUNT(*) AS n
              FROM (
                SELECT jsonb_array_elements_text(tags) AS tag
                  FROM finngen.endpoint_definitions
              ) t
             WHERE tag NOT IN ('finngen-endpoint')
               AND tag NOT LIKE 'finngen:%'
             GROUP BY tag
             ORDER BY n DESC
             LIMIT 20
        ");

        $unmappedTotal = FinnGenUnmappedCode::query()->count();
        $unmappedByVocab = FinnGenUnmappedCode::query()
            ->selectRaw('source_vocab, COUNT(*) AS n')
            ->groupBy('source_vocab')
            ->orderByDesc('n')
            ->pluck('n', 'source_vocab');

        return response()->json([
            'data' => [
                'total' => (int) $base->count(),
                'by_bucket' => $byBucket,
                'top_tags' => collect($topTags)->map(fn ($r) => [
                    'tag' => $r->tag,
                    'n' => (int) $r->n,
                ])->all(),
                'unmapped' => [
                    'total' => $unmappedTotal,
                    'by_vocab' => $unmappedByVocab,
                ],
            ],
        ]);
    }

    /**
     * GET /api/v1/finngen/endpoints/{name}
     *
     * Returns full row + parsed qualifying_event_spec highlights for a single
     * endpoint. Lookup is by FinnGen short name (e.g., 'E4_DM2') — the
     * natural PK on finngen.endpoint_definitions.
     */
    public function show(string $name): JsonResponse
    {
        /** @var EndpointDefinition $row */
        $row = EndpointDefinition::on('finngen_ro')
            ->where('name', $name)
            ->firstOrFail();

        $spec = is_array($row->qualifying_event_spec) ? $row->qualifying_event_spec : [];
        $resolved = $spec['resolved_concepts'] ?? [];
        $coverage = $spec['coverage'] ?? [];
        $coverageProfile = $row->coverage_profile instanceof CoverageProfile
            ? $row->coverage_profile->value
            : $row->coverage_profile;
        $coverageBucket = $row->coverage_bucket instanceof CoverageBucket
            ? $row->coverage_bucket->value
            : $row->coverage_bucket;

        return response()->json([
            'data' => [
                // Phase 13.1: natural TEXT PK — the endpoint name IS the id.
                // Wire-compat: keep 'id' key with the name value so frontend
                // code referencing endpoint.id keeps working.
                'id' => $row->name,
                'name' => $row->name,
                'longname' => $row->longname,
                'description' => $row->description,
                'tags' => $row->tags ?? [],
                'release' => $row->release,
                'coverage_bucket' => $coverageBucket,
                'coverage' => $coverage,
                'coverage_profile' => $coverageProfile,
                'level' => $spec['level'] ?? null,
                'sex_restriction' => $spec['sex_restriction'] ?? null,
                'include_endpoints' => $spec['include_endpoints'] ?? [],
                'pre_conditions' => $spec['pre_conditions'] ?? null,
                'conditions' => $spec['conditions'] ?? null,
                'source_codes' => $spec['source_codes'] ?? [],
                'resolved_concepts' => [
                    'condition_count' => count($resolved['conditions_standard'] ?? []),
                    'drug_count' => count($resolved['drugs_standard'] ?? []),
                    'source_concept_count' => count($resolved['source_concept_ids'] ?? []),
                    'truncated' => $resolved['truncated'] ?? false,
                ],
                // D-20 back-compat: existing generations field (last-run index from finngen.endpoint_generations) retained.
                'generations' => $this->loadGenerationsFor($row->name),
                // Phase 15 extensions (D-18, D-21, UI-SPEC Assumption 1).
                'generation_runs' => $this->loadGenerationRunsFor($row->name),
                'gwas_runs' => $this->loadGwasRunsFor($row->name),
                'gwas_ready_sources' => $this->loadGwasReadySourcesFor($row->name),
                'created_at' => $row->created_at?->toIso8601String(),
                'updated_at' => $row->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * D-18: filtered finngen.runs query returning ALL historical generation runs
     * per (endpoint × source). Replaces the "last-run index only" view served by
     * {@see loadGenerationsFor}. Capped at 100 rows (server-enforced per §specifics).
     *
     * @return array<int, array<string, mixed>>
     */
    private function loadGenerationRunsFor(string $endpointName): array
    {
        return DB::connection('finngen')
            ->table('runs')
            ->select(['id', 'source_key', 'status', 'summary', 'finished_at', 'created_at'])
            ->where('analysis_type', 'endpoint.generate')
            ->whereRaw("params->>'endpoint_name' = ?", [$endpointName])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(static function ($r): array {
                $summary = is_string($r->summary) ? (array) json_decode($r->summary, true) : (array) ($r->summary ?? []);

                return [
                    'run_id' => $r->id,
                    'source_key' => $r->source_key,
                    'status' => $r->status,
                    'subject_count' => isset($summary['subject_count']) ? (int) $summary['subject_count'] : null,
                    'created_at' => $r->created_at ? Carbon::parse((string) $r->created_at)->toIso8601String() : null,
                    'finished_at' => $r->finished_at ? Carbon::parse((string) $r->finished_at)->toIso8601String() : null,
                ];
            })
            ->all();
    }

    /**
     * D-21: GWAS run history from finngen.endpoint_gwas_runs with joined
     * control_cohort_name + covariate_set_label. Capped at 100 rows.
     *
     * @return array<int, array<string, mixed>>
     */
    private function loadGwasRunsFor(string $endpointName): array
    {
        /** @var Collection<int, EndpointGwasRun> $rows */
        $rows = EndpointGwasRun::query()
            ->where('endpoint_name', $endpointName)
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $controlIds = $rows->pluck('control_cohort_id')->unique()->all();
        $covariateIds = $rows->pluck('covariate_set_id')->unique()->all();

        /** @var array<int, string> $controlNames */
        $controlNames = DB::connection('pgsql')
            ->table('cohort_definitions')
            ->whereIn('id', $controlIds)
            ->pluck('name', 'id')
            ->all();

        /** @var array<int, string> $covariateLabels */
        $covariateLabels = GwasCovariateSet::query()
            ->whereIn('id', $covariateIds)
            ->pluck('name', 'id')
            ->all();

        return $rows->map(static function (EndpointGwasRun $r) use ($controlNames, $covariateLabels): array {
            return [
                'tracking_id' => (int) $r->id,
                'run_id' => $r->run_id,
                'step1_run_id' => $r->step1_run_id,
                'source_key' => $r->source_key,
                'control_cohort_id' => (int) $r->control_cohort_id,
                'control_cohort_name' => $controlNames[(int) $r->control_cohort_id] ?? null,
                'covariate_set_id' => (int) $r->covariate_set_id,
                'covariate_set_label' => $covariateLabels[(int) $r->covariate_set_id] ?? null,
                'case_n' => $r->case_n !== null ? (int) $r->case_n : null,
                'control_n' => $r->control_n !== null ? (int) $r->control_n : null,
                'top_hit_p_value' => $r->top_hit_p_value !== null ? (float) $r->top_hit_p_value : null,
                'status' => $r->status,
                'created_at' => $r->created_at?->toIso8601String(),
                'finished_at' => $r->finished_at?->toIso8601String(),
                'superseded_by_tracking_id' => $r->superseded_by_tracking_id !== null ? (int) $r->superseded_by_tracking_id : null,
            ];
        })->all();
    }

    /**
     * UI-SPEC Assumption 1: source_keys that have BOTH a variant index AND a
     * succeeded generation for this endpoint. Feeds the "Run GWAS" source picker.
     *
     * @return array<int, string>
     */
    private function loadGwasReadySourcesFor(string $endpointName): array
    {
        /** @var array<int, string> $indexed */
        $indexed = SourceVariantIndex::query()
            ->pluck('source_key')
            ->map(static fn ($s) => strtoupper((string) $s))
            ->all();

        /** @var array<int, string> $generated */
        $generated = FinnGenEndpointGeneration::query()
            ->where('endpoint_name', $endpointName)
            ->where('last_status', 'succeeded')
            ->where('last_subject_count', '>', 0)
            ->pluck('source_key')
            ->map(static fn ($s) => strtoupper((string) $s))
            ->all();

        return array_values(array_intersect($indexed, $generated));
    }

    /**
     * POST /api/v1/finngen/endpoints/{name}/generate
     *
     * Genomics #2 — Materialize this endpoint against a CDM source. Reads
     * resolved standard SNOMED + RxNorm concept_ids from the endpoint's
     * qualifying_event_spec and dispatches a finngen.endpoint.generate Run.
     * The R worker INSERTs one cohort row per qualifying subject.
     *
     * Returns 202 with the freshly-created Run record; caller polls
     * /api/v1/finngen/runs/{id} for terminal status + summary.subject_count.
     */
    public function generate(Request $request, string $name): JsonResponse
    {
        $data = $request->validate([
            'source_key' => 'required|string|max:64',
            'overwrite_existing' => 'sometimes|boolean',
        ]);

        // Write path uses the default finngen rw connection (EndpointDefinition
        // is also queryable here, but generate reads need no special privilege).
        /** @var EndpointDefinition $row */
        $row = EndpointDefinition::on('finngen_ro')
            ->where('name', $name)
            ->firstOrFail();

        // Validate source_key resolves to a real, active source.
        $source = Source::query()->where('source_key', $data['source_key'])->first();
        if ($source === null) {
            return response()->json([
                'message' => "Source not found: {$data['source_key']}",
            ], 404);
        }

        $spec = is_array($row->qualifying_event_spec) ? $row->qualifying_event_spec : [];

        // Phase 13 T-13-04 — server-side defense-in-depth. The frontend
        // disables the Generate CTA for finland_only endpoints on non-
        // Finnish sources, but a researcher could still POST here
        // directly. Reject with 422 when coverage_profile == finland_only
        // AND source_key is not in FINNISH_SOURCE_KEYS.
        //
        // NOTE: FINNISH_SOURCE_KEYS is intentionally empty for v1.0
        // (Phase 18.5 populates). PHPStan's narrowing of `in_array` to
        // "always false" is the point — all finland_only generations
        // are currently blocked by design, and this branch always fires.
        /** @var list<string> $finnishSourceKeys */
        $finnishSourceKeys = self::FINNISH_SOURCE_KEYS;
        $coverageProfile = $row->coverage_profile instanceof CoverageProfile
            ? $row->coverage_profile
            : null;
        if ($coverageProfile === CoverageProfile::FINLAND_ONLY
            && ! in_array((string) $data['source_key'], $finnishSourceKeys, true)) {
            return response()->json([
                'message' => 'This endpoint requires a Finnish CDM data source; selected source is not eligible.',
                'coverage_profile' => $coverageProfile->value,
                'source_key' => (string) $data['source_key'],
                'finnish_sources_available' => $finnishSourceKeys,
            ], 422);
        }

        $resolved = $spec['resolved_concepts'] ?? [];
        $conditionConcepts = array_values(array_unique(array_map('intval', $resolved['conditions_standard'] ?? [])));
        $drugConcepts = array_values(array_unique(array_map('intval', $resolved['drugs_standard'] ?? [])));
        $sourceConcepts = array_values(array_unique(array_map('intval', $resolved['source_concept_ids'] ?? [])));

        if ($conditionConcepts === [] && $drugConcepts === [] && $sourceConcepts === []) {
            return response()->json([
                'message' => "Endpoint {$name} has no resolved concepts (likely CONTROL_ONLY) — cannot materialize.",
                'coverage_bucket' => $row->coverage_bucket instanceof CoverageBucket
                    ? $row->coverage_bucket->value
                    : $row->coverage_bucket,
            ], 422);
        }

        // FinnGen sex_restriction may be null/missing; cast-then-match avoids
        // PHPStan complaints about narrowing through the Eloquent cast.
        $sex = match (strtolower(trim((string) ($spec['sex_restriction'] ?? '')))) {
            'female' => 'female',
            'male' => 'male',
            default => null,
        };

        // Phase 13.2 D-04: upsert the FinnGenEndpointGeneration row BEFORE
        // dispatching the Run so the controller has $generation->id to pass as
        // `finngen_endpoint_generation_id` into run params. `->fresh()` reloads
        // the row so the bigserial PK is guaranteed populated (defensive; Eloquent
        // populates $generation->id after INSERT but fresh also catches any DB
        // triggers / computed columns — see RESEARCH §Pitfall 3).
        // `run_id` is nullable per Phase 13.2 Plan 01 migration; backfilled below.
        $generation = FinnGenEndpointGeneration::updateOrCreate(
            [
                'endpoint_name' => (string) $row->name,
                'source_key' => (string) $data['source_key'],
            ],
            [
                'finngen_endpoint_name' => (string) $row->name,
                'cohort_definition_id' => null,
                'run_id' => null,
                'last_status' => 'queued',
                'last_subject_count' => null,
            ],
        )->fresh() ?? throw new \RuntimeException('Generation upsert did not return a model');

        // REVIEW §WR-02 defence-in-depth — auth:sanctum is the first layer;
        // this guard is the second layer for PHPStan L8 + future-proofing.
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $userId = (int) $user->getKey();

        $params = [
            // Phase 13.1: cohort_definition_id is null for new generations
            // (the endpoint is no longer an app.cohort_definitions row).
            // The R worker keys on finngen_endpoint_generation_id + offset instead.
            'cohort_definition_id' => null,
            // Phase 13.2 D-01/D-02: primary key source for FinnGen cohorts.
            // R worker computes cohort_def_id = finngen_endpoint_generation_id
            // + FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET (= 100_000_000_000).
            'finngen_endpoint_generation_id' => (int) $generation->id,
            'condition_concept_ids' => $conditionConcepts,
            'drug_concept_ids' => $drugConcepts,
            'source_concept_ids' => $sourceConcepts,
            'sex_restriction' => $sex,
            'overwrite_existing' => (bool) ($data['overwrite_existing'] ?? false),
            'endpoint_name' => $row->name,
        ];

        $run = $this->runs->create(
            userId: $userId,
            sourceKey: (string) $data['source_key'],
            analysisType: 'endpoint.generate',
            params: $params,
        );

        // Phase 13.2 D-04: backfill run_id and last_status on the generation row
        // now that dispatch has returned. Two-phase pattern (upsert → dispatch →
        // backfill) is the trade-off for giving the R worker its own id source
        // without introducing a FinnGen-specific cohort table.
        $generation->update([
            'run_id' => (string) $run->id,
            'last_status' => (string) $run->status,
        ]);

        return response()->json([
            'data' => [
                'run' => $run,
                'cohort_definition_id' => null,
                'finngen_endpoint_generation_id' => (int) $generation->id,
                'endpoint_name' => $row->name,
                'source_key' => (string) $data['source_key'],
                'expected_concept_counts' => [
                    'conditions' => count($conditionConcepts),
                    'drugs' => count($drugConcepts),
                    'source' => count($sourceConcepts),
                ],
            ],
        ], 202);
    }

    /**
     * POST /api/v1/finngen/endpoints/{name}/prs
     *
     * Phase 17 GENOMICS-07 D-10/D-15 — dispatches a Darkstar
     * finngen.prs.compute run against a (source × PGS Catalog score × cohort)
     * tuple. Returns 202 + run envelope. All precondition checks live in
     * {@see PrsDispatchService::dispatch}; controller just unpacks the
     * validated FormRequest and forwards to the service.
     *
     * 422 paths (via abort() inside PrsDispatchService):
     *   - score_id not ingested in vocab.pgs_scores
     *   - source_key does not resolve to an enabled Source
     *   - source has no variant_index (Phase 14 prerequisite missing)
     *   - cohort has 0 rows for the resolved cohort_definition_id
     *   - no FinnGenEndpointGeneration when cohort_definition_id is omitted
     *
     * Route middleware: auth:sanctum, permission:finngen.prs.compute,
     * finngen.idempotency, throttle:10,1.
     */
    public function prs(ComputePrsRequest $request, string $name): JsonResponse
    {
        $validated = $request->validated();

        /** @var array{source_key:string, score_id:string, cohort_definition_id:int|null, overwrite_existing?:bool} $input */
        $input = [
            'source_key' => (string) $validated['source_key'],
            'score_id' => (string) $validated['score_id'],
            'cohort_definition_id' => isset($validated['cohort_definition_id'])
                ? (int) $validated['cohort_definition_id']
                : null,
            'overwrite_existing' => (bool) ($validated['overwrite_existing'] ?? false),
        ];

        $result = app(PrsDispatchService::class)
            ->dispatch((int) $request->user()->id, $name, $input);

        return response()->json([
            'data' => [
                'run' => $result['run'],
                'analysis_type' => PrsDispatchService::ANALYSIS_TYPE,
                'cohort_definition_id' => $result['cohort_definition_id'],
                'score_id' => $result['score_id'],
                'source_key' => $result['source_key'],
                'finngen_endpoint_generation_id' => $result['finngen_endpoint_generation_id'],
                'endpoint_name' => $name,
            ],
        ], 202);
    }

    /**
     * POST /api/v1/finngen/endpoints/{name}/gwas
     *
     * Phase 15 (GENOMICS-03) single-POST auto-chain dispatch. Delegates to
     * {@see GwasRunService::dispatchFullGwas} which runs the D-04 precondition
     * ladder, writes the tracking row pre-dispatch (D-15 phase 1), dispatches
     * step-1 (if cache-miss) + step-2, backfills tracking row with real run ids.
     *
     * Returns 202 + the new tracking row (D-02 response body). Observer
     * (FinnGenGwasRunObserver) backfills status / case_n / control_n / top_hit_p_value
     * as the underlying runs transition.
     *
     * @bodyParam source_key string required e.g. PANCREAS
     * @bodyParam control_cohort_id integer required e.g. 221
     * @bodyParam covariate_set_id integer nullable Omit to auto-resolve the default.
     * @bodyParam overwrite boolean nullable Set true to supersede a prior succeeded run.
     *
     * @response 202 {"data":{"gwas_run":{"id":17,"endpoint_name":"E4_DM2","source_key":"PANCREAS","control_cohort_id":221,"covariate_set_id":1,"run_id":"01JA...","step1_run_id":"01JB...","status":"queued","created_at":"2026-04-18T..."},"cached_step1":false}}
     */
    public function gwas(DispatchEndpointGwasRequest $request, string $name): JsonResponse
    {
        // REVIEW §WR-02 defence-in-depth — auth:sanctum is the first layer;
        // this guard is the second layer for PHPStan L8 + future-proofing.
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $userId = (int) $user->getKey();

        try {
            $gwasRun = $this->gwasRunService->dispatchFullGwas(
                userId: $userId,
                endpointName: $name,
                sourceKey: (string) $request->input('source_key'),
                controlCohortId: (int) $request->input('control_cohort_id'),
                covariateSetId: $request->input('covariate_set_id') === null
                    ? null
                    : (int) $request->input('covariate_set_id'),
                overwrite: (bool) $request->input('overwrite', false),
            );
        } catch (ModelNotFoundException $e) {
            return response()->json([
                'message' => "Endpoint '{$name}' not found.",
                'error_code' => 'endpoint_not_found',
            ], 404);
        } catch (UnresolvableConceptsException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'unresolvable_concepts',
                'coverage_bucket' => $e->coverageBucket,
            ], 422);
        } catch (SourceNotFoundException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'source_not_found',
                'source_key' => $e->sourceKey,
            ], 404);
        } catch (SourceNotPreparedException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'source_not_prepared',
                'source_key' => $e->sourceKey,
                'hint' => "Run php artisan finngen:prepare-source-variants --source={$e->sourceKey} first",
            ], 422);
        } catch (EndpointNotMaterializedException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'endpoint_not_materialized',
                'endpoint' => $e->endpointName,
                'source_key' => $e->sourceKey,
                'hint' => "POST /finngen/endpoints/{$e->endpointName}/generate first",
            ], 422);
        } catch (ControlCohortNotPreparedException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'control_cohort_not_prepared',
                'control_cohort_id' => $e->controlCohortId,
                'source_key' => $e->sourceKey,
            ], 422);
        } catch (CovariateSetNotFoundException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'covariate_set_not_found',
                'covariate_set_id' => $e->covariateSetId,
            ], 422);
        } catch (RunInFlightException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'run_in_flight',
                'existing_run_id' => $e->existingRunId,
                'gwas_run_tracking_id' => $e->existingTrackingId,
                'hint' => 'wait for completion or cancel the existing run',
            ], 409);
        } catch (DuplicateRunException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'duplicate_run',
                'existing_run_id' => $e->existingRunId,
                'gwas_run_tracking_id' => $e->existingTrackingId,
                'hint' => 'set overwrite=true to re-run',
            ], 409);
        } catch (NotOwnedRunException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'error_code' => 'not_owned_run',
                'gwas_run_tracking_id' => $e->existingTrackingId,
                'hint' => 'only the owner or an admin may overwrite',
            ], 403);
        }

        return response()->json([
            'data' => [
                'gwas_run' => [
                    'id' => (int) $gwasRun->id,
                    'endpoint_name' => $gwasRun->endpoint_name,
                    'source_key' => $gwasRun->source_key,
                    'control_cohort_id' => (int) $gwasRun->control_cohort_id,
                    'covariate_set_id' => (int) $gwasRun->covariate_set_id,
                    'run_id' => $gwasRun->run_id,
                    'step1_run_id' => $gwasRun->step1_run_id,
                    'status' => $gwasRun->status,
                    'created_at' => $gwasRun->created_at?->toIso8601String(),
                ],
                'cached_step1' => $gwasRun->step1_run_id === null,
            ],
        ], 202);
    }

    /**
     * GET /api/v1/finngen/endpoints/{name}/eligible-controls?source_key=…
     *
     * Phase 15 (GENOMICS-14) — eligible control cohort picker.
     * Filters: (a) cohort_definitions.id < 100_000_000_000 (excludes FinnGen-offset
     * case cohorts); (b) a succeeded generation exists in {source}.cohort (enforced
     * by the inner JOIN to cohort_counts — only cohorts with rows appear); (c)
     * RBAC — admin/super-admin see every cohort; other users see only cohorts they
     * own (cd.author_id = user.id) or cohorts flagged is_public=TRUE. Legacy cohorts
     * with NULL author_id that are not is_public are intentionally hidden from
     * non-admin users by this policy; the legacy bool-placeholder bypass was
     * removed (REVIEW §WR-01).
     *
     * @queryParam source_key string required e.g. PANCREAS
     *
     * @response 200 {"data":[{"cohort_definition_id":221,"name":"PANCREAS PDAC adults","subject_count":1450,"last_generated_at":"2026-04-14T..."}]}
     */
    public function eligibleControls(Request $request, string $name): JsonResponse
    {
        $validated = $request->validate([
            'source_key' => ['required', 'string', 'max:64', 'regex:/^[A-Z][A-Z0-9_]*$/'],
        ]);
        $sourceKey = (string) $validated['source_key'];
        $sourceLower = strtolower($sourceKey);

        // T-15-10: schema-name allow-list before SQL interpolation.
        if (preg_match('/^[a-z][a-z0-9_]*$/', $sourceLower) !== 1) {
            return response()->json([
                'message' => "Invalid source_key '{$sourceKey}'.",
                'error_code' => 'source_not_found',
            ], 404);
        }

        // Confirm endpoint exists (ModelNotFoundException → 404 via handler).
        EndpointDefinition::query()->where('name', $name)->firstOrFail();

        // REVIEW §WR-02 defence-in-depth — auth:sanctum is the first layer;
        // this guard is the second layer for PHPStan L8 + future-proofing.
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $userId = (int) $user->getKey();
        $isAdmin = $user->hasAnyRole(['admin', 'super-admin']);

        // Single CTE pre-aggregates {source}.cohort counts + last_generated_at per
        // cohort_definition_id — one scan of the source cohort table instead of
        // up to 300 scalar subqueries at LIMIT=100 (REVIEW §CR-01). $sourceLower
        // is already regex-validated above; interpolate via sprintf, bind scalars.
        $cteSql = sprintf(
            'WITH cohort_counts AS (
                 SELECT cohort_definition_id,
                        COUNT(*)          AS subject_count,
                        MAX(created_at)   AS last_generated_at
                   FROM %s.cohort
                  GROUP BY cohort_definition_id
             )',
            $sourceLower
        );

        if ($isAdmin) {
            // Admin branch: no RBAC filter, no bound user id. Excludes only the
            // FinnGen-offset (>= 100_000_000_000) case cohorts.
            $rows = DB::connection('pgsql')->select(
                $cteSql.'
                 SELECT cd.id AS cohort_definition_id,
                        cd.name,
                        cc.subject_count,
                        cc.last_generated_at
                   FROM cohort_definitions cd
                   JOIN cohort_counts cc ON cc.cohort_definition_id = cd.id
                  WHERE cd.id < 100000000000
                  ORDER BY cc.last_generated_at DESC NULLS LAST
                  LIMIT 100',
                []
            );
        } else {
            // Non-admin branch: RBAC filter on author_id OR is_public. NULL author_id
            // cohorts that are NOT is_public are intentionally excluded (REVIEW §WR-03).
            $rows = DB::connection('pgsql')->select(
                $cteSql.'
                 SELECT cd.id AS cohort_definition_id,
                        cd.name,
                        cc.subject_count,
                        cc.last_generated_at
                   FROM cohort_definitions cd
                   JOIN cohort_counts cc ON cc.cohort_definition_id = cd.id
                  WHERE cd.id < 100000000000
                    AND (cd.author_id = ? OR cd.is_public = TRUE)
                  ORDER BY cc.last_generated_at DESC NULLS LAST
                  LIMIT 100',
                [$userId]
            );
        }

        $data = array_map(static function ($r): array {
            return [
                'cohort_definition_id' => (int) $r->cohort_definition_id,
                'name' => (string) $r->name,
                'subject_count' => (int) $r->subject_count,
                'last_generated_at' => $r->last_generated_at
                    ? Carbon::parse((string) $r->last_generated_at)->toIso8601String()
                    : null,
            ];
        }, $rows);

        return response()->json(['data' => $data]);
    }

    /**
     * Build a fresh generation snapshot for one endpoint name. Reads the
     * latest tracking row(s) and reconciles `last_status` + `last_subject_count`
     * against the current Run state on every read — this keeps the badge
     * accurate without needing a job-completion observer.
     *
     * @return list<array<string, mixed>>
     */
    private function loadGenerationsFor(string $endpointName): array
    {
        $rows = FinnGenEndpointGeneration::query()
            ->where('endpoint_name', $endpointName)
            ->with(['run:id,status,summary,finished_at'])
            ->get();

        $out = [];
        foreach ($rows as $g) {
            $run = $g->run;
            $currentStatus = $run?->status ?? $g->last_status;
            $currentCount = $g->last_subject_count;
            if ($run !== null && is_array($run->summary) && isset($run->summary['subject_count'])) {
                $currentCount = (int) $run->summary['subject_count'];
            }
            // Cheap drift fix: persist the up-to-date snapshot if it changed.
            if ($currentStatus !== $g->last_status || $currentCount !== $g->last_subject_count) {
                $g->update([
                    'last_status' => $currentStatus,
                    'last_subject_count' => $currentCount,
                ]);
            }
            $out[] = [
                'source_key' => $g->source_key,
                'run_id' => $g->run_id,
                'status' => $currentStatus,
                'subject_count' => $currentCount,
                'finished_at' => $run?->finished_at?->toIso8601String(),
                'updated_at' => $g->updated_at?->toIso8601String(),
            ];
        }

        return $out;
    }

    /**
     * Summary projection used by the index endpoint — keeps response small
     * since the page card only needs name, longname, coverage, and tags.
     *
     * Wire-compat note: the keys here MUST match what the frontend
     * `EndpointSummary` TypeScript type expects (coverage_bucket,
     * coverage_profile, release, coverage_pct, n_tokens_total,
     * n_tokens_resolved, level, sex_restriction). Plan 13.1-03 Assumption
     * A4 preserves this shape on the wire.
     *
     * @return array<string, mixed>
     */
    private function summarize(EndpointDefinition $row): array
    {
        $spec = is_array($row->qualifying_event_spec) ? $row->qualifying_event_spec : [];
        $coverage = $spec['coverage'] ?? [];
        $coverageBucket = $row->coverage_bucket instanceof CoverageBucket
            ? $row->coverage_bucket->value
            : $row->coverage_bucket;
        $coverageProfile = $row->coverage_profile instanceof CoverageProfile
            ? $row->coverage_profile->value
            : $row->coverage_profile;

        return [
            // Wire-compat: natural TEXT PK; name doubles as the row id.
            'id' => $row->name,
            'name' => $row->name,
            'longname' => $row->longname,
            'description' => $row->description,
            'tags' => $row->tags ?? [],
            'coverage_bucket' => $coverageBucket,
            'coverage_pct' => $coverage['pct'] ?? null,
            'n_tokens_total' => $row->total_tokens,
            'n_tokens_resolved' => $row->resolved_tokens,
            'release' => $row->release,
            'level' => $spec['level'] ?? null,
            'sex_restriction' => $spec['sex_restriction'] ?? null,
            'coverage_profile' => $coverageProfile,
        ];
    }
}
