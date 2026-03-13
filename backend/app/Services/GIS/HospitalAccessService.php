<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class HospitalAccessService
{
    public function __construct(
        private readonly GisCovidCohortService $cohortService
    ) {}

    /**
     * All hospitals with coordinates for map markers.
     */
    public function mapData(): array
    {
        return DB::connection('gis')->select("
            SELECT
                h.hospital_id,
                h.cms_provider_id,
                h.hospital_name,
                h.city,
                h.county_fips,
                h.latitude,
                h.longitude,
                h.hospital_type,
                h.has_emergency,
                h.bed_count
            FROM gis.gis_hospital h
            ORDER BY h.bed_count DESC
        ");
    }

    /**
     * Access analysis: COVID outcomes by distance bin.
     */
    public function accessAnalysis(int $conceptId, string $metric = 'cases'): array
    {
        $cteTable = $this->cohortService->cteTableForMetric($metric);
        $cte = $this->cohortService->allCtes($conceptId);

        return DB::connection('gis')->select("
            {$cte['sql']},
            distance_bins AS (
                SELECT
                    pg.person_id,
                    ee.value_as_number AS distance_km,
                    CASE
                        WHEN ee.value_as_number < 15 THEN '0-15 km'
                        WHEN ee.value_as_number < 30 THEN '15-30 km'
                        WHEN ee.value_as_number < 60 THEN '30-60 km'
                        WHEN ee.value_as_number < 100 THEN '60-100 km'
                        ELSE '100+ km'
                    END AS distance_bin,
                    CASE
                        WHEN ee.value_as_number < 15 THEN 1
                        WHEN ee.value_as_number < 30 THEN 2
                        WHEN ee.value_as_number < 60 THEN 3
                        WHEN ee.value_as_number < 100 THEN 4
                        ELSE 5
                    END AS bin_order
                FROM gis.patient_geography pg
                JOIN gis.external_exposure ee ON pg.person_id = ee.person_id
                WHERE ee.exposure_type = 'hospital_distance'
            )
            SELECT
                db.distance_bin,
                db.bin_order,
                COUNT(DISTINCT db.person_id) AS total_patients,
                COUNT(DISTINCT ct.person_id) AS outcome_count,
                ROUND(COUNT(DISTINCT ct.person_id)::numeric / NULLIF(COUNT(DISTINCT db.person_id), 0) * 100, 2) AS rate
            FROM distance_bins db
            LEFT JOIN {$cteTable} ct ON db.person_id = ct.person_id
            GROUP BY db.distance_bin, db.bin_order
            ORDER BY db.bin_order
        ", $cte['bindings']);
    }

    /**
     * Healthcare deserts: counties >60km average distance from hospital.
     */
    public function deserts(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gs.avg_value AS avg_distance_km,
                gs.patient_count,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geography_summary gs
            JOIN gis.geographic_location gl ON gs.geographic_location_id = gl.geographic_location_id
            WHERE gs.exposure_type = 'hospital_distance'
              AND gl.location_type = 'county'
              AND gs.avg_value > 60
            ORDER BY gs.avg_value DESC
        ");
    }
}
