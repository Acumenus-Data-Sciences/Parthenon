<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VariantAnnotation extends CdmModel
{
    protected $table = 'variant_annotation';

    protected $primaryKey = 'variant_annotation_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'variant_annotation_id' => 'integer',
            'variant_occurrence_id' => 'integer',
            'annotation_concept_id' => 'integer',
        ];
    }

    /** @return BelongsTo<VariantOccurrence, $this> */
    public function variantOccurrence(): BelongsTo
    {
        return $this->belongsTo(VariantOccurrence::class, 'variant_occurrence_id');
    }
}
