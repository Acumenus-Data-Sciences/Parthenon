<?php

namespace App\Models\App;

use App\Models\Cdm\ProcedureOccurrence;
use App\Models\Cdm\Specimen;
use App\Models\Cdm\VariantOccurrence;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenomicVariantOmopXref extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'genomic_variant_omop_xref';

    protected $primaryKey = 'variant_id';

    public $incrementing = false;

    protected $fillable = [
        'variant_id',
        'variant_occurrence_id',
        'procedure_occurrence_id',
        'specimen_id',
        'reference_specimen_id',
        'target_gene1_id',
        'target_gene1_symbol',
        'target_gene2_id',
        'target_gene2_symbol',
        'backfill_run_id',
        'mapping_status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'variant_id' => 'integer',
            'variant_occurrence_id' => 'integer',
            'procedure_occurrence_id' => 'integer',
            'specimen_id' => 'integer',
            'reference_specimen_id' => 'integer',
            'backfill_run_id' => 'integer',
        ];
    }

    /** @return BelongsTo<GenomicVariant, $this> */
    public function variant(): BelongsTo
    {
        return $this->belongsTo(GenomicVariant::class, 'variant_id');
    }

    /** @return BelongsTo<VariantOccurrence, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function variantOccurrence(): BelongsTo
    {
        return $this->belongsTo(VariantOccurrence::class, 'variant_occurrence_id');
    }

    /** @return BelongsTo<ProcedureOccurrence, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function procedureOccurrence(): BelongsTo
    {
        return $this->belongsTo(ProcedureOccurrence::class, 'procedure_occurrence_id');
    }

    /** @return BelongsTo<Specimen, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function specimen(): BelongsTo
    {
        return $this->belongsTo(Specimen::class, 'specimen_id');
    }

    /** @return BelongsTo<Specimen, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function referenceSpecimen(): BelongsTo
    {
        return $this->belongsTo(Specimen::class, 'reference_specimen_id');
    }
}
