<?php

namespace App\Models\App;

use App\Models\Cdm\ImageOccurrence;
use App\Models\Cdm\ProcedureOccurrence;
use App\Models\Cdm\VisitOccurrence;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImagingSeriesOmopXref extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'imaging_series_omop_xref';

    protected $primaryKey = 'series_id';

    public $incrementing = false;

    protected $fillable = [
        'series_id',
        'image_occurrence_id',
        'procedure_occurrence_id',
        'visit_occurrence_id',
        'modality_concept_id',
        'anatomic_site_concept_id',
        'backfill_run_id',
        'mapping_status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'series_id' => 'integer',
            'image_occurrence_id' => 'integer',
            'procedure_occurrence_id' => 'integer',
            'visit_occurrence_id' => 'integer',
            'modality_concept_id' => 'integer',
            'anatomic_site_concept_id' => 'integer',
            'backfill_run_id' => 'integer',
        ];
    }

    /** @return BelongsTo<ImagingSeries, $this> */
    public function series(): BelongsTo
    {
        return $this->belongsTo(ImagingSeries::class, 'series_id');
    }

    /** @return BelongsTo<ImageOccurrence, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function imageOccurrence(): BelongsTo
    {
        return $this->belongsTo(ImageOccurrence::class, 'image_occurrence_id');
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
