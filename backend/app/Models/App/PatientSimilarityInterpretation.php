<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientSimilarityInterpretation extends Model
{
    protected $fillable = [
        'user_id',
        'patient_similarity_run_id',
        'patient_similarity_run_step_id',
        'mode',
        'step_id',
        'source_id',
        'target_cohort_id',
        'comparator_cohort_id',
        'result_hash',
        'provider',
        'model',
        'status',
        'summary',
        'interpretation',
        'clinical_implications',
        'methodologic_cautions',
        'recommended_next_steps',
        'confidence',
        'sanitized_result',
        'error',
        'raw_response',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'clinical_implications' => 'array',
            'methodologic_cautions' => 'array',
            'recommended_next_steps' => 'array',
            'sanitized_result' => 'array',
            'confidence' => 'float',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<PatientSimilarityRun, $this>
     */
    public function run(): BelongsTo
    {
        return $this->belongsTo(PatientSimilarityRun::class, 'patient_similarity_run_id');
    }

    /**
     * @return BelongsTo<PatientSimilarityRunStep, $this>
     */
    public function runStep(): BelongsTo
    {
        return $this->belongsTo(PatientSimilarityRunStep::class, 'patient_similarity_run_step_id');
    }

    /**
     * @return array<string, mixed>
     */
    public function toInterpretationPayload(string $cacheStatus = 'hit'): array
    {
        return [
            'id' => $this->id,
            'run_id' => $this->patient_similarity_run_id,
            'run_step_id' => $this->patient_similarity_run_step_id,
            'cache_status' => $cacheStatus,
            'result_hash' => $this->result_hash,
            'status' => $this->status,
            'provider' => $this->provider ?? 'analytics_llm',
            'model' => $this->model ?? 'configured AI provider',
            'mode' => $this->mode,
            'step_id' => $this->step_id,
            'summary' => $this->summary ?? '',
            'interpretation' => $this->interpretation ?? '',
            'clinical_implications' => $this->clinical_implications ?? [],
            'methodologic_cautions' => $this->methodologic_cautions ?? [],
            'recommended_next_steps' => $this->recommended_next_steps ?? [],
            'confidence' => $this->confidence ?? 0.0,
            'error' => $this->error,
            'raw_response' => $this->raw_response,
            'sanitized_result' => $this->sanitized_result ?? [],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
