<?php

declare(strict_types=1);

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

/**
 * Phase 17 GENOMICS-06 D-08 — Eloquent over vocab.pgs_score_variants.
 *
 * Composite PK (score_id, chrom, pos_grch38, effect_allele) per Plan 01
 * migration. Used primarily for read/select; bulk ingestion happens via
 * PgsScoreIngester::upsertVariants() which goes through raw DB insertOrIgnore
 * on the composite key for idempotent re-runs.
 */
final class PgsScoreVariant extends Model
{
    protected $connection = 'omop';

    protected $table = 'vocab.pgs_score_variants';

    public $incrementing = false;

    // Only created_at exists on this table (no updated_at).
    public $timestamps = false;

    /**
     * HIGHSEC §3.1 — explicit fillable whitelist. NEVER $guarded = [].
     *
     * @var list<string>
     */
    protected $fillable = [
        'score_id',
        'rsid',
        'chrom',
        'pos_grch38',
        'pos_grch37',
        'effect_allele',
        'other_allele',
        'effect_weight',
        'frequency_effect_allele',
        'allele_frequency',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'pos_grch38' => 'integer',
        'pos_grch37' => 'integer',
        'effect_weight' => 'float',
        'frequency_effect_allele' => 'float',
        'allele_frequency' => 'float',
    ];
}
