<?php

declare(strict_types=1);

namespace App\Models\FinnGen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Phase 18 D-11 — access-log row for endpoint profile drawer opens.
 *
 * Composite PK: (endpoint_name, source_key). Upserted on every drawer
 * open that lands on the Profile tab by the TrackEndpointProfileAccess
 * middleware (Plan 18-04). Read by WarmEndpointProfilesCommand (Plan 18-07)
 * to select stale (endpoint × source) pairs for the nightly warm.
 *
 * Contains no PII / PHI — only the endpoint name and source key. Safe under
 * HIGHSEC §8.
 *
 * T-18-02 mitigation: mass-assignment controlled by the $fillable whitelist
 * below; the anti-pattern of wide-open guarded arrays is forbidden by
 * HIGHSEC §3.1.
 *
 * Lives on the `finngen` connection so it routes to the finngen schema
 * under the same search_path the rest of Phase 13.1+ uses.
 *
 * @property string $endpoint_name FinnGen endpoint name (e.g. E4_DM2)
 * @property string $source_key Source CDM key (e.g. PANCREAS)
 * @property Carbon $last_accessed_at
 * @property int $access_count
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class EndpointProfileAccess extends Model
{
    protected $connection = 'finngen';

    protected $table = 'endpoint_profile_access';

    /**
     * Natural composite PK in the database is (endpoint_name, source_key),
     * enforced by the underlying finngen.endpoint_profile_access PRIMARY KEY
     * constraint. Eloquent does not model composite keys natively, so we
     * expose `endpoint_name` as the scalar key to stay covariant with
     * Model::$primaryKey. Upserts MUST pass both columns as match criteria
     * — see TrackEndpointProfileAccess middleware (Plan 18-04).
     */
    protected $primaryKey = 'endpoint_name';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * Mass-assignment whitelist (HIGHSEC §3.1, T-18-02 mitigation).
     *
     * @var list<string>
     */
    protected $fillable = [
        'endpoint_name',
        'source_key',
        'last_accessed_at',
        'access_count',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'last_accessed_at' => 'datetime',
        'access_count' => 'integer',
    ];
}
