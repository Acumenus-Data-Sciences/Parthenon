<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImageFeature extends CdmModel
{
    protected $table = 'image_feature';

    protected $primaryKey = 'image_feature_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'image_feature_id' => 'integer',
            'image_occurrence_id' => 'integer',
            'image_feature_concept_id' => 'integer',
            'value_as_number' => 'float',
            'unit_concept_id' => 'integer',
        ];
    }

    /** @return BelongsTo<ImageOccurrence, $this> */
    public function imageOccurrence(): BelongsTo
    {
        return $this->belongsTo(ImageOccurrence::class, 'image_occurrence_id');
    }
}
