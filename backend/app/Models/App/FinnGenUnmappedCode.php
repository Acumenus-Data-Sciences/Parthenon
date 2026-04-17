<?php

declare(strict_types=1);

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

/**
 * Sidecar table for FinnGen endpoint-import unmapped source codes.
 *
 * Each row records a (endpoint_name, source_code, source_vocab, release)
 * tuple that the importer could not resolve against vocab.concept. This
 * becomes the backlog for a future vocabulary loader (ICD-8 Finnish, ICDO3,
 * KELA_REIMB, NOMESCO, KELA_VNRO are the known gaps). See quick task
 * 260416-qpg for context.
 */
class FinnGenUnmappedCode extends Model
{
    protected $connection = 'finngen';

    protected $table = 'unmapped_codes';

    /**
     * Mass-assignment whitelist (HIGHSEC §3.1 — never unguarded).
     *
     * @var list<string>
     */
    protected $fillable = [
        'endpoint_name',
        'source_code',
        'source_vocab',
        'release',
        'code_column',
        'observed_count',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'observed_count' => 'integer',
        ];
    }
}
