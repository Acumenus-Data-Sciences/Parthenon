<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyDesignVersion extends Model
{
    protected $fillable = [
        'session_id',
        'version_number',
        'status',
        'intent_json',
        'normalized_spec_json',
        'provenance_json',
        'accepted_by',
        'accepted_at',
        'locked_at',
    ];

    protected function casts(): array
    {
        return [
            'intent_json' => 'array',
            'normalized_spec_json' => 'array',
            'provenance_json' => 'array',
            'accepted_at' => 'datetime',
            'locked_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(StudyDesignSession::class, 'session_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(StudyDesignAsset::class, 'version_id');
    }
}
