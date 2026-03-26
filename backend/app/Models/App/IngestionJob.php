<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IngestionJob extends Model
{
    protected $fillable = [
        'source_id',
        'ingestion_project_id',
        'status',
        'current_step',
        'progress_percentage',
        'config_json',
        'started_at',
        'completed_at',
        'stats_json',
        'error_message',
        'created_by',
        'staging_table_name',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ExecutionStatus::class,
            'current_step' => IngestionStep::class,
            'config_json' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'stats_json' => 'array',
        ];
    }

    /**
     * @return BelongsTo<IngestionProject, $this>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(IngestionProject::class, 'ingestion_project_id');
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<SourceProfile, $this>
     */
    public function profiles(): HasMany
    {
        return $this->hasMany(SourceProfile::class);
    }

    /**
     * @return HasMany<ConceptMapping, $this>
     */
    public function conceptMappings(): HasMany
    {
        return $this->hasMany(ConceptMapping::class);
    }

    /**
     * @return HasMany<SchemaMapping, $this>
     */
    public function schemaMappings(): HasMany
    {
        return $this->hasMany(SchemaMapping::class);
    }

    /**
     * @return HasMany<ValidationResult, $this>
     */
    public function validationResults(): HasMany
    {
        return $this->hasMany(ValidationResult::class);
    }
}
