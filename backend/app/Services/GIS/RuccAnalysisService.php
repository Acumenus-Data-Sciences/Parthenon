<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class RuccAnalysisService
{
    private const RUCC_LABELS = [
        1 => 'Metro ≥1M', 2 => 'Metro 250K-1M', 3 => 'Metro <250K',
        4 => 'Nonmetro ≥20K adj', 5 => 'Nonmetro ≥20K nonadj',
        6 => 'Nonmetro 2.5-19.9K adj', 7 => 'Nonmetro 2.5-19.9K nonadj',
        8 => 'Nonmetro <2.5K adj', 9 => 'Nonmetro <2.5K nonadj',
    ];

    private const RUCC_CATEGORIES = [
        'metro' => [1, 2, 3],
        'micro' => [4, 5, 6],
        'rural' => [7, 8, 9],
    ];

    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * County choropleth colored by RUCC 3-category classification.
     */
    public function choropleth(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS rucc_code,
                gs.patient_count,
                CASE
                    WHEN gs.avg_value <= 3 THEN 'metro'
                    WHEN gs.avg_value <= 6 THEN 'micro'
                    ELSE 'rural'
                END AS category,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'rucc'
              AND gl.location_type = 'county'
            ORDER BY gl.location_name
        ");
    }

    /**
     * COVID outcomes compared across metro/micro/rural.
     */
    public function outcomeComparison(int $conceptId, string $metric = 'cases'): array
    {
        $cteTable = $this->cohortService->cteTableForMetric($metric);
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']}
            SELECT
                CASE
                    WHEN ee.value_as_integer <= 3 THEN 'metro'
                    WHEN ee.value_as_integer <= 6 THEN 'micro'
                    ELSE 'rural'
                END AS category,
                COUNT(DISTINCT pg.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT pg.person_id), 0) * 100, 2) AS rate
            FROM gis.patient_geography pg
            JOIN gis.external_exposure ee ON pg.person_id = ee.person_id AND ee.exposure_type = 'rucc'
            LEFT JOIN {$cteTable} ct ON pg.person_id = ct.person_id
            GROUP BY category
            ORDER BY category
        ", $cte['bindings']);
    }

    /**
     * Full 9-category RUCC breakdown.
     */
    public function countyDetail(string $fips): array|null
    {
        $row = DB::connection('gis')->selectOne("
            SELECT
                gl.location_name,
                gl.geographic_code AS fips,
                gl.population,
                gs.avg_value AS rucc_code,
                gs.patient_count
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gl.geographic_code = ? AND gs.exposure_type = 'rucc'
        ", [$fips]);

        if (!$row) return null;

        $result = (array) $row;
        $code = (int) $row->rucc_code;
        $result['rucc_label'] = self::RUCC_LABELS[$code] ?? 'Unknown';
        $result['category'] = match (true) {
            $code <= 3 => 'metro',
            $code <= 6 => 'micro',
            default => 'rural',
        };

        return $result;
    }
}
