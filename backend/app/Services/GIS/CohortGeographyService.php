<?php

declare(strict_types=1);

namespace App\Services\GIS;

use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

class CohortGeographyService
{
    private const DEFAULT_SOURCE_KEY = 'ACUMENUS';

    public function defaultSource(): ?Source
    {
        return Source::with('daimons')->where('source_key', self::DEFAULT_SOURCE_KEY)->first();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function generatedCohorts(Source $source, ?string $search = null, int $limit = 25): array
    {
        $source->loadMissing('daimons');
        $resultsSchema = $this->schemaIdentifier($source->getTableQualifier(DaimonType::Results), 'results schema');
        $limit = max(1, min($limit, 100));

        $bindings = [(int) $source->id];
        $where = '';
        if ($search !== null && trim($search) !== '') {
            $where = 'WHERE cd.name ILIKE ? OR c.cohort_definition_id::text = ?';
            $bindings[] = '%'.trim($search).'%';
            $bindings[] = trim($search);
        }

        $rows = DB::connection('gis')->select(<<<SQL
            SELECT
                c.cohort_definition_id,
                COALESCE(cd.name, 'Cohort ' || c.cohort_definition_id::text) AS name,
                COUNT(DISTINCT c.subject_id) AS subject_count,
                COUNT(DISTINCT pg.person_id) AS geocoded_count,
                ROUND(
                    COUNT(DISTINCT pg.person_id)::numeric
                    / NULLIF(COUNT(DISTINCT c.subject_id), 0) * 100,
                    2
                ) AS coverage_percent
            FROM {$resultsSchema}.cohort c
            LEFT JOIN app.cohort_definitions cd ON cd.id = c.cohort_definition_id
            LEFT JOIN gis.patient_geography pg
                ON pg.source_id = ?
               AND pg.person_id = c.subject_id
            {$where}
            GROUP BY c.cohort_definition_id, cd.name
            ORDER BY geocoded_count DESC, subject_count DESC, c.cohort_definition_id
            LIMIT {$limit}
        SQL, $bindings);

        return array_map(fn (object $row): array => [
            'cohort_definition_id' => (int) $row->cohort_definition_id,
            'name' => (string) $row->name,
            'subject_count' => (int) $row->subject_count,
            'geocoded_count' => (int) $row->geocoded_count,
            'coverage_percent' => $row->coverage_percent !== null ? (float) $row->coverage_percent : 0.0,
        ], $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function conditions(Source $source, ?string $search = null, int $limit = 25): array
    {
        $source->loadMissing('daimons');
        $cdmSchema = $this->schemaIdentifier($source->getTableQualifier(DaimonType::CDM), 'CDM schema');
        $vocabSchema = $this->schemaIdentifier($source->getTableQualifier(DaimonType::Vocabulary), 'vocabulary schema');
        $limit = max(1, min($limit, 100));

        $bindings = [(int) $source->id];
        $where = 'co.condition_concept_id <> 0';
        if ($search !== null && trim($search) !== '') {
            $where .= ' AND (c.concept_name ILIKE ? OR co.condition_concept_id::text = ?)';
            $bindings[] = '%'.trim($search).'%';
            $bindings[] = trim($search);
        }

        $rows = DB::connection('gis')->select(<<<SQL
            SELECT
                co.condition_concept_id AS concept_id,
                c.concept_name AS name,
                COUNT(DISTINCT co.person_id) AS subject_count,
                COUNT(DISTINCT pg.person_id) AS geocoded_count,
                ROUND(
                    COUNT(DISTINCT pg.person_id)::numeric
                    / NULLIF(COUNT(DISTINCT co.person_id), 0) * 100,
                    2
                ) AS coverage_percent
            FROM {$cdmSchema}.condition_occurrence co
            JOIN {$vocabSchema}.concept c ON c.concept_id = co.condition_concept_id
            LEFT JOIN gis.patient_geography pg
                ON pg.source_id = ?
               AND pg.person_id = co.person_id
            WHERE {$where}
            GROUP BY co.condition_concept_id, c.concept_name
            ORDER BY geocoded_count DESC, subject_count DESC, c.concept_name
            LIMIT {$limit}
        SQL, $bindings);

        return array_map(fn (object $row): array => [
            'concept_id' => (int) $row->concept_id,
            'name' => (string) $row->name,
            'subject_count' => (int) $row->subject_count,
            'geocoded_count' => (int) $row->geocoded_count,
            'coverage_percent' => $row->coverage_percent !== null ? (float) $row->coverage_percent : 0.0,
        ], $rows);
    }

    /**
     * @return array<string, mixed>
     */
    public function coverage(Source $source, string $stateFips = '42'): array
    {
        $levels = [];
        foreach (['county' => 'county_location_id', 'tract' => 'tract_location_id'] as $level => $column) {
            $row = DB::connection('gis')->selectOne(<<<SQL
                SELECT
                    COUNT(DISTINCT gl.geographic_location_id) AS geography_count,
                    COUNT(DISTINCT gl.geographic_location_id) FILTER (WHERE gl.geometry IS NOT NULL) AS geometry_count,
                    COUNT(DISTINCT pg.person_id) AS linked_person_count
                FROM gis.geographic_location gl
                LEFT JOIN gis.patient_geography pg
                    ON pg.source_id = ?
                   AND pg.{$column} = gl.geographic_location_id
                WHERE gl.location_type = ?
                  AND gl.state_fips = ?
            SQL, [(int) $source->id, $level === 'tract' ? 'census_tract' : 'county', $stateFips]);

            $geographyCount = (int) ($row->geography_count ?? 0);
            $geometryCount = (int) ($row->geometry_count ?? 0);
            $linkedPersonCount = (int) ($row->linked_person_count ?? 0);

            $levels[$level] = [
                'level' => $level,
                'available' => $geographyCount > 0 && $geometryCount > 0 && $linkedPersonCount > 0,
                'geography_count' => $geographyCount,
                'geometry_count' => $geometryCount,
                'linked_person_count' => $linkedPersonCount,
            ];
        }

        return [
            'source_id' => (int) $source->id,
            'source_key' => $source->source_key,
            'source_name' => $source->source_name,
            'state_fips' => $stateFips,
            'levels' => $levels,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function aggregate(
        Source $source,
        string $mode,
        int $targetId,
        string $level = 'county',
        string $metric = 'members',
        int $minCellCount = 5,
        string $stateFips = '42',
    ): array {
        $source->loadMissing('daimons');
        $levelConfig = $this->levelConfig($level);
        $selected = $this->selectedCte($source, $mode, $targetId);
        $minCellCount = max(0, min($minCellCount, 100));

        $rows = DB::connection('gis')->select(<<<SQL
            WITH selected AS (
                {$selected['sql']}
            ),
            source_geo AS (
                SELECT pg.person_id, pg.{$levelConfig['patient_column']} AS geo_id
                FROM gis.patient_geography pg
                WHERE pg.source_id = ?
                  AND pg.{$levelConfig['patient_column']} IS NOT NULL
            ),
            denominator AS (
                SELECT geo_id, COUNT(DISTINCT person_id) AS denominator
                FROM source_geo
                GROUP BY geo_id
            ),
            numerator AS (
                SELECT sg.geo_id, COUNT(DISTINCT s.person_id) AS member_count
                FROM selected s
                JOIN source_geo sg ON sg.person_id = s.person_id
                GROUP BY sg.geo_id
            ),
            totals AS (
                SELECT COUNT(DISTINCT person_id) AS total_selected FROM selected
            ),
            geocoded AS (
                SELECT COUNT(DISTINCT s.person_id) AS geocoded_selected
                FROM selected s
                JOIN source_geo sg ON sg.person_id = s.person_id
            )
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gl.population,
                gl.area_sq_km,
                ST_AsGeoJSON(gl.geometry)::json AS geometry,
                d.denominator,
                CASE
                    WHEN COALESCE(n.member_count, 0) > 0
                     AND COALESCE(n.member_count, 0) < ?
                    THEN NULL
                    ELSE COALESCE(n.member_count, 0)
                END AS member_count,
                CASE
                    WHEN COALESCE(n.member_count, 0) > 0
                     AND COALESCE(n.member_count, 0) < ?
                    THEN NULL
                    ELSE ROUND(COALESCE(n.member_count, 0)::numeric / NULLIF(d.denominator, 0) * 1000, 3)
                END AS rate_per_1000,
                CASE
                    WHEN COALESCE(n.member_count, 0) > 0
                     AND COALESCE(n.member_count, 0) < ?
                    THEN TRUE
                    ELSE FALSE
                END AS suppressed,
                totals.total_selected,
                geocoded.geocoded_selected
            FROM denominator d
            JOIN gis.geographic_location gl ON gl.geographic_location_id = d.geo_id
            LEFT JOIN numerator n ON n.geo_id = d.geo_id
            CROSS JOIN totals
            CROSS JOIN geocoded
            WHERE gl.location_type = ?
              AND gl.state_fips = ?
              AND gl.geometry IS NOT NULL
            ORDER BY
                CASE WHEN ? = 'prevalence_per_1000'
                     THEN COALESCE(ROUND(COALESCE(n.member_count, 0)::numeric / NULLIF(d.denominator, 0) * 1000, 3), 0)
                     ELSE COALESCE(n.member_count, 0)
                END DESC,
                gl.location_name
        SQL, array_merge(
            $selected['bindings'],
            [
                (int) $source->id,
                $minCellCount,
                $minCellCount,
                $minCellCount,
                $levelConfig['location_type'],
                $stateFips,
                $metric,
            ],
        ));

        $features = array_map(function (object $row) use ($metric): array {
            $memberCount = $row->member_count !== null ? (int) $row->member_count : null;
            $rate = $row->rate_per_1000 !== null ? (float) $row->rate_per_1000 : null;
            $geometry = $row->geometry;
            if (is_string($geometry)) {
                $geometry = json_decode($geometry, true);
            }

            return [
                'geographic_location_id' => (int) $row->geographic_location_id,
                'location_name' => (string) $row->location_name,
                'fips' => (string) $row->fips,
                'latitude' => $row->latitude !== null ? (float) $row->latitude : null,
                'longitude' => $row->longitude !== null ? (float) $row->longitude : null,
                'population' => $row->population !== null ? (int) $row->population : null,
                'area_sq_km' => $row->area_sq_km !== null ? (float) $row->area_sq_km : null,
                'geometry' => $geometry,
                'member_count' => $memberCount,
                'denominator' => (int) $row->denominator,
                'rate_per_1000' => $rate,
                'value' => $metric === 'prevalence_per_1000' ? $rate : $memberCount,
                'suppressed' => (bool) $row->suppressed,
            ];
        }, $rows);

        $totalSelected = (int) ($rows[0]->total_selected ?? 0);
        $geocodedSelected = (int) ($rows[0]->geocoded_selected ?? 0);
        $suppressedGeographies = count(array_filter($features, fn (array $row): bool => (bool) $row['suppressed']));

        return [
            'source' => [
                'id' => (int) $source->id,
                'key' => $source->source_key,
                'name' => $source->source_name,
            ],
            'mode' => $mode,
            'target_id' => $targetId,
            'level' => $level,
            'metric' => $metric,
            'min_cell_count' => $minCellCount,
            'state_fips' => $stateFips,
            'summary' => [
                'total_members' => $totalSelected,
                'geocoded_members' => $geocodedSelected,
                'unknown_members' => max($totalSelected - $geocodedSelected, 0),
                'coverage_percent' => $totalSelected > 0 ? round($geocodedSelected / $totalSelected * 100, 2) : 0.0,
                'geography_count' => count($features),
                'suppressed_geographies' => $suppressedGeographies,
            ],
            'features' => $features,
        ];
    }

    /**
     * @return array{patient_column: string, location_type: string}
     */
    private function levelConfig(string $level): array
    {
        return match ($level) {
            'county' => ['patient_column' => 'county_location_id', 'location_type' => 'county'],
            'tract' => ['patient_column' => 'tract_location_id', 'location_type' => 'census_tract'],
            default => throw new InvalidArgumentException("Unsupported geography level: {$level}"),
        };
    }

    /**
     * @return array{sql: string, bindings: array<int, mixed>}
     */
    private function selectedCte(Source $source, string $mode, int $targetId): array
    {
        if ($mode === 'generated') {
            $resultsSchema = $this->schemaIdentifier($source->getTableQualifier(DaimonType::Results), 'results schema');

            return [
                'sql' => "SELECT DISTINCT c.subject_id AS person_id FROM {$resultsSchema}.cohort c WHERE c.cohort_definition_id = ?",
                'bindings' => [$targetId],
            ];
        }

        if ($mode === 'condition') {
            $cdmSchema = $this->schemaIdentifier($source->getTableQualifier(DaimonType::CDM), 'CDM schema');

            return [
                'sql' => "SELECT DISTINCT co.person_id FROM {$cdmSchema}.condition_occurrence co WHERE co.condition_concept_id = ?",
                'bindings' => [$targetId],
            ];
        }

        throw new InvalidArgumentException("Unsupported cohort geography mode: {$mode}");
    }

    private function schemaIdentifier(?string $schema, string $label): string
    {
        if ($schema === null || ! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $schema)) {
            throw new RuntimeException("Source is missing a valid {$label}.");
        }

        return $schema;
    }
}
