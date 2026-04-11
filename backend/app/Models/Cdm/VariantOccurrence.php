<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VariantOccurrence extends CdmModel
{
    protected $table = 'variant_occurrence';

    protected $primaryKey = 'variant_occurrence_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'variant_occurrence_id' => 'integer',
            'procedure_occurrence_id' => 'integer',
            'specimen_id' => 'integer',
            'variant_occurrence_type_concept_id' => 'integer',
            'reference_allele_concept_id' => 'integer',
            'alternate_allele_concept_id' => 'integer',
            'position' => 'integer',
        ];
    }

    /** @return BelongsTo<ProcedureOccurrence, $this> */
    public function procedureOccurrence(): BelongsTo
    {
        return $this->belongsTo(ProcedureOccurrence::class, 'procedure_occurrence_id');
    }

    /** @return BelongsTo<Specimen, $this> */
    public function specimen(): BelongsTo
    {
        return $this->belongsTo(Specimen::class, 'specimen_id');
    }

    /** @return HasMany<VariantAnnotation, $this> */
    public function annotations(): HasMany
    {
        return $this->hasMany(VariantAnnotation::class, 'variant_occurrence_id');
    }
}
