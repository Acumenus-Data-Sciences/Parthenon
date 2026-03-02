<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class QualityMeasure extends Model
{
    protected $table = 'quality_measures';

    protected $fillable = [
        'measure_code',
        'measure_name',
        'description',
        'measure_type',
        'domain',
        'concept_set_id',
        'numerator_criteria',
        'denominator_criteria',
        'exclusion_criteria',
        'frequency',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'numerator_criteria' => 'array',
            'denominator_criteria' => 'array',
            'exclusion_criteria' => 'array',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsToMany<ConditionBundle, $this>
     */
    public function bundles(): BelongsToMany
    {
        return $this->belongsToMany(ConditionBundle::class, 'bundle_measures', 'measure_id', 'bundle_id');
    }

    /**
     * @return BelongsTo<ConceptSet, $this>
     */
    public function conceptSet(): BelongsTo
    {
        return $this->belongsTo(ConceptSet::class, 'concept_set_id');
    }
}
