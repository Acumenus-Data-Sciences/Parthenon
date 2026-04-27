<?php

declare(strict_types=1);

namespace App\Models\Gis;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * gis.external_exposure — person-level geographic/environmental exposures
 * (e.g., urban_pct, rucc, svi_overall). Phase 19 Plan 02 (Wave 1).
 *
 * D-01: source_id BIGINT NOT NULL REFERENCES app.sources(id) plus UNIQUE
 *   (source_id, person_id, exposure_type, exposure_date) eliminates the
 *   omop.person_id=1 ↔ irsf.person_id=1 collision risk and enables ON
 *   CONFLICT UPSERT idempotency in Plan 03 loaders (D-05).
 *
 * Connection 'gis' has search_path 'gis,omop,vocab,php' — it does NOT
 * include 'app'. The source() relation MUST therefore call
 * setConnection('pgsql') to find app.sources via the default connection
 * (B-06: cross-connection bridge).
 */
class ExternalExposure extends Model
{
    protected $connection = 'gis';

    protected $table = 'external_exposure';

    protected $primaryKey = 'external_exposure_id';

    /** @var list<string> */
    protected $fillable = [
        'source_id',
        'person_id',
        'exposure_type',
        'exposure_date',
        'value_as_number',
        'value_as_string',
        'value_as_integer',
        'unit',
        'geographic_location_id',
        'source_dataset',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'source_id' => 'integer',
        'person_id' => 'integer',
        'exposure_date' => 'date',
        'value_as_number' => 'float',
        'value_as_integer' => 'integer',
        'geographic_location_id' => 'integer',
    ];

    /**
     * BelongsTo app.sources (cross-connection).
     *
     * The 'gis' connection's search_path lacks 'app', so a naive
     * belongsTo(Source::class) would emit
     *   SELECT ... FROM sources WHERE id = ?
     * against the gis connection and resolve sources to the wrong schema
     * (or fail with relation-does-not-exist). The fix forces the related
     * Source model onto the 'pgsql' connection (which has app in
     * search_path) BEFORE the relation builds its query, so the lookup
     * goes through the correct connection.
     *
     * Note: BelongsTo itself has no setConnection() method (PHPStan
     * level 8 catches that). Setting the connection on the underlying
     * query builder is the supported pattern (see
     * Illuminate\Database\Eloquent\Relations\Relation::getQuery() →
     * Illuminate\Database\Eloquent\Builder::getQuery() →
     * Illuminate\Database\Query\Builder::useWritePdo etc.) — but the
     * cleanest approach is to instantiate the related model with the
     * connection already set and build the BelongsTo manually via the
     * standard Eloquent factory.
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
     * BelongsTo gis.geographic_location (intra-connection — same gis
     * connection, no setConnection() needed).
     *
     * @return BelongsTo<GeographicLocation, $this>
     */
    public function geographicLocation(): BelongsTo
    {
        return $this->belongsTo(GeographicLocation::class, 'geographic_location_id', 'geographic_location_id');
    }
}
