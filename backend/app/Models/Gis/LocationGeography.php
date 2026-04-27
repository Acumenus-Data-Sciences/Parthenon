<?php

declare(strict_types=1);

namespace App\Models\Gis;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * gis.location_geography — per-source ZIP→tract→county crosswalk derived
 * from HUD USPS-Tract crosswalk + omop.location.zip joins. Phase 19 Plan
 * 02 (Wave 1).
 *
 * Per-source isolation: includes source_id BIGINT NOT NULL FK to
 * app.sources(id) plus UNIQUE(source_id, location_id, tract_fips). The
 * underlying location_id is per-source (omop.location.location_id and
 * irsf.location.location_id reuse 1..N), so source_id is required to
 * disambiguate.
 */
class LocationGeography extends Model
{
    protected $connection = 'gis';

    protected $table = 'location_geography';

    protected $primaryKey = 'id';

    public $timestamps = false;

    /** @var list<string> */
    protected $fillable = [
        'source_id',
        'location_id',
        'zip_code',
        'tract_fips',
        'county_fips',
        'tract_allocation_ratio',
        'tract_location_id',
        'county_location_id',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'source_id' => 'integer',
        'location_id' => 'integer',
        'tract_allocation_ratio' => 'float',
        'tract_location_id' => 'integer',
        'county_location_id' => 'integer',
    ];

    /**
     * BelongsTo app.sources (cross-connection).
     *
     * The 'gis' connection's search_path lacks 'app', so the related
     * Source model is forced onto the 'pgsql' connection before the
     * BelongsTo relation builds its query. See ExternalExposure::source()
     * for the full rationale (B-06).
     *
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        $instance = (new Source)->setConnection('pgsql');

        return $this->newBelongsTo(
            $instance->newQuery(),
            $this,
            'source_id',
            $instance->getKeyName(),
            'source',
        );
    }

    /**
     * BelongsTo gis.geographic_location for the resolved tract row.
     *
     * @return BelongsTo<GeographicLocation, $this>
     */
    public function tractLocation(): BelongsTo
    {
        return $this->belongsTo(GeographicLocation::class, 'tract_location_id', 'geographic_location_id');
    }

    /**
     * BelongsTo gis.geographic_location for the resolved county row.
     *
     * @return BelongsTo<GeographicLocation, $this>
     */
    public function countyLocation(): BelongsTo
    {
        return $this->belongsTo(GeographicLocation::class, 'county_location_id', 'geographic_location_id');
    }
}
