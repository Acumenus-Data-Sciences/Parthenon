<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinnGenRun extends Model
{
    protected $table = 'finngen_runs';

    protected $fillable = [
        'service_name',
        'status',
        'source_id',
        'submitted_by',
        'source_snapshot',
        'request_payload',
        'result_payload',
        'runtime_payload',
        'artifact_index',
        'submitted_at',
        'completed_at',
    ];

    protected $casts = [
        'source_snapshot' => 'array',
        'request_payload' => 'array',
        'result_payload' => 'array',
        'runtime_payload' => 'array',
        'artifact_index' => 'array',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

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
    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
