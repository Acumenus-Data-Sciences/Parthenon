<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GisDataset extends Model
{
    use HasFactory;

    protected $table = 'app.gis_datasets';

    protected $fillable = [
        'name', 'slug', 'description', 'source', 'source_version',
        'source_url', 'data_type', 'geometry_type', 'file_path',
        'feature_count', 'status', 'error_message', 'loaded_at',
        'progress_percentage', 'log_output', 'user_id',
        'levels_requested', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'loaded_at' => 'datetime',
            'feature_count' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'progress_percentage' => 'integer',
            'levels_requested' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function appendLog(string $line): void
    {
        $timestamp = now()->format('H:i:s');
        $this->update([
            'log_output' => ($this->log_output ? $this->log_output . "\n" : '') . "[{$timestamp}] {$line}",
        ]);
        $this->refresh();
    }
}
