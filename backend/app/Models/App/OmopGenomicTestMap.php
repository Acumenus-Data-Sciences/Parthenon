<?php

namespace App\Models\App;

use App\Models\Cdm\CareSite;
use App\Models\Cdm\GenomicTest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OmopGenomicTestMap extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'omop_genomic_test_map';

    protected $primaryKey = 'upload_id';

    public $incrementing = false;

    protected $fillable = [
        'upload_id',
        'genomic_test_id',
        'care_site_id',
        'genomic_test_name',
        'genomic_test_version',
        'reference_genome',
        'sequencing_device',
        'library_preparation',
        'target_capture',
        'read_type',
        'read_length',
        'quality_control_tools',
        'total_reads',
        'mean_target_coverage',
        'per_target_base_cover_100x',
        'alignment_tools',
        'variant_calling_tools',
        'chromosome_corrdinate',
        'annotation_tools',
        'annotation_databases',
        'backfill_run_id',
        'mapping_status',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'upload_id' => 'integer',
            'genomic_test_id' => 'integer',
            'care_site_id' => 'integer',
            'read_length' => 'integer',
            'total_reads' => 'integer',
            'mean_target_coverage' => 'float',
            'per_target_base_cover_100x' => 'float',
            'backfill_run_id' => 'integer',
        ];
    }

    /** @return BelongsTo<GenomicUpload, $this> */
    public function upload(): BelongsTo
    {
        return $this->belongsTo(GenomicUpload::class, 'upload_id');
    }

    /** @return BelongsTo<GenomicTest, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function genomicTest(): BelongsTo
    {
        return $this->belongsTo(GenomicTest::class, 'genomic_test_id');
    }

    /** @return BelongsTo<CareSite, $this> @internal Cross-connection (omop): do not use with whereHas/has */
    public function careSite(): BelongsTo
    {
        return $this->belongsTo(CareSite::class, 'care_site_id');
    }
}
