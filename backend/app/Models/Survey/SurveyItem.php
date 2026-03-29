<?php

namespace App\Models\Survey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SurveyItem extends Model
{
    protected $fillable = [
        'survey_instrument_id',
        'item_number',
        'item_text',
        'response_type',
        'omop_concept_id',
        'loinc_code',
        'subscale_name',
        'is_reverse_coded',
        'min_value',
        'max_value',
        'display_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_reverse_coded' => 'boolean',
            'min_value' => 'decimal:2',
            'max_value' => 'decimal:2',
            'item_number' => 'integer',
            'display_order' => 'integer',
            'omop_concept_id' => 'integer',
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
     * @return HasMany<SurveyAnswerOption, $this>
     */
    public function answerOptions(): HasMany
    {
        return $this->hasMany(SurveyAnswerOption::class)->orderBy('display_order');
    }

    /**
     * @return HasMany<SurveyResponse, $this>
     */
    public function responses(): HasMany
    {
        return $this->hasMany(SurveyResponse::class);
    }
}
