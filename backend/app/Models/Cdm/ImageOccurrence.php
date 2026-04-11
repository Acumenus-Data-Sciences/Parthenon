<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImageOccurrence extends CdmModel
{
    protected $table = 'image_occurrence';

    protected $primaryKey = 'image_occurrence_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'image_occurrence_id' => 'integer',
            'person_id' => 'integer',
            'procedure_occurrence_id' => 'integer',
            'visit_occurrence_id' => 'integer',
            'image_occurrence_date' => 'date',
            'image_occurrence_datetime' => 'datetime',
            'modality_concept_id' => 'integer',
            'anatomic_site_concept_id' => 'integer',
            'image_type_concept_id' => 'integer',
        ];
    }

    /** @return BelongsTo<Person, $this> */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }

    /** @return BelongsTo<ProcedureOccurrence, $this> */
    public function procedureOccurrence(): BelongsTo
    {
        return $this->belongsTo(ProcedureOccurrence::class, 'procedure_occurrence_id');
    }

    /** @return BelongsTo<VisitOccurrence, $this> */
    public function visitOccurrence(): BelongsTo
    {
        return $this->belongsTo(VisitOccurrence::class, 'visit_occurrence_id');
    }
}
