<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FhirSyncRun extends Model
{
    protected $fillable = [
        'fhir_connection_id',
        'ingestion_project_id',
        'status',
        'export_url',
        'since_param',
        'resource_types',
        'files_downloaded',
        'records_extracted',
        'records_mapped',
        'records_written',
        'records_failed',
        'mapping_coverage',
        'error_message',
        'started_at',
        'finished_at',
        'triggered_by',
    ];

    protected function casts(): array
    {
        return [
            'resource_types' => 'array',
            'files_downloaded' => 'integer',
            'records_extracted' => 'integer',
            'records_mapped' => 'integer',
            'records_written' => 'integer',
            'records_failed' => 'integer',
            'mapping_coverage' => 'float',
            'since_param' => 'datetime',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<FhirConnection, $this> */
    public function connection(): BelongsTo
    {
        return $this->belongsTo(FhirConnection::class, 'fhir_connection_id');
    }

    /** @return BelongsTo<User, $this> */
    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }

    /** @return BelongsTo<IngestionProject, $this> */
    public function ingestionProject(): BelongsTo
    {
        return $this->belongsTo(IngestionProject::class);
    }
}
