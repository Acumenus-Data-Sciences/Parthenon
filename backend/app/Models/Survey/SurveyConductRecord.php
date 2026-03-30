<?php

namespace App\Models\Survey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SurveyConductRecord extends Model
{
    protected $table = 'survey_conduct';

    protected $fillable = [
        'person_id',
        'survey_instrument_id',
        'campaign_id',
        'survey_concept_id',
        'visit_occurrence_id',
        'survey_start_datetime',
        'survey_end_datetime',
        'respondent_type_concept_id',
        'survey_mode_concept_id',
        'completion_status',
        'total_score',
        'subscale_scores',
        'source_identifier',
        'source_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'subscale_scores' => 'array',
            'total_score' => 'decimal:2',
            'survey_start_datetime' => 'datetime',
            'survey_end_datetime' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<SurveyInstrument, $this>
     */
    public function instrument(): BelongsTo
    {
        return $this->belongsTo(SurveyInstrument::class, 'survey_instrument_id');
    }

    /**
     * @return BelongsTo<SurveyCampaign, $this>
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(SurveyCampaign::class, 'campaign_id');
    }

    /**
     * @return HasMany<SurveyResponse, $this>
     */
    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class, 'survey_conduct_id');
    }

    public function scopeComplete(mixed $query): mixed
    {
        return $query->where('completion_status', 'complete');
    }

    public function scopeForPerson(mixed $query, int $personId): mixed
    {
        return $query->where('person_id', $personId);
    }
}
