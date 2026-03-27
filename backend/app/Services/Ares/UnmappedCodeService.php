<?php

namespace App\Services\Ares;

use App\Concerns\SourceAware;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedCodeReview;
use App\Models\App\UnmappedSourceCode;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UnmappedCodeService
{
    use SourceAware;

    /**
     * Domain weights for impact score calculation.
     * Higher weight = more clinically significant when unmapped.
     */
    private const DOMAIN_WEIGHTS = [
        'condition_occurrence' => 1.0,
        'drug_exposure' => 0.9,
        'procedure_occurrence' => 0.8,
        'measurement' => 0.7,
        'device_exposure' => 0.6,
        'observation' => 0.5,
        'visit_occurrence' => 0.3,
    ];

    /**
     * Build a SQL CASE expression for domain weight lookup.
     */
    private function buildDomainWeightCase(): string
    {
        $cases = [];
        foreach (self::DOMAIN_WEIGHTS as $domain => $weight) {
            $cases[] = "WHEN cdm_table = '{$domain}' THEN {$weight}";
        }

        return 'CASE '.implode(' ', $cases).' ELSE 0.4 END';
    }

    /**
     * Get summary of unmapped codes grouped by CDM table/field for a specific release.
     *
     * @return Collection<int, object>
     */
    public function getSummary(Source $source, SourceRelease $release): Collection
    {
        return UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->selectRaw('cdm_table, cdm_field, COUNT(*) as code_count, SUM(record_count) as total_records')
            ->groupBy('cdm_table', 'cdm_field')
            ->orderByDesc('total_records')
            ->get();
    }

    /**
     * Get paginated details of unmapped codes with optional filters.
     *
     * @param  array{table?: string, field?: string, search?: string}  $filters
     */
    public function getDetails(
        Source $source,
        SourceRelease $release,
        array $filters = [],
        int $page = 1,
        int $perPage = 20,
    ): LengthAwarePaginator {
        $weightCase = $this->buildDomainWeightCase();

        $query = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->selectRaw("*, (record_count * ({$weightCase})) as impact_score");

        if (! empty($filters['table'])) {
            $query->where('cdm_table', $filters['table']);
        }

        if (! empty($filters['field'])) {
            $query->where('cdm_field', $filters['field']);
        }

        if (! empty($filters['search'])) {
            $query->where('source_code', 'ilike', '%'.$filters['search'].'%');
        }

        return $query->orderByDesc('impact_score')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Get aggregated unmapped code summary across all sources (latest release per source).
     *
     * @return Collection<int, object>
     */
    public function getNetworkSummary(): Collection
    {
        // Get latest release ID per source
        $latestReleases = DB::table('source_releases as sr')
            ->select('sr.id')
            ->whereRaw('sr.created_at = (
                SELECT MAX(sr2.created_at)
                FROM source_releases sr2
                WHERE sr2.source_id = sr.source_id
            )')
            ->pluck('id');

        if ($latestReleases->isEmpty()) {
            return collect();
        }

        return UnmappedSourceCode::whereIn('release_id', $latestReleases)
            ->selectRaw('cdm_table, cdm_field, COUNT(*) as code_count, SUM(record_count) as total_records')
            ->groupBy('cdm_table', 'cdm_field')
            ->orderByDesc('total_records')
            ->get();
    }

    /**
     * Get total count of unique unmapped source codes across all sources (latest releases).
     */
    public function getTotalUnmappedCount(): int
    {
        $latestReleases = DB::table('source_releases as sr')
            ->select('sr.id')
            ->whereRaw('sr.created_at = (
                SELECT MAX(sr2.created_at)
                FROM source_releases sr2
                WHERE sr2.source_id = sr.source_id
            )')
            ->pluck('id');

        if ($latestReleases->isEmpty()) {
            return 0;
        }

        return UnmappedSourceCode::whereIn('release_id', $latestReleases)->count();
    }

    /**
     * Get Pareto data for unmapped codes — cumulative % of records covered.
     *
     * @return array{codes: array<int, array{source_code: string, record_count: int, cumulative_percent: float}>, top_20_coverage: float}
     */
    public function getParetoData(Source $source, SourceRelease $release): array
    {
        try {
            $codes = UnmappedSourceCode::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->orderByDesc('record_count')
                ->select(['source_code', 'record_count'])
                ->get();

            if ($codes->isEmpty()) {
                return ['codes' => [], 'top_20_coverage' => 0.0];
            }

            $totalRecords = $codes->sum('record_count');
            $cumulative = 0;
            $paretoItems = [];

            foreach ($codes as $code) {
                $cumulative += $code->record_count;
                $paretoItems[] = [
                    'source_code' => $code->source_code,
                    'record_count' => (int) $code->record_count,
                    'cumulative_percent' => $totalRecords > 0
                        ? round(($cumulative / $totalRecords) * 100, 2)
                        : 0.0,
                ];
            }

            // Top 20 coverage
            $top20 = array_slice($paretoItems, 0, 20);
            $top20Coverage = ! empty($top20) ? end($top20)['cumulative_percent'] : 0.0;

            return [
                'codes' => $paretoItems,
                'top_20_coverage' => $top20Coverage,
            ];
        } catch (\Throwable $e) {
            Log::warning("UnmappedCodeService: getParetoData failed: {$e->getMessage()}");

            return ['codes' => [], 'top_20_coverage' => 0.0];
        }
    }

    /**
     * Get progress stats for unmapped code mapping workflow.
     *
     * @return array{total: int, mapped: int, deferred: int, excluded: int, pending: int}
     */
    public function getProgressStats(Source $source, SourceRelease $release): array
    {
        $totalCodes = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->count();

        $reviews = UnmappedCodeReview::where('source_id', $source->id)
            ->selectRaw('status, COUNT(*) as cnt')
            ->groupBy('status')
            ->pluck('cnt', 'status');

        return [
            'total' => $totalCodes,
            'mapped' => (int) ($reviews['mapped'] ?? 0),
            'deferred' => (int) ($reviews['deferred'] ?? 0),
            'excluded' => (int) ($reviews['excluded'] ?? 0),
            'pending' => max(0, $totalCodes - (int) ($reviews['mapped'] ?? 0) - (int) ($reviews['deferred'] ?? 0) - (int) ($reviews['excluded'] ?? 0)),
        ];
    }

    /**
     * Get vocabulary treemap data — aggregate unmapped codes by source_vocabulary_id.
     *
     * @return array<int, array{name: string, value: int, code_count: int}>
     */
    public function getVocabularyTreemap(Source $source, SourceRelease $release): array
    {
        return UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->selectRaw('source_vocabulary_id as name, SUM(record_count) as value, COUNT(*) as code_count')
            ->groupBy('source_vocabulary_id')
            ->orderByDesc(DB::raw('SUM(record_count)'))
            ->get()
            ->map(fn ($row) => [
                'name' => $row->name,
                'value' => (int) $row->value,
                'code_count' => (int) $row->code_count,
            ])
            ->toArray();
    }

    /**
     * Export unmapped codes in Usagi-compatible CSV format.
     *
     * @return array{headers: list<string>, rows: array<int, array<string, string|int>>}
     */
    public function exportUsagi(Source $source, SourceRelease $release): array
    {
        $codes = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->orderByDesc('record_count')
            ->get();

        $headers = ['sourceCode', 'sourceName', 'sourceFrequency', 'sourceAutoAssignedConceptIds', 'ADD_INFO:sourceVocabulary', 'ADD_INFO:cdmTable', 'ADD_INFO:cdmField'];

        $rows = $codes->map(fn ($code) => [
            'sourceCode' => $code->source_code,
            'sourceName' => $code->source_code,
            'sourceFrequency' => (int) $code->record_count,
            'sourceAutoAssignedConceptIds' => '',
            'ADD_INFO:sourceVocabulary' => $code->source_vocabulary_id,
            'ADD_INFO:cdmTable' => $code->cdm_table,
            'ADD_INFO:cdmField' => $code->cdm_field,
        ])->toArray();

        return ['headers' => $headers, 'rows' => $rows];
    }

    /**
     * Collect unmapped source codes from source_to_concept_map during Achilles runs.
     * Called as an additional step after standard Achilles analyses complete.
     */
    public function collectUnmappedCodes(Source $source, SourceRelease $release): int
    {
        // Delete existing unmapped codes for this release (idempotent)
        UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->delete();

        // Query source_to_concept_map for unmapped codes (target_concept_id = 0 or NULL)
        $unmapped = $this->vocab()
            ->table('source_to_concept_map')
            ->select([
                'source_code',
                'source_vocabulary_id',
                DB::raw("'condition_occurrence' as cdm_table"),
                DB::raw("'condition_source_value' as cdm_field"),
                DB::raw('1 as record_count'),
            ])
            ->where(function ($q) {
                $q->where('target_concept_id', 0)
                    ->orWhereNull('target_concept_id');
            })
            ->get();

        $rows = [];
        $now = now();

        foreach ($unmapped as $row) {
            $rows[] = [
                'source_id' => $source->id,
                'release_id' => $release->id,
                'source_code' => $row->source_code,
                'source_vocabulary_id' => $row->source_vocabulary_id,
                'cdm_table' => $row->cdm_table,
                'cdm_field' => $row->cdm_field,
                'record_count' => $row->record_count,
                'created_at' => $now,
            ];
        }

        if (! empty($rows)) {
            // Batch insert in chunks
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('unmapped_source_codes')->insert($chunk);
            }
        }

        return count($rows);
    }
}
