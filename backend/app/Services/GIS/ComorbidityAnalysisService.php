<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class ComorbidityAnalysisService
{
    // Diabetes, Hypertension, Obesity concept IDs (SNOMED)
    private const COMORBIDITY_CONCEPTS = [
        'diabetes' => 201820,     // Type 2 DM
        'hypertension' => 320128, // Essential HTN
        'obesity' => 433736,      // Obesity
    ];

    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * Choropleth of comorbidity burden score by county.
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
                gs.avg_value AS burden_score,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'comorbidity_burden'
              AND gl.location_type = 'county'
            ORDER BY gs.avg_value DESC
        ");
    }

    /**
     * Hotspot data: counties with highest burden for spatial stats input.
     */
    public function hotspots(int $conceptId): array
    {
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']}
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS burden_score,
                gs.patient_count,
                COALESCE(dx.cnt, 0) AS covid_cases,
                COALESCE(hosp.cnt, 0) AS hospitalizations,
                ROUND(COALESCE(hosp.cnt, 0)::numeric / NULLIF(COALESCE(dx.cnt, 0), 0) * 100, 2) AS hosp_rate
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            LEFT JOIN (
                SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT cd.person_id) AS cnt
                FROM covid_dx cd JOIN gis.patient_geography pg ON cd.person_id = pg.person_id
                GROUP BY pg.county_location_id
            ) dx ON gl.geographic_location_id = dx.geo_id
            LEFT JOIN (
                SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT ch.person_id) AS cnt
                FROM covid_hosp ch JOIN gis.patient_geography pg ON ch.person_id = pg.person_id
                GROUP BY pg.county_location_id
            ) hosp ON gl.geographic_location_id = hosp.geo_id
            WHERE gs.exposure_type = 'comorbidity_burden'
              AND gl.location_type = 'county'
            ORDER BY gs.avg_value DESC
        ", $cte['bindings']);
    }

    /**
     * Burden score distribution histogram data.
     */
    public function burdenScore(): array
    {
        return DB::connection('gis')->select("
            SELECT
                WIDTH_BUCKET(gs.avg_value, 0, 3, 10) AS bucket,
                COUNT(*) AS county_count,
                ROUND(MIN(gs.avg_value), 2) AS bucket_min,
                ROUND(MAX(gs.avg_value), 2) AS bucket_max,
                SUM(gs.patient_count) AS total_patients
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'comorbidity_burden'
              AND gl.location_type = 'county'
            GROUP BY bucket
            ORDER BY bucket
        ");
    }
}
