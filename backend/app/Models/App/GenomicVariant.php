<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GenomicVariant extends Model
{
    protected $fillable = [
        'upload_id',
        'source_id',
        'person_id',
        'sample_id',
        'chromosome',
        'position',
        'reference_allele',
        'alternate_allele',
        'genome_build',
        'gene_symbol',
        'hgvs_c',
        'hgvs_p',
        'variant_type',
        'variant_class',
        'consequence',
        'quality',
        'filter_status',
        'zygosity',
        'allele_frequency',
        'read_depth',
        'clinvar_id',
        'clinvar_significance',
        'clinvar_disease',
        'clinvar_review_status',
        'cosmic_id',
        'tmb_contribution',
        'is_msi_marker',
        'measurement_concept_id',
        'measurement_source_value',
        'value_as_concept_id',
        'mapping_status',
        'omop_measurement_id',
        'raw_info',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'quality' => 'float',
            'allele_frequency' => 'float',
            'read_depth' => 'integer',
            'tmb_contribution' => 'float',
            'is_msi_marker' => 'boolean',
            'measurement_concept_id' => 'integer',
            'value_as_concept_id' => 'integer',
            'omop_measurement_id' => 'integer',
            'raw_info' => 'array',
        ];
    }

    /** @return BelongsTo<GenomicUpload, $this> */
    public function upload(): BelongsTo
    {
        return $this->belongsTo(GenomicUpload::class, 'upload_id');
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
