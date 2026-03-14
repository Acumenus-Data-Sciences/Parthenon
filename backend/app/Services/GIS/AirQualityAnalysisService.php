<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class AirQualityAnalysisService
{
    // Respiratory condition concepts for outcome analysis
    private const RESPIRATORY_CONCEPTS = [
        'asthma' => 317009,
        'copd' => 255573,
        'pneumonia' => 255848,
    ];

    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * Choropleth of PM2.5 or ozone levels by county.
     */
    public function choropleth(string $pollutant = 'pm25'): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS pollutant_value,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = ?
              AND gl.location_type = 'county'
            ORDER BY gs.avg_value DESC
        ", [$pollutant]);
    }

    /**
     * Respiratory outcomes by air quality tertile.
     */
    public function respiratoryOutcomes(int $conceptId, string $pollutant = 'pm25'): array
    {
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']},
            aq_tertiles AS (
                SELECT
                    pg.person_id,
                    ee.value_as_number AS aq_value,
                    NTILE(3) OVER (ORDER BY ee.value_as_number) AS tertile
                FROM gis.patient_geography pg
                JOIN gis.external_exposure ee ON pg.person_id = ee.person_id
                WHERE ee.exposure_type = ?
            )
            SELECT
                aq.tertile,
                COUNT(DISTINCT aq.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT aq.person_id), 0) * 100, 2) AS rate,
                ROUND(MIN(aq.aq_value), 2) AS tertile_min,
                ROUND(MAX(aq.aq_value), 2) AS tertile_max
            FROM aq_tertiles aq
            LEFT JOIN covid_hosp ct ON aq.person_id = ct.person_id
            GROUP BY aq.tertile
            ORDER BY aq.tertile
        ", array_merge($cte['bindings'], [$pollutant]));
    }

    /**
     * County detail with both pollutant values.
     */
    public function countyDetail(string $fips): ?array
    {
        $row = DB::connection('gis')->selectOne("
            SELECT
                gl.location_name,
                gl.geographic_code AS fips,
                gl.population,
                pm25.avg_value AS pm25_value,
                ozone.avg_value AS ozone_value,
                pm25.patient_count
            FROM gis.geographic_location gl
            LEFT JOIN gis.geography_summary pm25 ON gl.geographic_location_id = pm25.geographic_location_id AND pm25.exposure_type = 'pm25'
            LEFT JOIN gis.geography_summary ozone ON gl.geographic_location_id = ozone.geographic_location_id AND ozone.exposure_type = 'ozone'
            WHERE gl.geographic_code = ? AND gl.location_type = 'county'
        ", [$fips]);

        return $row ? (array) $row : null;
    }
}
