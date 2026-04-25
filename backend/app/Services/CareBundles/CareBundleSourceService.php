<?php

namespace App\Services\CareBundles;

use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Source population lookup + min-N gating for the CareBundles workbench.
 *
 * Quality measures require a statistically adequate denominator. The
 * `care_bundles.min_population` config (default 100,000) defines the
 * threshold below which a source is flagged "research-only" and excluded
 * from materialize-all fan-outs by default.
 *
 * Person counts are cached per source_id for 24 hours (cheap: one COUNT(*)
 * per CDM schema, runs lazily on first access).
 */
class CareBundleSourceService
{
    /**
     * @return list<array{
     *     id:int, source_name:string, cdm_schema:string|null,
     *     person_count:int|null, qualifies:bool, reason:string|null
     * }>
     */
    public function listWithPopulation(): array
    {
        $threshold = (int) config('care_bundles.min_population', 100_000);

        return Source::with('daimons')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get()
            ->map(function (Source $source) use ($threshold): array {
                $schema = $source->getTableQualifier(DaimonType::CDM);
                $count = $schema ? $this->personCount($source->id, $schema) : null;

                [$qualifies, $reason] = $this->evaluateGate($count, $threshold);

                return [
                    'id' => $source->id,
                    'source_name' => (string) $source->source_name,
                    'cdm_schema' => $schema,
                    'person_count' => $count,
                    'qualifies' => $qualifies,
                    'reason' => $reason,
                ];
            })
            ->all();
    }

    /**
     * @return list<int> source IDs with person_count >= threshold
     */
    public function qualifyingSourceIds(): array
    {
        return array_values(array_map(
            fn ($s) => $s['id'],
            array_filter($this->listWithPopulation(), fn ($s) => $s['qualifies']),
        ));
    }

    public function personCount(int $sourceId, string $cdmSchema): ?int
    {
        $ttl = (int) config('care_bundles.population_cache_ttl', 86_400);

        return Cache::remember(
            "care-bundles:source-population:{$sourceId}",
            $ttl,
            function () use ($cdmSchema): ?int {
                try {
                    // search_path resolves the schema via CDM connections, but
                    // we intentionally fully-qualify here so this works on the
                    // default pgsql connection without switching.
                    $row = DB::selectOne("SELECT COUNT(*) AS c FROM \"{$cdmSchema}\".person");

                    return $row ? (int) $row->c : null;
                } catch (\Throwable $e) {
                    // Error level (not warning) so this surfaces in
                    // operational monitoring — a missing CDM SELECT grant
                    // for the default `pgsql` connection silently gates the
                    // source out of every materialize-all run, and the prior
                    // warning level was easy to miss.
                    Log::error('Source population lookup failed', [
                        'schema' => $cdmSchema,
                        'error' => $e->getMessage(),
                    ]);

                    return null;
                }
            }
        );
    }

    public function forgetCache(int $sourceId): void
    {
        Cache::forget("care-bundles:source-population:{$sourceId}");
    }

    /**
     * @return array{0:bool, 1:string|null}
     */
    private function evaluateGate(?int $count, int $threshold): array
    {
        if ($count === null) {
            return [false, 'CDM person table unavailable.'];
        }
        if ($count < $threshold) {
            return [
                false,
                sprintf(
                    'Population %s is below the %s threshold for statistical adequacy.',
                    number_format($count),
                    number_format($threshold),
                ),
            ];
        }

        return [true, null];
    }
}
