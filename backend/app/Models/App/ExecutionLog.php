<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExecutionLog extends Model
{
    protected $fillable = [
        'execution_id',
        'level',
        'message',
        'context',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'context' => 'array',
        ];
    }

    /**
     * @return BelongsTo<AnalysisExecution, $this>
     */
    public function execution(): BelongsTo
    {
        return $this->belongsTo(AnalysisExecution::class, 'execution_id');
    }
}
