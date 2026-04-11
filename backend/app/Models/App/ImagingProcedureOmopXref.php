<?php

namespace App\Models\App;

use App\Models\Cdm\ProcedureOccurrence;
use App\Models\Cdm\VisitOccurrence;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingProcedureOmopXref extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'imaging_procedure_omop_xref';

    protected $primaryKey = 'procedure_occurrence_id';

    public $incrementing = false;

    protected $fillable = [
        'study_id',
        'modality',
        'procedure_occurrence_id',
        'procedure_concept_id',
        'procedure_type_concept_id',
        'source_strategy',
        'source_procedure_occurrence_id',
        'visit_occurrence_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'study_id' => 'integer',
            'procedure_occurrence_id' => 'integer',
            'procedure_concept_id' => 'integer',
            'procedure_type_concept_id' => 'integer',
            'source_procedure_occurrence_id' => 'integer',
            'visit_occurrence_id' => 'integer',
        ];
    }

    /** @return BelongsTo<ImagingStudy, $this> */
    public function study(): BelongsTo
    {
        return $this->belongsTo(ImagingStudy::class, 'study_id');
    }

    /** @return BelongsTo<ProcedureOccurrence, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function procedureOccurrence(): BelongsTo
    {
        return $this->belongsTo(ProcedureOccurrence::class, 'procedure_occurrence_id');
    }

    /** @return BelongsTo<VisitOccurrence, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function visitOccurrence(): BelongsTo
    {
        return $this->belongsTo(VisitOccurrence::class, 'visit_occurrence_id');
    }
}
