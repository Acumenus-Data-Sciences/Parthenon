<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

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
