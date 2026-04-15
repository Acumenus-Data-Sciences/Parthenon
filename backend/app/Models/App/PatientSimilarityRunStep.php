<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PatientSimilarityRunStep extends Model
{
    protected $fillable = [
        'patient_similarity_run_id',
        'step_id',
        'status',
        'summary',
        'result_json',
        'result_hash',
        'execution_time_ms',
        'completed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'result_json' => 'array',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<PatientSimilarityRun, $this>
     */
    public function run(): BelongsTo
    {
        return $this->belongsTo(PatientSimilarityRun::class, 'patient_similarity_run_id');
    }

    /**
     * @return HasMany<PatientSimilarityInterpretation, $this>
     */
    public function interpretations(): HasMany
    {
        return $this->hasMany(PatientSimilarityInterpretation::class);
    }
}
