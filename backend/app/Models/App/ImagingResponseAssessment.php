<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingResponseAssessment extends Model
{
    protected $fillable = [
        'person_id', 'criteria_type', 'assessment_date', 'body_site',
        'baseline_study_id', 'current_study_id',
        'baseline_value', 'nadir_value', 'current_value',
        'percent_change_from_baseline', 'percent_change_from_nadir',
        'response_category', 'rationale',
        'assessed_by', 'is_confirmed',
    ];

    protected function casts(): array
    {
        return [
            'assessment_date' => 'date',
            'baseline_value' => 'float',
            'nadir_value' => 'float',
            'current_value' => 'float',
            'percent_change_from_baseline' => 'float',
            'percent_change_from_nadir' => 'float',
            'is_confirmed' => 'boolean',
            'person_id' => 'integer',
        ];
    }

    /** @return BelongsTo<ImagingStudy, $this> */
    public function baselineStudy(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class, 'baseline_study_id');
    }

    /** @return BelongsTo<ImagingStudy, $this> */
    public function currentStudy(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class, 'current_study_id');
    }
}
