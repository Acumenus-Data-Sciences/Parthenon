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
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'db_connection_config' => 'encrypted:array',
            'selected_tables' => 'array',
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
}
