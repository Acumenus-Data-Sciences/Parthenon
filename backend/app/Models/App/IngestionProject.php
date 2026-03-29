<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class IngestionProject extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'source_id', 'status', 'created_by',
        'file_count', 'total_size_bytes', 'notes',
        'db_connection_config', 'selected_tables',
        'fhir_connection_id', 'fhir_sync_mode', 'fhir_config',
        'last_fhir_sync_run_id', 'last_fhir_sync_at', 'last_fhir_sync_status',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'db_connection_config' => 'encrypted:array',
            'selected_tables' => 'array',
            'fhir_config' => 'encrypted:array',
            'last_fhir_sync_at' => 'datetime',
        ];
    }

    public function getStagingSchemaAttribute(): string
    {
        return "staging_{$this->id}";
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return HasMany<IngestionJob, $this> */
    public function jobs(): HasMany
    {
        return $this->hasMany(IngestionJob::class)->orderByDesc('created_at');
    }

    /** @return BelongsTo<FhirConnection, $this> */
    public function fhirConnection(): BelongsTo
    {
        return $this->belongsTo(FhirConnection::class);
    }

    /** @return BelongsTo<FhirSyncRun, $this> */
    public function lastFhirSyncRun(): BelongsTo
    {
        return $this->belongsTo(FhirSyncRun::class, 'last_fhir_sync_run_id');
    }

    /** @return HasMany<FhirSyncRun, $this> */
    public function fhirSyncRuns(): HasMany
    {
        return $this->hasMany(FhirSyncRun::class, 'ingestion_project_id');
    }
}
