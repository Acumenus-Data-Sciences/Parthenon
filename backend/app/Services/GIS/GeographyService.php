<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class GeographyService
{
    /**
     * List all PA counties with geometry as GeoJSON.
     */
    public function counties(): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gl.population,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geographic_location gl
            WHERE gl.location_type = 'county'
              AND gl.state_fips = '42'
            ORDER BY gl.location_name
        ");
    }

    /**
     * List tracts within a county, with geometry.
     */
    public function tractsByCounty(string $countyFips): array
    {
        return DB::connection('gis')->select("
            SELECT
                gl.geographic_location_id,
                gl.location_name,
                gl.geographic_code AS fips,
                gl.latitude,
                gl.longitude,
                gl.population,
                ST_AsGeoJSON(gl.geometry)::json AS geometry
            FROM gis.geographic_location gl
            WHERE gl.location_type = 'census_tract'
              AND gl.county_fips = ?
            ORDER BY gl.geographic_code
        ", [$countyFips]);
    }

    /**
     * Return available layer metadata.
     */
    public function layers(): array
    {
        return [
            [
                'id' => 'svi',
                'name' => 'Social Vulnerability Index',
                'description' => 'CDC/ATSDR SVI by census tract — 4 themes + overall',
                'color' => '#E85A6B',
                'available' => $this->hasExposureData('svi_overall'),
            ],
            [
                'id' => 'rucc',
                'name' => 'Urban-Rural Classification',
                'description' => 'USDA Rural-Urban Continuum Codes by county',
                'color' => '#8B5CF6',
                'available' => $this->hasExposureData('rucc'),
            ],
            [
                'id' => 'comorbidity',
                'name' => 'Comorbidity Clustering',
                'description' => 'Geographic comorbidity burden (DM, HTN, obesity)',
                'color' => '#F59E0B',
                'available' => $this->hasExposureData('comorbidity_burden'),
            ],
            [
                'id' => 'air-quality',
                'name' => 'Air Quality',
                'description' => 'EPA PM2.5 and ozone vs respiratory outcomes',
                'color' => '#10B981',
                'available' => $this->hasExposureData('pm25'),
            ],
            [
                'id' => 'hospital-access',
                'name' => 'Hospital Access',
                'description' => 'CMS hospital proximity and healthcare deserts',
                'color' => '#3B82F6',
                'available' => $this->hasHospitalData(),
            ],
        ];
    }

    private function hasExposureData(string $exposureType): bool
    {
        $row = DB::connection('gis')->selectOne(
            "SELECT EXISTS(SELECT 1 FROM gis.external_exposure WHERE exposure_type = ? LIMIT 1) AS has_data",
            [$exposureType]
        );
        return $row->has_data ?? false;
    }

    private function hasHospitalData(): bool
    {
        $row = DB::connection('gis')->selectOne(
            "SELECT EXISTS(SELECT 1 FROM gis.gis_hospital LIMIT 1) AS has_data"
        );
        return $row->has_data ?? false;
    }
}
