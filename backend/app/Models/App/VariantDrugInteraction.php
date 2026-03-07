<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class VariantDrugInteraction extends Model
{
    protected $fillable = [
        'gene_symbol',
        'hgvs_p',
        'variant_class',
        'drug_concept_id',
        'drug_name',
        'relationship',
        'mechanism',
        'evidence_level',
        'confidence',
        'evidence_summary',
        'source_url',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'drug_concept_id' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
