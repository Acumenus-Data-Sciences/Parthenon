<?php

namespace App\Models\Survey;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SurveyAnswerOption extends Model
{
    protected $fillable = [
        'survey_item_id',
        'option_text',
        'option_value',
        'omop_concept_id',
        'loinc_la_code',
        'display_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'option_value' => 'decimal:2',
            'display_order' => 'integer',
            'omop_concept_id' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<SurveyItem, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(SurveyItem::class, 'survey_item_id');
    }
}
