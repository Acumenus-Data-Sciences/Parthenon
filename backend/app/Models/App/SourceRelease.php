<?php

namespace App\Models\App;

use App\Models\Results\AchillesRun;
use Database\Factories\SourceReleaseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SourceRelease extends Model
{
    use HasFactory;

    protected static function newFactory(): SourceReleaseFactory
    {
        return SourceReleaseFactory::new();
    }

    protected $fillable = [
        'source_id',
        'release_key',
        'release_name',
        'release_type',
        'cdm_version',
        'vocabulary_version',
        'etl_version',
        'person_count',
        'record_count',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'person_count' => 'integer',
            'record_count' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return HasMany<AchillesRun, $this>
     */
    public function achillesRuns(): HasMany
    {
        return $this->hasMany(AchillesRun::class, 'release_id');
    }

    /**
     * @return HasMany<DqdResult, $this>
     */
    public function dqdResults(): HasMany
    {
        return $this->hasMany(DqdResult::class, 'release_id');
    }

    // deltas() relationship will be added in Phase 2
}
