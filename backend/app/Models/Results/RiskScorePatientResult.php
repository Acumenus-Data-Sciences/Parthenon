<?php

namespace App\Models\Results;

use App\Models\App\AnalysisExecution;
use App\Models\App\Source;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskScorePatientResult extends Model
{
    public $timestamps = false;

    protected $table = 'risk_score_patient_results';

    protected $fillable = [
        'execution_id',
        'source_id',
        'cohort_definition_id',
        'person_id',
        'score_id',
        'score_value',
        'risk_tier',
        'confidence',
        'completeness',
        'missing_components',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score_value' => 'float',
            'confidence' => 'float',
            'completeness' => 'float',
            'missing_components' => 'array',
        ];
    }

    /**
     * @return BelongsTo<AnalysisExecution, $this>
     */
    public function execution(): BelongsTo
    {
        return $this->belongsTo(AnalysisExecution::class, 'execution_id');
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
