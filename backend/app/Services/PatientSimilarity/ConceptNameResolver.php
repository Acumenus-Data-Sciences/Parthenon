<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

use Illuminate\Support\Facades\DB;

/**
 * Batch-resolves OMOP concept IDs to human-readable names.
 *
 * Uses an in-memory cache per request and well-known constants
 * to minimize database round-trips. Queries vocab.concept explicitly
 * because omop.concept (empty CDM table) shadows it in the search_path.
 */
final class ConceptNameResolver
{
    /** @var array<int, string> */
    private array $cache = [];

    private const array WELL_KNOWN = [
        0 => 'No matching concept',
        8507 => 'Male',
        8532 => 'Female',
        8551 => 'Unknown',
        8527 => 'White',
        8516 => 'Black or African American',
        8515 => 'Asian',
        8557 => 'Native Hawaiian or Other Pacific Islander',
        8567 => 'American Indian or Alaska Native',
        38003563 => 'Hispanic or Latino',
        38003564 => 'Not Hispanic or Latino',
    ];

    /**
     * Resolve a batch of concept IDs to their names.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, string> Map of concept_id => concept_name
     */
    public function resolve(array $conceptIds): array
    {
        if ($conceptIds === []) {
            return [];
        }

        $conceptIds = array_unique(array_filter($conceptIds, fn (int $id): bool => $id > 0));
        $result = [];
        $toLookup = [];

        foreach ($conceptIds as $id) {
            if (isset($this->cache[$id])) {
                $result[$id] = $this->cache[$id];
            } elseif (isset(self::WELL_KNOWN[$id])) {
                $result[$id] = self::WELL_KNOWN[$id];
                $this->cache[$id] = self::WELL_KNOWN[$id];
            } else {
                $toLookup[] = $id;
            }
        }

        if ($toLookup !== []) {
            // Use vocab.concept explicitly — omop.concept is an empty CDM shell
            // that shadows vocab.concept in the omop connection's search_path.
            $rows = DB::connection('omop')
                ->table('vocab.concept')
                ->whereIn('concept_id', $toLookup)
                ->pluck('concept_name', 'concept_id')
                ->toArray();

            foreach ($rows as $id => $name) {
                $result[$id] = (string) $name;
                $this->cache[$id] = (string) $name;
            }
        }

        return $result;
    }

    /**
     * Resolve a single concept ID to its name.
     */
    public function resolveName(int $conceptId): string
    {
        $resolved = $this->resolve([$conceptId]);

        return $resolved[$conceptId] ?? "Concept {$conceptId}";
    }
}
