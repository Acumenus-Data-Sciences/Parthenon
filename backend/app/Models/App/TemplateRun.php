<?php

declare(strict_types=1);

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TemplateRun extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_RUNNING = 'running';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    /** @var list<string> */
    public const TERMINAL_STATUSES = [
        self::STATUS_COMPLETED,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
    ];

    protected $table = 'template_runs';

    /** @var list<string> */
    protected $fillable = [
        'template_id',
        'template_version',
        'parameters',
        'status',
        'progress',
        'current_node',
        'prefect_run_id',
        'error_message',
        'post_conditions',
        'artifacts_path',
        'submitted_by',
        'submitted_at',
        'started_at',
        'finished_at',
        'correlation_id',
    ];

    /**
     * @return array<string,string>
     */
    protected function casts(): array
    {
        return [
            'parameters' => 'array',
            'post_conditions' => 'array',
            'progress' => 'float',
            'submitted_at' => 'datetime',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'correlation_id' => 'string',
            'prefect_run_id' => 'string',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * @return HasMany<IngestionJob, $this>
     */
    public function ingestionJobs(): HasMany
    {
        return $this->hasMany(IngestionJob::class, 'template_run_id');
    }

    /**
     * @param  Builder<TemplateRun>  $query
     * @return Builder<TemplateRun>
     */
    public function scopeNonTerminal(Builder $query): Builder
    {
        return $query->whereNotIn('status', self::TERMINAL_STATUSES);
    }

    /**
     * @param  Builder<TemplateRun>  $query
     * @return Builder<TemplateRun>
     */
    public function scopeForTemplate(Builder $query, string $templateId, string $version): Builder
    {
        return $query->where('template_id', $templateId)->where('template_version', $version);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }
}
