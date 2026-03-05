<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class ClinVarVariant extends Model
{
    protected $table = 'clinvar_variants';

    protected $fillable = [
        'variation_id',
        'rs_id',
        'chromosome',
        'position',
        'reference_allele',
        'alternate_allele',
        'genome_build',
        'gene_symbol',
        'hgvs',
        'clinical_significance',
        'disease_name',
        'review_status',
        'is_pathogenic',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_pathogenic' => 'boolean',
            'last_synced_at' => 'datetime',
        ];
    }
}
