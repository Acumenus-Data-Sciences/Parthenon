<?php

namespace App\Models\App;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class StudyDesignAsset extends Model
{
    protected $fillable = [
        'session_id',
        'version_id',
        'asset_type',
        'role',
        'status',
        'draft_payload_json',
        'canonical_type',
        'canonical_id',
        'provenance_json',
        'verification_status',
        'verification_json',
        'verified_at',
        'rank_score',
        'rank_score_json',
        'materialized_type',
        'materialized_id',
        'materialized_at',
        'review_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => StudyDesignAssetStatus::class,
            'draft_payload_json' => 'array',
            'provenance_json' => 'array',
            'verification_status' => StudyDesignVerificationStatus::class,
            'verification_json' => 'array',
            'verified_at' => 'datetime',
            'rank_score' => 'float',
            'rank_score_json' => 'array',
            'materialized_at' => 'datetime',
            'reviewed_at' => 'datetime',
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

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function canonical(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'canonical_type', 'canonical_id');
    }

    public function materialized(): MorphTo
    {
        return $this->morphTo(__FUNCTION__, 'materialized_type', 'materialized_id');
    }
}
