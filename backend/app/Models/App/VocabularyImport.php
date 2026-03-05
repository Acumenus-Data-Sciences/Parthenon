<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VocabularyImport extends Model
{
    protected $fillable = [
        'user_id',
        'source_id',
        'status',
        'progress_percentage',
        'file_name',
        'storage_path',
        'file_size',
        'log_output',
        'error_message',
        'rows_loaded',
        'target_schema',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'file_size' => 'integer',
        'rows_loaded' => 'integer',
        'progress_percentage' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function appendLog(string $line): void
    {
        $timestamp = now()->format('H:i:s');
        $this->update([
            'log_output' => ($this->log_output ? $this->log_output."\n" : '')."[{$timestamp}] {$line}",
        ]);
        $this->refresh();
    }
}
