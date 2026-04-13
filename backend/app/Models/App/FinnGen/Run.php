<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * FinnGen analysis run (SP1 Runtime Foundation).
 *
 * Lifecycle: queued → running → (succeeded | failed | canceled)
 *            running → canceling → canceled (cooperative)
 *
 * @property string $id ULID
 * @property int $user_id
 * @property string $source_key
 * @property string $analysis_type
 * @property array<string, mixed> $params
 * @property string $status
 * @property array<string, mixed>|null $progress
 * @property array<string, mixed> $artifacts
 * @property array<string, mixed>|null $summary
 * @property array<string, mixed>|null $error
 * @property bool $pinned
 * @property bool $artifacts_pruned
 * @property Carbon|null $artifacts_pruned_at
 * @property string|null $darkstar_job_id
 * @property string|null $horizon_job_id
 * @property int $reconciled_count
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 */
class Run extends Model
{
    use HasUlids;

    protected $table = 'app.finngen_runs';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'id', 'user_id', 'source_key', 'analysis_type', 'params',
        'status', 'progress', 'artifacts', 'summary', 'error',
        'pinned', 'artifacts_pruned', 'artifacts_pruned_at',
        'darkstar_job_id', 'horizon_job_id', 'reconciled_count',
        'started_at', 'finished_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'params' => 'array',
        'progress' => 'array',
        'artifacts' => 'array',
        'summary' => 'array',
        'error' => 'array',
        'pinned' => 'boolean',
        'artifacts_pruned' => 'boolean',
        'artifacts_pruned_at' => 'datetime',
        'reconciled_count' => 'integer',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public const STATUS_QUEUED = 'queued';

    public const STATUS_RUNNING = 'running';

    public const STATUS_CANCELING = 'canceling';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELED = 'canceled';

    /** @var list<string> */
    public const ACTIVE_STATUSES = [
        self::STATUS_QUEUED, self::STATUS_RUNNING, self::STATUS_CANCELING,
    ];

    /** @var list<string> */
    public const TERMINAL_STATUSES = [
        self::STATUS_SUCCEEDED, self::STATUS_FAILED, self::STATUS_CANCELED,
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    /**
     * Scope: rows owned by the given user.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * Scope: rows in an active (non-terminal) status.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    /**
     * Scope: candidates for 90-day GC (unpinned + finished more than $retentionDays ago).
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeEligibleForGC(Builder $query, int $retentionDays): Builder
    {
        return $query->where('pinned', false)
            ->whereNotNull('finished_at')
            ->where('finished_at', '<', now()->subDays($retentionDays));
    }
}
