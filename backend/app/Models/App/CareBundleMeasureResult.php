<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareBundleMeasureResult extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'care_bundle_run_id',
        'quality_measure_id',
        'denominator_count',
        'numerator_count',
        'exclusion_count',
        'rate',
        'denominator_cohort_definition_id',
        'numerator_cohort_definition_id',
        'computed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'denominator_count' => 'integer',
            'numerator_count' => 'integer',
            'exclusion_count' => 'integer',
            'rate' => 'decimal:4',
            'computed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<CareBundleRun, $this>
     */
    public function run(): BelongsTo
    {
        return $this->belongsTo(CareBundleRun::class, 'care_bundle_run_id');
    }

    /**
     * @return BelongsTo<QualityMeasure, $this>
     */
    public function measure(): BelongsTo
    {
        return $this->belongsTo(QualityMeasure::class, 'quality_measure_id');
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function denominatorCohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class, 'denominator_cohort_definition_id');
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function numeratorCohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class, 'numerator_cohort_definition_id');
    }
}
