<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TargetGene extends CdmModel
{
    protected $table = 'target_gene';

    protected $primaryKey = 'target_gene_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'target_gene_id' => 'integer',
            'genomic_test_id' => 'integer',
            'target_gene_source_concept_id' => 'integer',
            'target_gene_concept_id' => 'integer',
        ];
    }

    /** @return BelongsTo<GenomicTest, $this> */
    public function genomicTest(): BelongsTo
    {
        return $this->belongsTo(GenomicTest::class, 'genomic_test_id');
    }
}
