<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudyPackage extends Model
{
    protected $fillable = [
        'study_id',
        'version',
        'bundle_json',
        'bundle_sha256',
        'vocabulary_version',
        'cdm_source_release',
        'created_by',
        'tenant_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'bundle_json' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Study, $this>
     */
    public function study(): BelongsTo
    {
        return $this->belongsTo(Study::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
