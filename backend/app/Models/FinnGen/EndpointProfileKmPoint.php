<?php

declare(strict_types=1);

namespace App\Models\FinnGen;

use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Phase 18 D-09 — KM step-function points for an endpoint × source profile.
 *
 * One row per discrete time_days step; PRIMARY KEY is the 4-tuple
 * (endpoint_name, source_key, expression_hash, time_days). Reads by the
 * Plan 18-06 SurvivalPanel via the useEndpointProfileKmData adapter hook
 * (D-13) and written by the Plan 18-05 R worker (survival::survfit).
 *
 * Mirrors EndpointProfileSummary: per-source schema via ::onSource(),
 * regex-guarded, $fillable whitelist, timestamps disabled.
 *
 * @property string $endpoint_name
 * @property string $source_key
 * @property string $expression_hash
 * @property float $time_days
 * @property float $survival_prob
 * @property int $at_risk
 * @property int $events
 */
class EndpointProfileKmPoint extends Model
{
    private const SAFE_SOURCE_REGEX = '/^[a-z][a-z0-9_]*$/';

    protected $connection = 'pgsql';

    protected $primaryKey = 'expression_hash';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    /**
     * Mass-assignment whitelist (T-18-02 / HIGHSEC §3.1).
     *
     * @var list<string>
     */
    protected $fillable = [
        'endpoint_name',
        'source_key',
        'expression_hash',
        'time_days',
        'survival_prob',
        'at_risk',
        'events',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'time_days' => 'float',
        'survival_prob' => 'float',
        'at_risk' => 'integer',
        'events' => 'integer',
    ];

    public static function onSource(string $sourceKey): self
    {
        $normalized = strtolower($sourceKey);
        if (preg_match(self::SAFE_SOURCE_REGEX, $normalized) !== 1) {
            throw new InvalidArgumentException(
                "EndpointProfileKmPoint::onSource — unsafe source_key '{$sourceKey}'."
            );
        }

        $instance = new self;
        $instance->setTable("{$normalized}_co2_results.endpoint_profile_km_points");

        return $instance;
    }
}
