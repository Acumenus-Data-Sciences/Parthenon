<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinnGen\DownloadPrsRequest;
use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Services\FinnGen\PrsAggregationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Phase 17 GENOMICS-08 D-13/D-14 — backend read API for the Cohort-drawer PRS viz.
 *
 * Endpoints (all registered in backend/routes/api.php inside an
 * auth:sanctum + permission:profiles.view middleware group):
 *
 *   GET  /api/v1/cohort-definitions/{id}/prs?bins=N
 *     Aggregated histogram + quintiles + summary stats for every score that has
 *     been computed against this cohort (across every registered source schema).
 *     Response contains NO per-subject raw scores — aggregation is server-side
 *     (PG width_bucket + percentile_cont). T-17-S2 mitigation.
 *
 *   GET  /api/v1/cohort-definitions/{id}/prs/{scoreId}/download
 *     Streams per-subject raw scores as text/csv. Explicit opt-in with more
 *     restrictive throttle (10/min) vs. the aggregated read (120/min).
 *
 * Resolution:
 *   Cohort → candidate source schemas: iterate over every App\Models\App\Source
 *   row (soft-deleted excluded by default scope). Each source maps to
 *   `{lower(source_key)}_gwas_results` per the Phase 14 GwasSchemaProvisioner
 *   convention. We check schema existence first to avoid SELECTing from a
 *   missing relation (source never had PRS computed).
 */
final class CohortPrsController extends Controller
{
    private const SAFE_SOURCE_KEY_REGEX = '/^[A-Z][A-Z0-9_]*$/';

    public function __construct(
        private readonly PrsAggregationService $aggregator,
    ) {}

    /**
     * GET /api/v1/cohort-definitions/{id}/prs?bins=N
     */
    public function index(Request $request, int $id): JsonResponse
    {
        /** @var CohortDefinition $cohort */
        $cohort = CohortDefinition::findOrFail($id);

        $bins = (int) $request->query('bins', (string) PrsAggregationService::DEFAULT_BINS);

        $out = [];
        foreach ($this->candidateSchemas() as $schema) {
            // Find DISTINCT score_ids with rows for this cohort in this schema.
            $scoreRows = DB::connection()->select(
                "SELECT score_id, MAX(scored_at) AS scored_at
                   FROM {$schema}.prs_subject_scores
                  WHERE cohort_definition_id = ?
                  GROUP BY score_id
                  ORDER BY MAX(scored_at) DESC",
                [$cohort->id]
            );

            foreach ($scoreRows as $row) {
                $scoreId = (string) $row->score_id;
                $meta = DB::connection()->selectOne(
                    'SELECT pgs_name, trait_reported FROM vocab.pgs_scores WHERE score_id = ? LIMIT 1',
                    [$scoreId]
                );
                $agg = $this->aggregator->aggregate($schema, $scoreId, (int) $cohort->id, $bins);
                $out[] = [
                    'score_id' => $scoreId,
                    'pgs_name' => $meta?->pgs_name,
                    'trait_reported' => $meta?->trait_reported,
                    'scored_at' => $row->scored_at,
                    'subject_count' => $agg['subject_count'],
                    'summary' => $agg['summary'],
                    'quintiles' => $agg['quintiles'],
                    'histogram' => $agg['histogram'],
                ];
            }
        }

        return response()->json(['scores' => $out]);
    }

    /**
     * GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download
     *
     * CSV stream: `score_id,subject_id,raw_score\n...`. chunkById(10000) caps
     * memory so 10M-row cohort exports stay bounded (D-06 + RESEARCH §Pattern 4).
     */
    public function download(
        DownloadPrsRequest $request,
        int $id,
        string $scoreId
    ): StreamedResponse {
        /** @var CohortDefinition $cohort */
        $cohort = CohortDefinition::findOrFail($id);

        // Locate the FIRST source schema that carries rows for this (cohort, score).
        $schema = null;
        foreach ($this->candidateSchemas() as $candidate) {
            $has = DB::connection()->selectOne(
                "SELECT 1 AS ok FROM {$candidate}.prs_subject_scores
                  WHERE score_id = ? AND cohort_definition_id = ? LIMIT 1",
                [$scoreId, $cohort->id]
            );
            if ($has !== null) {
                $schema = $candidate;
                break;
            }
        }

        if ($schema === null) {
            abort(404, "No PRS rows for cohort_definition_id={$cohort->id} score_id={$scoreId}");
        }

        $filename = "prs-{$scoreId}-cohort-{$cohort->id}.csv";

        return response()->streamDownload(function () use ($schema, $scoreId, $cohort): void {
            $out = fopen('php://output', 'w');
            if ($out === false) {
                throw new \RuntimeException('Failed to open php://output for streaming');
            }
            fputcsv($out, ['score_id', 'subject_id', 'raw_score']);

            DB::connection()
                ->table("{$schema}.prs_subject_scores")
                ->select(['score_id', 'subject_id', 'raw_score'])
                ->where('score_id', $scoreId)
                ->where('cohort_definition_id', $cohort->id)
                ->orderBy('subject_id')
                ->chunkById(10000, function ($rows) use ($out): void {
                    foreach ($rows as $r) {
                        fputcsv($out, [$r->score_id, $r->subject_id, $r->raw_score]);
                    }
                }, 'subject_id');

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    /**
     * Enumerate candidate `{source_key}_gwas_results` schemas from registered
     * sources, filter to only those that actually exist in the DB.
     *
     * @return list<string>
     */
    private function candidateSchemas(): array
    {
        /** @var list<string> $candidates */
        $candidates = [];
        foreach (Source::query()->get(['source_key']) as $source) {
            $key = (string) $source->source_key;
            if (preg_match(self::SAFE_SOURCE_KEY_REGEX, $key) !== 1) {
                continue;
            }
            $candidates[] = strtolower($key).'_gwas_results';
        }

        if ($candidates === []) {
            return [];
        }

        // Filter to schemas that actually exist. Parameterize the IN list.
        $placeholders = implode(',', array_fill(0, count($candidates), '?'));
        $existing = DB::connection()->select(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ({$placeholders})",
            $candidates
        );

        return array_map(static fn ($r): string => (string) $r->schema_name, $existing);
    }
}
