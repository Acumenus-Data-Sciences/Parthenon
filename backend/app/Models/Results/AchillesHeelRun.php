<?php

namespace App\Models\Results;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AchillesHeelRun extends Model
{
    protected $table = 'achilles_heel_runs';

    protected $fillable = [
        'run_id',
        'source_id',
        'status',
        'total_rules',
        'completed_rules',
        'failed_rules',
        'started_at',
        'completed_at',
        'error_message',
    ];

    protected function casts(): array
    {
        return [
            'total_rules' => 'integer',
            'completed_rules' => 'integer',
            'failed_rules' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
