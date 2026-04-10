<?php

declare(strict_types=1);

namespace App\Services\Analysis;

use App\DataTransferObjects\LabRangeDto;
use Illuminate\Database\DatabaseManager;

final class LabReferenceRangeService
{
    /** @var array<string, ?LabRangeDto> per-request memoization */
    private array $memo = [];

    public function __construct(
        private readonly DatabaseManager $db,
    ) {}

    /**
     * Resolve a reference range for one measurement context.
     *
     * Lookup order (see spec §5):
     *   1. Curated — sex-specific + age band match (narrowest wins)
     *   2. Curated — sex='A' + age band match (narrowest wins)
     *   3. Population — per (source, concept, unit)
     *   4. Null
     */
    public function lookup(
        int $sourceId,
        int $measurementConceptId,
        ?int $unitConceptId,
        ?string $personSex,
        ?int $personAgeYears,
    ): ?LabRangeDto {
        if ($unitConceptId === null) {
            return null;
        }

        $key = sprintf(
            '%d:%d:%d:%s:%s',
            $sourceId,
            $measurementConceptId,
            $unitConceptId,
            $personSex ?? '-',
            $personAgeYears === null ? '-' : (string) $personAgeYears,
        );

        if (array_key_exists($key, $this->memo)) {
            return $this->memo[$key];
        }

        // Step 1 — sex-specific curated (skipped if sex unknown)
        if ($personSex !== null) {
            $row = $this->queryCurated($measurementConceptId, $unitConceptId, $personSex, $personAgeYears);
            if ($row !== null) {
                return $this->memo[$key] = $this->curatedDto($row);
            }
        }

        // Step 2 — sex='A' curated
        $row = $this->queryCurated($measurementConceptId, $unitConceptId, 'A', $personAgeYears);
        if ($row !== null) {
            return $this->memo[$key] = $this->curatedDto($row);
        }

        // Step 3 — population fallback
        $row = $this->queryPopulation($sourceId, $measurementConceptId, $unitConceptId);
        if ($row !== null) {
            return $this->memo[$key] = $this->populationDto($row, $sourceId);
        }

        return $this->memo[$key] = null;
    }

    /**
     * Bulk variant — resolve ranges for a whole lab panel in one call.
     *
     * Delegates to `lookup()` per group to preserve memoization and the
     * full lookup-order precedence rules. DB roundtrips are bounded by
     * the number of distinct (concept, unit) tuples, not by calls.
     *
     * @param  list<array{concept_id:int, unit_concept_id:int|null}>  $groups
     * @return array<string, ?LabRangeDto> keyed by "{conceptId}:{unitConceptId}"
     */
    public function lookupMany(
        int $sourceId,
        array $groups,
        ?string $personSex,
        ?int $personAgeYears,
    ): array {
        $result = [];
        foreach ($groups as $group) {
            $conceptId = $group['concept_id'];
            $unitId = $group['unit_concept_id'];
            $key = sprintf('%d:%s', $conceptId, $unitId !== null ? (string) $unitId : 'null');

            $result[$key] = $this->lookup(
                $sourceId,
                $conceptId,
                $unitId,
                $personSex,
                $personAgeYears,
            );
        }

        return $result;
    }

    /**
     * Query the curated table for the narrowest matching row.
     *
     * Narrowness = (COALESCE(age_high, 65535) - COALESCE(age_low, 0)) ASC.
     * When personAgeYears is null, only match rows where both bounds are null.
     *
     * IMPORTANT: uses $this->db->table(...) NOT $this->db->connection('pgsql')->table(...)
     * The default connection resolves to pgsql in production and pgsql_testing in Pest.
     * Hardcoding 'pgsql' bypasses test isolation — see 9eb29cfdd for the Morpheus incident.
     */
    private function queryCurated(
        int $conceptId,
        int $unitConceptId,
        string $sex,
        ?int $personAgeYears,
    ): ?object {
        $query = $this->db->table('lab_reference_range_curated')
            ->where('measurement_concept_id', $conceptId)
            ->where('unit_concept_id', $unitConceptId)
            ->where('sex', $sex);

        if ($personAgeYears === null) {
            $query->whereNull('age_low')->whereNull('age_high');
        } else {
            $query->where(function ($q) use ($personAgeYears) {
                $q->whereNull('age_low')->orWhere('age_low', '<=', $personAgeYears);
            })->where(function ($q) use ($personAgeYears) {
                $q->whereNull('age_high')->orWhere('age_high', '>=', $personAgeYears);
            });
        }

        $query->orderByRaw('COALESCE(age_high, 65535) - COALESCE(age_low, 0) ASC')
            ->orderByRaw('COALESCE(age_low, 0) ASC')
            ->limit(1);

        /** @var object|null $row */
        $row = $query->first();

        return $row;
    }

    private function queryPopulation(int $sourceId, int $conceptId, int $unitConceptId): ?object
    {
        /** @var object|null $row */
        $row = $this->db->table('lab_reference_range_population')
            ->where('source_id', $sourceId)
            ->where('measurement_concept_id', $conceptId)
            ->where('unit_concept_id', $unitConceptId)
            ->first();

        return $row;
    }

    private function curatedDto(object $row): LabRangeDto
    {
        $sex = (string) $row->sex;
        $sexLabel = match ($sex) {
            'M' => 'M',
            'F' => 'F',
            default => 'Any',
        };
        $ageLabel = $this->formatAgeBand($row->age_low, $row->age_high);
        $sourceRef = (string) $row->source_ref;
        $label = sprintf('%s (%s%s)', $sourceRef, $sexLabel, $ageLabel !== '' ? ", {$ageLabel}" : '');

        return new LabRangeDto(
            low: (float) $row->range_low,
            high: (float) $row->range_high,
            source: 'curated',
            sourceLabel: $label,
            sourceRef: $sourceRef,
        );
    }

    private function populationDto(object $row, int $sourceId): LabRangeDto
    {
        /** @var string $sourceKey */
        $sourceKey = $this->db->table('sources')
            ->where('id', $sourceId)
            ->value('source_key') ?? 'source';

        $label = sprintf(
            '%s pop. P2.5–P97.5 (n=%s)',
            $sourceKey,
            number_format((float) $row->n_observations),
        );

        return new LabRangeDto(
            low: (float) $row->range_low,
            high: (float) $row->range_high,
            source: 'population',
            sourceLabel: $label,
            nObservations: (int) $row->n_observations,
        );
    }

    private function formatAgeBand(mixed $ageLow, mixed $ageHigh): string
    {
        $lo = $ageLow !== null ? (int) $ageLow : null;
        $hi = $ageHigh !== null ? (int) $ageHigh : null;

        if ($lo === null && $hi === null) {
            return '';
        }
        if ($hi === null) {
            return "{$lo}+";
        }
        if ($lo === null) {
            return "0-{$hi}";
        }

        return "{$lo}-{$hi}";
    }
}
