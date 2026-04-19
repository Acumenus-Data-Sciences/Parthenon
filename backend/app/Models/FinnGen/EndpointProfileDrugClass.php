<?php

declare(strict_types=1);

namespace App\Models\FinnGen;

use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;

/**
 * Phase 18 D-09 / D-14 — one row per ATC3 class in the 90-day pre-index
 * window for an endpoint × source profile, stored in
 * {source}_co2_results.endpoint_profile_drug_classes.
 *
 * Top-10 classes by `pct_on_drug` rendered in the Plan 18-06 DrugClassesPanel.
 * Denominator = subjects with ≥1 drug_exposure row in the 90d pre-index
 * window (D-14 — zero-drug-exposure subjects are excluded from the
 * denominator so the % stays interpretable).
 *
 * Mirrors EndpointProfileSummary: per-source schema via ::onSource(),
 * regex-guarded, $fillable whitelist, timestamps disabled.
 *
 * @property string $endpoint_name
 * @property string $source_key
 * @property string $expression_hash
 * @property string $atc3_code
 * @property string|null $atc3_name
 * @property int $subjects_on_drug
 * @property int $subjects_total
 * @property float $pct_on_drug
 * @property int $rank
 */
class EndpointProfileDrugClass extends Model
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
        'atc3_code',
        'atc3_name',
        'subjects_on_drug',
        'subjects_total',
        'pct_on_drug',
        'rank',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'subjects_on_drug' => 'integer',
        'subjects_total' => 'integer',
        'pct_on_drug' => 'float',
        'rank' => 'integer',
    ];

    public static function onSource(string $sourceKey): self
    {
        $normalized = strtolower($sourceKey);
        if (preg_match(self::SAFE_SOURCE_REGEX, $normalized) !== 1) {
            throw new InvalidArgumentException(
                "EndpointProfileDrugClass::onSource — unsafe source_key '{$sourceKey}'."
            );
        }

        $instance = new self;
        $instance->setTable("{$normalized}_co2_results.endpoint_profile_drug_classes");

        return $instance;
    }
}
