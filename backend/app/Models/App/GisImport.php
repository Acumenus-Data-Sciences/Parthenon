<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GisImport extends Model
{
    protected $table = 'gis_imports';

    protected $fillable = [
        'user_id',
        'filename',
        'import_mode',
        'status',
        'column_mapping',
        'abby_suggestions',
        'config',
        'summary_snapshot',
        'row_count',
        'progress_percentage',
        'error_log',
        'log_output',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'column_mapping' => 'array',
            'abby_suggestions' => 'array',
            'config' => 'array',
            'summary_snapshot' => 'array',
            'error_log' => 'array',
            'row_count' => 'integer',
            'progress_percentage' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function appendLog(string $line): void
    {
        $timestamp = now()->format('H:i:s');
        $current = $this->log_output ?? '';
        $this->update(['log_output' => $current."[{$timestamp}] {$line}\n"]);
    }

    public function markStatus(string $status, array $extra = []): void
    {
        $this->update(array_merge(['status' => $status], $extra));
    }
}
