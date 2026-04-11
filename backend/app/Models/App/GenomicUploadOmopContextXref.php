<?php

namespace App\Models\App;

use App\Models\Cdm\CareSite;
use App\Models\Cdm\GenomicTest;
use App\Models\Cdm\ProcedureOccurrence;
use App\Models\Cdm\Specimen;
use App\Models\Cdm\VisitOccurrence;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenomicUploadOmopContextXref extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'genomic_upload_omop_context_xref';

    protected $primaryKey = 'upload_id';

    public $incrementing = false;

    protected $fillable = [
        'upload_id',
        'source_id',
        'person_id',
        'sample_id',
        'procedure_occurrence_id',
        'visit_occurrence_id',
        'care_site_id',
        'specimen_id',
        'genomic_test_id',
        'source_strategy',
        'mapping_status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'upload_id' => 'integer',
            'source_id' => 'integer',
            'person_id' => 'integer',
            'procedure_occurrence_id' => 'integer',
            'visit_occurrence_id' => 'integer',
            'care_site_id' => 'integer',
            'specimen_id' => 'integer',
            'genomic_test_id' => 'integer',
        ];
    }

    /** @return BelongsTo<GenomicUpload, $this> */
    public function upload(): BelongsTo
    {
        return $this->belongsTo(GenomicUpload::class, 'upload_id');
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

    /** @return BelongsTo<CareSite, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function careSite(): BelongsTo
    {
        return $this->belongsTo(CareSite::class, 'care_site_id');
    }

    /** @return BelongsTo<Specimen, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function specimen(): BelongsTo
    {
        return $this->belongsTo(Specimen::class, 'specimen_id');
    }

    /** @return BelongsTo<GenomicTest, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function genomicTest(): BelongsTo
    {
        return $this->belongsTo(GenomicTest::class, 'genomic_test_id');
    }
}
