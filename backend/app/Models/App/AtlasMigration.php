<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AtlasMigration extends Model
{
    protected $table = 'atlas_migrations';

    protected $fillable = [
        'webapi_url',
        'webapi_name',
        'auth_type',
        'auth_credentials',
        'status',
        'selected_entities',
        'discovery_results',
        'import_results',
        'validation_results',
        'current_step',
        'total_entities',
        'imported_entities',
        'failed_entities',
        'skipped_entities',
        'error_message',
        'started_at',
        'completed_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'auth_credentials' => 'encrypted',
            'selected_entities' => 'array',
            'discovery_results' => 'array',
            'import_results' => 'array',
            'validation_results' => 'array',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'total_entities' => 'integer',
            'imported_entities' => 'integer',
            'failed_entities' => 'integer',
            'skipped_entities' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return HasMany<AtlasIdMapping, $this> */
    public function idMappings(): HasMany
    {
        return $this->hasMany(AtlasIdMapping::class, 'migration_id');
    }
}
