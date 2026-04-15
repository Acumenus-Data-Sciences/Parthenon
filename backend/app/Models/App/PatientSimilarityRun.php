<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PatientSimilarityRun extends Model
{
    protected $fillable = [
        'user_id',
        'mode',
        'name',
        'source_id',
        'target_cohort_id',
        'comparator_cohort_id',
        'similarity_mode',
        'settings_json',
        'status',
        'last_opened_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'settings_json' => 'array',
            'last_opened_at' => 'datetime',
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
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function targetCohort(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class, 'target_cohort_id');
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function comparatorCohort(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class, 'comparator_cohort_id');
    }

    /**
     * @return HasMany<PatientSimilarityRunStep, $this>
     */
    public function steps(): HasMany
    {
        return $this->hasMany(PatientSimilarityRunStep::class);
    }

    /**
     * @return HasMany<PatientSimilarityInterpretation, $this>
     */
    public function interpretations(): HasMany
    {
        return $this->hasMany(PatientSimilarityInterpretation::class);
    }
}
