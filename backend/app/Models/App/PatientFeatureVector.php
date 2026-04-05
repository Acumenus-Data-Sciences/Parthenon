<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientFeatureVector extends Model
{
    public $timestamps = false;

    protected $table = 'patient_feature_vectors';

    protected $fillable = [
        'source_id',
        'person_id',
        'age_bucket',
        'gender_concept_id',
        'race_concept_id',
        'anchor_date',
        'condition_concepts',
        'recent_condition_concepts',
        'condition_count',
        'lab_vector',
        'lab_count',
        'drug_concepts',
        'recent_drug_concepts',
        'procedure_concepts',
        'recent_procedure_concepts',
        'variant_genes',
        'variant_count',
        'dimensions_available',
        'computed_at',
        'version',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'condition_concepts' => 'array',
            'recent_condition_concepts' => 'array',
            'lab_vector' => 'array',
            'drug_concepts' => 'array',
            'recent_drug_concepts' => 'array',
            'procedure_concepts' => 'array',
            'recent_procedure_concepts' => 'array',
            'variant_genes' => 'array',
            'dimensions_available' => 'array',
            'anchor_date' => 'date',
            'computed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @param  Builder<PatientFeatureVector>  $query
     */
    public function scopeForSource(Builder $query, int $sourceId): void
    {
        $query->where('source_id', $sourceId);
    }

    public function hasDimension(string $key): bool
    {
        return in_array($key, $this->dimensions_available ?? [], true);
    }
}
