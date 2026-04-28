<?php

declare(strict_types=1);

namespace App\Models\Gis;

use Illuminate\Database\Eloquent\Model;

/**
 * gis.geographic_location — census tracts, counties, ZIPs with PostGIS
 * geometry. Phase 19 Plan 02 (Wave 1).
 *
 * Connection: 'gis' (search_path: gis,public,omop,vocab,php). Table is declared
 * unqualified ('geographic_location') per B-07 — rely on the connection's
 * search_path; never use 'gis.geographic_location' or duplicate
 * qualification will break under different schema setups.
 *
 * The 'geometry' GEOGRAPHY(MULTIPOLYGON, 4326) column is intentionally NOT
 * in $fillable — Eloquent cannot serialize PostGIS values, so geometry
 * writes go through raw DB::statement() in loaders (Plan 03).
 */
class GeographicLocation extends Model
{
    protected $connection = 'gis';

    protected $table = 'geographic_location';

    protected $primaryKey = 'geographic_location_id';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'location_name',
        'location_type',
        'geographic_code',
        'state_fips',
        'county_fips',
        'latitude',
        'longitude',
        'population',
        'area_sq_km',
        'parent_location_id',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'population' => 'integer',
        'area_sq_km' => 'float',
        'parent_location_id' => 'integer',
    ];
}
