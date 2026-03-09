<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PacsConnection extends Model
{
    protected $table = 'pacs_connections';

    protected $fillable = [
        'name', 'type', 'base_url', 'auth_type', 'credentials',
        'is_default', 'is_active', 'source_id',
        'last_health_check_at', 'last_health_status',
        'metadata_cache', 'metadata_cached_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_active' => 'boolean',
            'credentials' => 'encrypted:array',
            'metadata_cache' => 'array',
            'last_health_check_at' => 'datetime',
            'metadata_cached_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @param Builder<PacsConnection> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /** @param Builder<PacsConnection> $query */
    public function scopeDefault(Builder $query): void
    {
        $query->where('is_default', true);
    }

    /** @param Builder<PacsConnection> $query */
    public function scopeByType(Builder $query, string $type): void
    {
        $query->where('type', $type);
    }
}
