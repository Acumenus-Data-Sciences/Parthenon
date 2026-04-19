<?php

declare(strict_types=1);

namespace App\Models\FinnGen;

use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Phase 18 D-09 — one row per (index_endpoint, comorbid_endpoint) pair in
 * {source}_co2_results.endpoint_profile_comorbidities.
 *
 * Ranking metric = phi-coefficient on the 2×2 contingency (D-04); OR + 95% CI
 * surfaced in the cell tooltip. Universe = FinnGen endpoints with ≥ 20
 * subjects materialized in the target source (D-05). Rank is 1-indexed within
 * (index_endpoint, source_key) — top-50 shown in the Plan 18-06
 * ComorbidityMatrixPanel (D-07).
 *
 * Mirrors EndpointProfileSummary: per-source schema via ::onSource(),
 * regex-guarded, $fillable whitelist, timestamps disabled.
 *
 * @property string $index_endpoint
 * @property string $source_key
 * @property string $expression_hash
 * @property string $comorbid_endpoint
 * @property float $phi_coef
 * @property float $odds_ratio
 * @property float|null $or_ci_low
 * @property float|null $or_ci_high
 * @property int $co_count
 * @property int $rank
 */
class EndpointProfileComorbidity extends Model
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
        'index_endpoint',
        'source_key',
        'expression_hash',
        'comorbid_endpoint',
        'phi_coef',
        'odds_ratio',
        'or_ci_low',
        'or_ci_high',
        'co_count',
        'rank',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'phi_coef' => 'float',
        'odds_ratio' => 'float',
        'or_ci_low' => 'float',
        'or_ci_high' => 'float',
        'co_count' => 'integer',
        'rank' => 'integer',
    ];

    public static function onSource(string $sourceKey): self
    {
        $normalized = strtolower($sourceKey);
        if (preg_match(self::SAFE_SOURCE_REGEX, $normalized) !== 1) {
            throw new InvalidArgumentException(
                "EndpointProfileComorbidity::onSource — unsafe source_key '{$sourceKey}'."
            );
        }

        $instance = new self;
        $instance->setTable("{$normalized}_co2_results.endpoint_profile_comorbidities");

        return $instance;
    }
}
