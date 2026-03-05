<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingFeature extends Model
{
    protected $fillable = [
        'study_id', 'source_id', 'person_id', 'feature_type', 'algorithm_name',
        'algorithm_version', 'feature_name', 'feature_source_value',
        'value_as_number', 'value_as_string', 'value_concept_id', 'unit_source_value',
        'confidence', 'body_site', 'image_feature_id',
    ];

    protected function casts(): array
    {
        return [
            'value_as_number' => 'float',
            'value_concept_id' => 'integer',
            'confidence' => 'float',
            'image_feature_id' => 'integer',
            'person_id' => 'integer',
        ];
    }

    /** @return BelongsTo<ImagingStudy, $this> */
    public function study(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class, 'study_id');
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
