<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyDesignAiEvent extends Model
{
    protected $fillable = [
        'session_id',
        'version_id',
        'event_type',
        'provider',
        'model',
        'prompt_sha256',
        'input_json',
        'output_json',
        'safety_json',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'input_json' => 'array',
            'output_json' => 'array',
            'safety_json' => 'array',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(StudyDesignSession::class, 'session_id');
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(StudyDesignVersion::class, 'version_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
