<?php

namespace App\Models\Cdm;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GenomicTest extends CdmModel
{
    protected $table = 'genomic_test';

    protected $primaryKey = 'genomic_test_id';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'genomic_test_id' => 'integer',
            'care_site_id' => 'integer',
            'read_length' => 'integer',
            'total_reads' => 'integer',
            'mean_target_coverage' => 'float',
            'per_target_base_cover_100x' => 'float',
        ];
    }

    /** @return BelongsTo<CareSite, $this> */
    public function careSite(): BelongsTo
    {
        return $this->belongsTo(CareSite::class, 'care_site_id');
    }

    /** @return HasMany<TargetGene, $this> */
    public function targetGenes(): HasMany
    {
        return $this->hasMany(TargetGene::class, 'genomic_test_id');
    }
}
