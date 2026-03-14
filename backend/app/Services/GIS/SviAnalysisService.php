<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class SviAnalysisService
{
    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * Choropleth data: SVI value per geography with patient counts.
     */
    public function choropleth(string $level = 'county', string $theme = 'overall'): array
    {
        $exposureType = $theme === 'overall' ? 'svi_overall' : "svi_theme{$theme}";
        $locationType = $level === 'tract' ? 'census_tract' : 'county';

        return DB::connection('gis')->select('
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS svi_value,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = ?
              AND gl.location_type = ?
            ORDER BY gs.avg_value DESC
        ', [$exposureType, $locationType]);
    }

    /**
     * Quartile analysis: COVID outcomes grouped by SVI quartile.
     */
    public function quartileAnalysis(int $conceptId, string $metric = 'cases'): array
    {
        $cteTable = $this->cohortService->cteTableForMetric($metric);
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']},
            patient_svi AS (
                SELECT
                    pg.person_id,
                    ee.value_as_number AS svi_value,
                    NTILE(4) OVER (ORDER BY ee.value_as_number) AS quartile
                FROM gis.patient_geography pg
                JOIN gis.external_exposure ee ON pg.person_id = ee.person_id
                WHERE ee.exposure_type = 'svi_overall'
            )
            SELECT
                ps.quartile,
                COUNT(DISTINCT ps.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT ps.person_id), 0) * 100, 2) AS rate,
                MIN(ps.svi_value) AS quartile_min,
                MAX(ps.svi_value) AS quartile_max
            FROM patient_svi ps
            LEFT JOIN {$cteTable} ct ON ps.person_id = ct.person_id
            GROUP BY ps.quartile
            ORDER BY ps.quartile
        ", $cte['bindings']);
    }

    /**
     * Correlation between 4 SVI themes and 3 outcome metrics.
     */
    public function themeCorrelations(int $conceptId): array
    {
        $themes = ['svi_theme1', 'svi_theme2', 'svi_theme3', 'svi_theme4'];
        $results = [];
        $cte = $this->cohortService->allCtes($conceptId);

        foreach ($themes as $theme) {
            $rows = DB::connection('gis')->select("
                {$cte['sql']}
                SELECT
                    gs.geographic_location_id,
                    gs.avg_value AS theme_value,
                    COALESCE(dx.cnt, 0) AS cases,
                    COALESCE(hosp.cnt, 0) AS hospitalizations,
                    COALESCE(death.cnt, 0) AS deaths,
                    gs.patient_count
                FROM gis.geography_summary gs
                LEFT JOIN (
                    SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT cd.person_id) AS cnt
                    FROM covid_dx cd JOIN gis.patient_geography pg ON cd.person_id = pg.person_id
                    GROUP BY pg.county_location_id
                ) dx ON gs.geographic_location_id = dx.geo_id
                LEFT JOIN (
                    SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT ch.person_id) AS cnt
                    FROM covid_hosp ch JOIN gis.patient_geography pg ON ch.person_id = pg.person_id
                    GROUP BY pg.county_location_id
                ) hosp ON gs.geographic_location_id = hosp.geo_id
                LEFT JOIN (
                    SELECT pg.county_location_id AS geo_id, COUNT(DISTINCT cd2.person_id) AS cnt
                    FROM covid_death cd2 JOIN gis.patient_geography pg ON cd2.person_id = pg.person_id
                    GROUP BY pg.county_location_id
                ) death ON gs.geographic_location_id = death.geo_id
                WHERE gs.exposure_type = ?
            ", array_merge($cte['bindings'], [$theme]));

            $results[$theme] = $rows;
        }

        return $results;
    }

    /**
     * Detail for a single tract.
     */
    public function tractDetail(string $fips): ?array
    {
        $locationType = strlen($fips) <= 5 ? 'county' : 'census_tract';

        $row = DB::connection('gis')->selectOne("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.population,
                gs_overall.avg_value AS svi_overall,
                gs_t1.avg_value AS svi_theme1,
                gs_t2.avg_value AS svi_theme2,
                gs_t3.avg_value AS svi_theme3,
                gs_t4.avg_value AS svi_theme4
            FROM gis.geographic_location gl
            LEFT JOIN gis.geography_summary gs_overall
                ON gs_overall.geographic_location_id = gl.geographic_location_id AND gs_overall.exposure_type = 'svi_overall'
            LEFT JOIN gis.geography_summary gs_t1
                ON gs_t1.geographic_location_id = gl.geographic_location_id AND gs_t1.exposure_type = 'svi_theme1'
            LEFT JOIN gis.geography_summary gs_t2
                ON gs_t2.geographic_location_id = gl.geographic_location_id AND gs_t2.exposure_type = 'svi_theme2'
            LEFT JOIN gis.geography_summary gs_t3
                ON gs_t3.geographic_location_id = gl.geographic_location_id AND gs_t3.exposure_type = 'svi_theme3'
            LEFT JOIN gis.geography_summary gs_t4
                ON gs_t4.geographic_location_id = gl.geographic_location_id AND gs_t4.exposure_type = 'svi_theme4'
            WHERE gl.geographic_code = ? AND gl.location_type = ?
        ", [$fips, $locationType]);

        return $row ? (array) $row : null;
    }
}
