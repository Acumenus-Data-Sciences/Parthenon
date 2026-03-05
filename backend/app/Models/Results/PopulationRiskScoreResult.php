<?php

namespace App\Models\Results;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PopulationRiskScoreResult extends Model
{
    protected $fillable = [
        'source_id',
        'score_id',
        'score_name',
        'category',
        'risk_tier',
        'patient_count',
        'total_eligible',
        'mean_score',
        'p25_score',
        'median_score',
        'p75_score',
        'mean_confidence',
        'mean_completeness',
        'missing_components',
        'run_at',
    ];

    protected $casts = [
        'patient_count' => 'integer',
        'total_eligible' => 'integer',
        'mean_score' => 'decimal:4',
        'p25_score' => 'decimal:4',
        'median_score' => 'decimal:4',
        'p75_score' => 'decimal:4',
        'mean_confidence' => 'decimal:4',
        'mean_completeness' => 'decimal:4',
        'run_at' => 'datetime',
    ];

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * Decode missing_components JSON string to array.
     */
    public function getMissingComponentsDecodedAttribute(): array
    {
        return json_decode($this->missing_components ?? '{}', true) ?? [];
    }
}
