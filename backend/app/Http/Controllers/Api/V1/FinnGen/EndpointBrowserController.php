<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Http\Controllers\Controller;
use App\Models\App\FinnGen\EndpointDefinition;
use App\Models\App\FinnGenEndpointGeneration;
use App\Models\App\FinnGenUnmappedCode;
use App\Models\App\Source;
use App\Services\FinnGen\FinnGenRunService;
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
                'generations' => $this->loadGenerationsFor($row->name),
                'created_at' => $row->created_at?->toIso8601String(),
                'updated_at' => $row->updated_at?->toIso8601String(),
            ],
        ]);
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

        $params = [
            // Phase 13.1: cohort_definition_id is null for new generations
            // (the endpoint is no longer an app.cohort_definitions row).
            // The R worker keys on endpoint_name going forward.
            'cohort_definition_id' => null,
            'condition_concept_ids' => $conditionConcepts,
            'drug_concept_ids' => $drugConcepts,
            'source_concept_ids' => $sourceConcepts,
            'sex_restriction' => $sex,
            'overwrite_existing' => (bool) ($data['overwrite_existing'] ?? false),
            'endpoint_name' => $row->name,
        ];

        $run = $this->runs->create(
            userId: (int) $request->user()->id,
            sourceKey: (string) $data['source_key'],
            analysisType: 'endpoint.generate',
            params: $params,
        );

        // Upsert generation tracking row keyed by (endpoint_name, source_key)
        // — one row per pair, refreshed on every dispatch so the browser can
        // surface "Generated on: SOURCE" badges with the latest run + status
        // without joining {source_results}.cohort on every render.
        // Phase 13.1 D-07: new rows populate finngen_endpoint_name (FK to
        // finngen.endpoint_definitions.name); cohort_definition_id stays null.
        FinnGenEndpointGeneration::updateOrCreate(
            [
                'endpoint_name' => (string) $row->name,
                'source_key' => (string) $data['source_key'],
            ],
            [
                'finngen_endpoint_name' => (string) $row->name,
                'cohort_definition_id' => null,
                'run_id' => (string) $run->id,
                'last_status' => (string) $run->status,
                'last_subject_count' => null,
            ],
        );

        return response()->json([
            'data' => [
                'run' => $run,
                'cohort_definition_id' => null,
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
