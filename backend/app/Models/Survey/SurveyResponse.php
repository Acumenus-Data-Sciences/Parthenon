<?php

namespace App\Models\Survey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyResponse extends Model
{
    protected $fillable = [
        'survey_conduct_id',
        'survey_item_id',
        'observation_id',
        'value_as_number',
        'value_as_concept_id',
        'value_as_string',
        'response_datetime',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'value_as_number' => 'decimal:4',
            'response_datetime' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<SurveyConductRecord, $this>
     */
    public function conductRecord(): BelongsTo
    {
        return $this->belongsTo(SurveyConductRecord::class, 'survey_conduct_id');
    }

    /**
     * @return BelongsTo<SurveyItem, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(SurveyItem::class, 'survey_item_id');
    }
}
