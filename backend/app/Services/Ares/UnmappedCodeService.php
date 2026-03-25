<?php

namespace App\Services\Ares;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UnmappedCodeService
{
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
        $query = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id);

        if (! empty($filters['table'])) {
            $query->where('cdm_table', $filters['table']);
        }

        if (! empty($filters['field'])) {
            $query->where('cdm_field', $filters['field']);
        }

        if (! empty($filters['search'])) {
            $query->where('source_code', 'ilike', '%'.$filters['search'].'%');
        }

        return $query->orderByDesc('record_count')
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
        $unmapped = DB::connection('omop')
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
