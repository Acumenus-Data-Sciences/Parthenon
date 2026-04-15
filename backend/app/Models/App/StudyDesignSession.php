<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyDesignSession extends Model
{
    protected $fillable = [
        'study_id',
        'created_by',
        'active_version_id',
        'title',
        'status',
        'source_mode',
        'settings_json',
    ];

    protected function casts(): array
    {
        return [
            'settings_json' => 'array',
        ];
    }

    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function activeVersion(): BelongsTo
    {
        return $this->belongsTo(StudyDesignVersion::class, 'active_version_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(StudyDesignVersion::class, 'session_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(StudyDesignAsset::class, 'session_id');
    }

    public function aiEvents(): HasMany
    {
        return $this->hasMany(StudyDesignAiEvent::class, 'session_id');
    }
}
