<?php

namespace App\Services\CareBundles;

use App\Models\App\ConditionBundle;
use App\Models\App\Source;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Read-side queries over the materialized care_bundle_qualifications fact table.
 *
 * Every query filters to the current run via care_bundle_current_runs so
 * callers always see the latest successful materialization without guessing.
 */
class CareBundleQualificationService
{
    /**
     * Full bundle × source coverage matrix: qualified person count per cell.
     * Only includes (bundle, source) pairs that have a current run.
     *
     * @return Collection<int, object{condition_bundle_id:int, source_id:int, qualified_patients:int, updated_at:string}>
     */
    public function coverageMatrix(): Collection
    {
        return DB::table('care_bundle_qualifications as cbq')
            ->join('care_bundle_current_runs as cbcr', 'cbcr.care_bundle_run_id', '=', 'cbq.care_bundle_run_id')
            ->where('cbq.qualifies', true)
            ->groupBy('cbq.condition_bundle_id', 'cbq.source_id', 'cbcr.updated_at')
            ->select([
                'cbq.condition_bundle_id',
                'cbq.source_id',
                DB::raw('COUNT(DISTINCT cbq.person_id) AS qualified_patients'),
                'cbcr.updated_at',
            ])
            ->get();
    }

    /**
     * Qualified person count for a single (bundle, source) pair, from the
     * current run. Returns 0 if no run has completed yet.
     */
    public function bundleSourceCount(ConditionBundle $bundle, Source $source): int
    {
        $runId = DB::table('care_bundle_current_runs')
            ->where('condition_bundle_id', $bundle->id)
            ->where('source_id', $source->id)
            ->value('care_bundle_run_id');

        if ($runId === null) {
            return 0;
        }

        return (int) DB::table('care_bundle_qualifications')
            ->where('care_bundle_run_id', $runId)
            ->where('qualifies', true)
            ->distinct()
            ->count('person_id');
    }

    /**
     * N-way intersection query: persons in the given source who qualify for
     * the requested bundles per the mode semantics.
     *
     * mode:
     *   - 'all'     : patient is in every bundle (AND) — HAVING COUNT = N
     *   - 'any'     : patient is in at least one bundle (OR)
     *   - 'exactly' : patient is in exactly these bundles and no others
     *
     * @param  list<int>  $bundleIds
     * @return Collection<int, int> person_ids
     */
    public function intersection(Source $source, array $bundleIds, string $mode = 'all'): Collection
    {
        $bundleIds = $this->normalizeBundleIds($bundleIds);

        if (empty($bundleIds)) {
            return collect();
        }

        return $this->intersectionQuery($source, $bundleIds, $mode)
            ->pluck('cbq.person_id')
            ->map(fn ($id) => (int) $id);
    }

    /**
     * Count-only variant — cheap aggregate for the intersection endpoint.
     *
     * @param  list<int>  $bundleIds
     */
    public function intersectionCount(Source $source, array $bundleIds, string $mode = 'all'): int
    {
        $bundleIds = $this->normalizeBundleIds($bundleIds);

        if (empty($bundleIds)) {
            return 0;
        }

        return (int) DB::query()
            ->fromSub(
                $this->intersectionQuery($source, $bundleIds, $mode)->select('cbq.person_id'),
                'x',
            )
            ->count();
    }

    /**
     * Random sample of person_ids from the intersection. Used for the
     * intersection preview endpoint — capped and PHI-safe.
     *
     * @param  list<int>  $bundleIds
     * @return list<int>
     */
    public function sampleIntersection(
        Source $source,
        array $bundleIds,
        string $mode = 'all',
        int $limit = 20,
    ): array {
        $bundleIds = $this->normalizeBundleIds($bundleIds);

        if (empty($bundleIds)) {
            return [];
        }

        /** @var list<int> $ids */
        $ids = DB::query()
            ->fromSub(
                $this->intersectionQuery($source, $bundleIds, $mode)->select('cbq.person_id'),
                'x',
            )
            ->orderByRaw('RANDOM()')
            ->limit($limit)
            ->pluck('person_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $ids;
    }

    /**
     * UpSet matrix: for each distinct non-empty subset of the selected bundles
     * that at least one qualified person falls into, the person count.
     *
     * Example return: [{bundles:[12,17], count:420}, {bundles:[12], count:900}, ...]
     *
     * @param  list<int>  $bundleIds
     * @return list<array{bundles:list<int>, count:int}>
     */
    public function upsetMatrix(Source $source, array $bundleIds): array
    {
        $bundleIds = $this->normalizeBundleIds($bundleIds);

        if (empty($bundleIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($bundleIds), '?'));

        $sql = "
            WITH person_memberships AS (
                SELECT cbq.person_id,
                       ARRAY_AGG(DISTINCT cbq.condition_bundle_id ORDER BY cbq.condition_bundle_id) AS bundles
                FROM care_bundle_qualifications cbq
                INNER JOIN care_bundle_current_runs cbcr
                    ON cbcr.care_bundle_run_id = cbq.care_bundle_run_id
                WHERE cbq.source_id = ?
                  AND cbq.qualifies = TRUE
                  AND cbq.condition_bundle_id IN ({$placeholders})
                GROUP BY cbq.person_id
            )
            SELECT bundles, COUNT(*) AS person_count
            FROM person_memberships
            GROUP BY bundles
            ORDER BY person_count DESC
        ";

        $rows = DB::connection()->select(
            $sql,
            array_merge([$source->id], $bundleIds),
        );

        /** @var list<array{bundles:list<int>, count:int}> $cells */
        $cells = [];
        foreach ($rows as $row) {
            $bundles = is_string($row->bundles)
                ? $this->parsePgIntArray($row->bundles)
                : array_map('intval', (array) $row->bundles);

            $cells[] = [
                'bundles' => $bundles,
                'count' => (int) $row->person_count,
            ];
        }

        return $cells;
    }

    /**
     * @param  list<int>  $bundleIds
     */
    private function intersectionQuery(
        Source $source,
        array $bundleIds,
        string $mode,
    ): Builder {
        $query = DB::table('care_bundle_qualifications as cbq')
            ->join('care_bundle_current_runs as cbcr', 'cbcr.care_bundle_run_id', '=', 'cbq.care_bundle_run_id')
            ->where('cbq.source_id', $source->id)
            ->where('cbq.qualifies', true)
            ->whereIn('cbq.condition_bundle_id', $bundleIds)
            ->groupBy('cbq.person_id');

        if ($mode === 'all') {
            $query->havingRaw('COUNT(DISTINCT cbq.condition_bundle_id) = ?', [count($bundleIds)]);
        } elseif ($mode === 'exactly') {
            $query->havingRaw('COUNT(DISTINCT cbq.condition_bundle_id) = ?', [count($bundleIds)]);
            $query->whereNotExists(function ($sub) use ($source, $bundleIds) {
                $sub->select(DB::raw(1))
                    ->from('care_bundle_qualifications as other')
                    ->join('care_bundle_current_runs as occr', 'occr.care_bundle_run_id', '=', 'other.care_bundle_run_id')
                    ->whereColumn('other.person_id', 'cbq.person_id')
                    ->where('other.source_id', $source->id)
                    ->where('other.qualifies', true)
                    ->whereNotIn('other.condition_bundle_id', $bundleIds);
            });
        }
        // 'any' — no additional filter

        return $query;
    }

    /**
     * @param  list<int|string>  $bundleIds
     * @return list<int>
     */
    private function normalizeBundleIds(array $bundleIds): array
    {
        return array_values(array_unique(array_map('intval', $bundleIds)));
    }

    /**
     * Parse a PostgreSQL array literal like "{12,17,22}" into a list<int>.
     *
     * @return list<int>
     */
    private function parsePgIntArray(string $literal): array
    {
        $trimmed = trim($literal, '{}');
        if ($trimmed === '') {
            return [];
        }

        return array_values(array_map('intval', explode(',', $trimmed)));
    }
}
