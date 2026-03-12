<?php

declare(strict_types=1);

namespace App\Models\App;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FhirExportJob extends Model
{
    use HasUuids;

    protected $table = 'fhir_export_jobs';

    protected $fillable = [
        'source_id',
        'status',
        'resource_types',
        'since',
        'patient_ids',
        'files',
        'started_at',
        'finished_at',
        'error_message',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'resource_types' => 'array',
            'patient_ids' => 'array',
            'files' => 'array',
            'since' => 'datetime',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
