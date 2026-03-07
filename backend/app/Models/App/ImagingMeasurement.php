<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingMeasurement extends Model
{
    protected $fillable = [
        'study_id', 'person_id', 'series_id',
        'measurement_type', 'measurement_name', 'value_as_number',
        'unit', 'body_site', 'laterality',
        'algorithm_name', 'confidence', 'created_by',
        'measured_at', 'is_target_lesion', 'target_lesion_number',
    ];

    protected function casts(): array
    {
        return [
            'value_as_number' => 'float',
            'confidence' => 'float',
            'measured_at' => 'date',
            'is_target_lesion' => 'boolean',
            'target_lesion_number' => 'integer',
            'person_id' => 'integer',
        ];
    }

    /** @return BelongsTo<ImagingStudy, $this> */
    public function study(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class, 'study_id');
    }

    /** @return BelongsTo<ImagingSeries, $this> */
    public function series(): BelongsTo
    {
        return $this->belongsTo(ImagingSeries::class, 'series_id');
    }
}
