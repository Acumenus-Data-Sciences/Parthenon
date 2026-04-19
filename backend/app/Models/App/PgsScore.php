<?php

declare(strict_types=1);

namespace App\Models\App;

use App\Casts\PgArray;
use Illuminate\Database\Eloquent\Model;

/**
 * Phase 17 GENOMICS-06 D-07 — Eloquent over vocab.pgs_scores.
 *
 * Read + ingest surface for PGS Catalog score metadata. Uses the `omop`
 * connection whose search_path includes vocab (see CLAUDE.md §Database
 * Architecture table). score_id is a stable PGS Catalog natural key
 * (e.g. PGS000001), not incrementing.
 */
final class PgsScore extends Model
{
    protected $connection = 'omop';

    protected $table = 'vocab.pgs_scores';

    protected $primaryKey = 'score_id';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * HIGHSEC §3.1 — explicit fillable whitelist. NEVER $guarded = [].
     *
     * @var list<string>
     */
    protected $fillable = [
        'score_id',
        'pgs_name',
        'trait_reported',
        'trait_efo_ids',
        'variants_number',
        'ancestry_distribution',
        'publication_doi',
        'license',
        'weights_file_url',
        'harmonized_file_url',
        'genome_build',
        'loaded_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'trait_efo_ids' => PgArray::class,   // PG TEXT[] (not JSON array)
        'ancestry_distribution' => 'array',  // JSONB
        'variants_number' => 'integer',
        'loaded_at' => 'datetime',
    ];
}
