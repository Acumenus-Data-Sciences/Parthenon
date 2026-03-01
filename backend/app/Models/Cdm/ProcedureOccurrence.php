<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProcedureOccurrence extends CdmModel
{
    protected $table = 'procedure_occurrence';

    protected $primaryKey = 'procedure_occurrence_id';

    public $incrementing = false;

    /**
     * @return BelongsTo<Person, $this>
     */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'person_id');
    }

    /**
     * @return BelongsTo<VisitOccurrence, $this>
     */
    public function visitOccurrence(): BelongsTo
    {
        return $this->belongsTo(VisitOccurrence::class, 'visit_occurrence_id');
    }
}
