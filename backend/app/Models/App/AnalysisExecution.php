<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use App\Support\Hashing\DefinitionHasher;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Log;

class AnalysisExecution extends Model
{
    use HasFactory;

    protected $fillable = [
        'analysis_type',
        'analysis_id',
        'source_id',
        'status',
        'started_at',
        'completed_at',
        'result_json',
        'fail_message',
        'design_sha256',
        'vocabulary_version',
        'cdm_source_release',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ExecutionStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'result_json' => 'array',
        ];
    }

    /**
     * Best-effort provenance stamp at creation: hash the design the execution
     * ran and pin the source's vocabulary / CDM release. Never throws — missing
     * provenance must not block an analysis run.
     */
    protected static function booted(): void
    {
        static::creating(function (self $execution): void {
            try {
                if ($execution->design_sha256 === null) {
                    $design = $execution->analysis?->getAttribute('design_json');
                    if (is_array($design)) {
                        $execution->design_sha256 = app(DefinitionHasher::class)->hashExpression($design);
                    }
                }

                if ($execution->source_id !== null
                    && ($execution->vocabulary_version === null || $execution->cdm_source_release === null)) {
                    $release = SourceRelease::query()
                        ->where('source_id', $execution->source_id)
                        ->orderByDesc('id')
                        ->first();

                    if ($release !== null) {
                        $execution->vocabulary_version ??= $release->vocabulary_version;
                        $execution->cdm_source_release ??= $release->release_key;
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('AnalysisExecution provenance hook failed', ['error' => $e->getMessage()]);
            }
        });
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function analysis(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return HasMany<ExecutionLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(ExecutionLog::class, 'execution_id');
    }
}
