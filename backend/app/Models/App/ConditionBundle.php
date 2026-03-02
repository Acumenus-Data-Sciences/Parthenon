<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ConditionBundle extends Model
{
    use SoftDeletes;

    protected $table = 'condition_bundles';

    protected $fillable = [
        'bundle_code',
        'condition_name',
        'description',
        'icd10_patterns',
        'omop_concept_ids',
        'bundle_size',
        'ecqm_references',
        'disease_category',
        'author_id',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'icd10_patterns' => 'array',
            'omop_concept_ids' => 'array',
            'ecqm_references' => 'array',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsToMany<QualityMeasure, $this>
     */
    public function measures(): BelongsToMany
    {
        return $this->belongsToMany(QualityMeasure::class, 'bundle_measures', 'bundle_id', 'measure_id')
            ->withPivot('ordinal')
            ->orderBy('bundle_measures.ordinal');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @return HasMany<CareGapEvaluation, $this>
     */
    public function evaluations(): HasMany
    {
        return $this->hasMany(CareGapEvaluation::class, 'bundle_id');
    }

    /**
     * Get overlap rules applicable to this bundle.
     *
     * @return \Illuminate\Database\Eloquent\Collection<int, BundleOverlapRule>
     */
    public function getOverlapRulesAttribute(): \Illuminate\Database\Eloquent\Collection
    {
        return BundleOverlapRule::where('is_active', true)
            ->get()
            ->filter(function (BundleOverlapRule $rule) {
                $codes = $rule->applicable_bundle_codes ?? [];

                return in_array($this->bundle_code, $codes, true);
            })
            ->values();
    }
}
