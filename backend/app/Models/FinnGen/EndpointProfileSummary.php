<?php

declare(strict_types=1);

namespace App\Models\FinnGen;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use InvalidArgumentException;

/**
 * Phase 18 D-09 — one row per (endpoint_name, source_key, expression_hash)
 * in {source}_co2_results.endpoint_profile_summary.
 *
 * Per-source target schema via the ::onSource() factory; direct instantiation
 * does not bind the table — callers MUST use the factory so the
 * SAFE_SOURCE_REGEX allow-list runs before the fully-qualified table name is
 * interpolated (T-18-03 mitigation mirrors Co2SchemaProvisioner's regex gate).
 *
 * T-18-02 mitigation: $fillable whitelist (HIGHSEC §3.1 forbids $guarded=[]).
 *
 * @property string $endpoint_name
 * @property string $source_key
 * @property string $expression_hash
 * @property int $subject_count
 * @property int $death_count
 * @property float|null $median_survival_days
 * @property float|null $age_at_death_mean
 * @property float|null $age_at_death_median
 * @property array<mixed> $age_at_death_bins
 * @property int $universe_size
 * @property int $min_subjects
 * @property bool $source_has_death_data
 * @property bool $source_has_drug_data
 * @property string $run_id
 * @property Carbon $computed_at
 */
class EndpointProfileSummary extends Model
{
    private const SAFE_SOURCE_REGEX = '/^[a-z][a-z0-9_]*$/';

    protected $connection = 'pgsql';

    /**
     * DB composite PK is (endpoint_name, source_key, expression_hash); Eloquent
     * does not model composite keys natively, so we expose expression_hash as
     * the scalar key to stay covariant with Model::$primaryKey. Upserts MUST
     * match on all three columns.
     */
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
        'subject_count',
        'death_count',
        'median_survival_days',
        'age_at_death_mean',
        'age_at_death_median',
        'age_at_death_bins',
        'universe_size',
        'min_subjects',
        'source_has_death_data',
        'source_has_drug_data',
        'run_id',
        'computed_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'subject_count' => 'integer',
        'death_count' => 'integer',
        'median_survival_days' => 'float',
        'age_at_death_mean' => 'float',
        'age_at_death_median' => 'float',
        'age_at_death_bins' => 'array',
        'universe_size' => 'integer',
        'min_subjects' => 'integer',
        'source_has_death_data' => 'boolean',
        'source_has_drug_data' => 'boolean',
        'computed_at' => 'datetime',
    ];

    /**
     * Factory binding the model to {source}_co2_results.endpoint_profile_summary.
     * Applies the same T-18-03 regex allow-list the Co2SchemaProvisioner uses.
     */
    public static function onSource(string $sourceKey): self
    {
        $normalized = strtolower($sourceKey);
        if (preg_match(self::SAFE_SOURCE_REGEX, $normalized) !== 1) {
            throw new InvalidArgumentException(
                "EndpointProfileSummary::onSource — unsafe source_key '{$sourceKey}'."
            );
        }

        $instance = new self;
        $instance->setTable("{$normalized}_co2_results.endpoint_profile_summary");

        return $instance;
    }
}
