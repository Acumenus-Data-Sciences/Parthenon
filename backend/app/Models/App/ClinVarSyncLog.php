<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class ClinVarSyncLog extends Model
{
    protected $table = 'clinvar_sync_log';

    protected $fillable = [
        'genome_build',
        'papu_only',
        'source_url',
        'status',
        'variants_inserted',
        'variants_updated',
        'error_message',
        'started_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'papu_only' => 'boolean',
            'variants_inserted' => 'integer',
            'variants_updated' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
