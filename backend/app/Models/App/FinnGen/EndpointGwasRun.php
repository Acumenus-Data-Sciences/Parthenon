<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use Illuminate\Database\Eloquent\Model;

final class EndpointGwasRun extends Model
{
    public const STATUS_QUEUED = 'queued';

    public const STATUS_RUNNING = 'running';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELED = 'canceled';

    public const STATUS_SUPERSEDED = 'superseded';

    public const TERMINAL_STATUSES = [
        self::STATUS_SUCCEEDED,
        self::STATUS_FAILED,
        self::STATUS_CANCELED,
        self::STATUS_SUPERSEDED,
    ];

    public const ACTIVE_STATUSES = [
        self::STATUS_QUEUED,
        self::STATUS_RUNNING,
    ];

    protected $connection = 'finngen';

    protected $table = 'endpoint_gwas_runs';

    /**
     * HIGHSEC §3.1: explicit allow-list. NEVER use $guarded = [].
     *
     * @var list<string>
     */
    protected $fillable = [
        'endpoint_name',
        'source_key',
        'control_cohort_id',
        'covariate_set_id',
        'run_id',
        'step1_run_id',
        'case_n',
        'control_n',
        'top_hit_p_value',
        'status',
        'superseded_by_tracking_id',
        'finished_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'control_cohort_id' => 'int',
        'covariate_set_id' => 'int',
        'case_n' => 'int',
        'control_n' => 'int',
        'top_hit_p_value' => 'float',
        'superseded_by_tracking_id' => 'int',
        'finished_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
