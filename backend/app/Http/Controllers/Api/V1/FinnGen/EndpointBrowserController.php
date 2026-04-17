<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Enums\CohortDomain;
use App\Http\Controllers\Controller;
use App\Models\App\CohortDefinition;
use App\Models\App\FinnGenUnmappedCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * SP4 Genomics #1 follow-on — researcher-facing browser for the imported
 * FinnGen endpoint library (~5,161 phenotype defs from DF14).
 *
 * Reads cohort_definitions where domain = finngen-endpoint. Surfaces the
 * top-level coverage_bucket so researchers can filter by mapping quality
 * before adopting an endpoint into their workbench.
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
     * GET /api/v1/finngen/endpoints
     *
     * Filters:
     *   q          — substring search across name, description, and the raw
     *                ICD code text in expression_json->source_codes.*.raw
     *   tag        — single tag (case-sensitive); e.g. 'cardiovascular',
     *                'cancer', 'finngen:df14'
     *   bucket     — single coverage bucket; one of BUCKETS
     *   release    — convenience alias for tag = "finngen:{release}"
     *   per_page   — 1..100, default 25
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = max(1, min(self::MAX_PER_PAGE, (int) $request->query('per_page', '25')));
        $q = trim((string) $request->query('q', ''));
        $tag = trim((string) $request->query('tag', ''));
        $bucket = trim((string) $request->query('bucket', ''));
        $release = trim((string) $request->query('release', ''));

        $query = CohortDefinition::query()
            ->where('domain', CohortDomain::FINNGEN_ENDPOINT->value)
            ->orderBy('name');

        if ($q !== '') {
            $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $q).'%';
            $query->where(function ($qb) use ($like): void {
                $qb->where('name', 'ILIKE', $like)
                    ->orWhere('description', 'ILIKE', $like)
                    ->orWhereRaw('expression_json::text ILIKE ?', [$like]);
            });
        }

        if (in_array($bucket, self::BUCKETS, true)) {
            $query->whereRaw("expression_json->>'coverage_bucket' = ?", [$bucket]);
        }

        if ($tag !== '') {
            $query->whereRaw('tags @> ?::jsonb', [json_encode([$tag])]);
        }
        if ($release !== '') {
            $query->whereRaw('tags @> ?::jsonb', [json_encode(['finngen:'.$release])]);
        }

        /** @var LengthAwarePaginator $page */
        $page = $query->paginate($perPage);

        $page->getCollection()->transform(fn (CohortDefinition $row): array => $this->summarize($row));

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
        $base = CohortDefinition::query()
            ->where('domain', CohortDomain::FINNGEN_ENDPOINT->value);

        $byBucket = (clone $base)
            ->selectRaw("COALESCE(expression_json->>'coverage_bucket', 'UNKNOWN') AS bucket, COUNT(*) AS n")
            ->groupBy(DB::raw("COALESCE(expression_json->>'coverage_bucket', 'UNKNOWN')"))
            ->pluck('n', 'bucket');

        // Top 20 tags excluding the boilerplate ones (finngen-endpoint, finngen:dfXX)
        $topTags = DB::connection('pgsql')->select("
            SELECT tag, COUNT(*) AS n
              FROM (
                SELECT jsonb_array_elements_text(tags) AS tag
                  FROM app.cohort_definitions
                 WHERE domain = ?
              ) t
             WHERE tag NOT IN ('finngen-endpoint')
               AND tag NOT LIKE 'finngen:%'
             GROUP BY tag
             ORDER BY n DESC
             LIMIT 20
        ", [CohortDomain::FINNGEN_ENDPOINT->value]);

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
     * Returns full row + parsed expression_json highlights for a single
     * endpoint. Lookup is by FinnGen short name (e.g., 'E4_DM2'), not
     * cohort_definition_id, since researchers think in FinnGen names.
     */
    public function show(string $name): JsonResponse
    {
        $row = CohortDefinition::query()
            ->where('domain', CohortDomain::FINNGEN_ENDPOINT->value)
            ->where('name', $name)
            ->firstOrFail();

        $expr = is_array($row->expression_json) ? $row->expression_json : [];
        $resolved = $expr['resolved_concepts'] ?? [];
        $coverage = $expr['coverage'] ?? [];

        return response()->json([
            'data' => [
                'id' => $row->id,
                'name' => $row->name,
                'longname' => $expr['longname'] ?? null,
                'description' => $row->description,
                'tags' => $row->tags ?? [],
                'release' => $expr['release'] ?? null,
                'coverage_bucket' => $expr['coverage_bucket'] ?? ($coverage['bucket'] ?? null),
                'coverage' => $coverage,
                'level' => $expr['level'] ?? null,
                'sex_restriction' => $expr['sex_restriction'] ?? null,
                'include_endpoints' => $expr['include_endpoints'] ?? [],
                'pre_conditions' => $expr['pre_conditions'] ?? null,
                'conditions' => $expr['conditions'] ?? null,
                'source_codes' => $expr['source_codes'] ?? [],
                'resolved_concepts' => [
                    'condition_count' => count($resolved['conditions_standard'] ?? []),
                    'drug_count' => count($resolved['drugs_standard'] ?? []),
                    'source_concept_count' => count($resolved['source_concept_ids'] ?? []),
                    'truncated' => $resolved['truncated'] ?? false,
                ],
                'created_at' => $row->created_at?->toIso8601String(),
                'updated_at' => $row->updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Summary projection used by the index endpoint — keeps response small
     * since the page card only needs name, longname, coverage, and tags.
     *
     * @return array<string, mixed>
     */
    private function summarize(CohortDefinition $row): array
    {
        $expr = is_array($row->expression_json) ? $row->expression_json : [];
        $coverage = $expr['coverage'] ?? [];

        return [
            'id' => $row->id,
            'name' => $row->name,
            'description' => $row->description,
            'tags' => $row->tags ?? [],
            'coverage_bucket' => $expr['coverage_bucket'] ?? ($coverage['bucket'] ?? null),
            'coverage_pct' => $coverage['pct'] ?? null,
            'n_tokens_total' => $coverage['n_tokens_total'] ?? null,
            'n_tokens_resolved' => $coverage['n_tokens_resolved'] ?? null,
            'release' => $expr['release'] ?? null,
            'level' => $expr['level'] ?? null,
            'sex_restriction' => $expr['sex_restriction'] ?? null,
        ];
    }
}
