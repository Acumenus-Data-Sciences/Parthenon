<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CohortAuthoringArtifact extends Model
{
    protected $fillable = [
        'cohort_definition_id',
        'author_id',
        'direction',
        'format',
        'artifact_json',
        'metadata_json',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'artifact_json' => 'array',
            'metadata_json' => 'array',
        ];
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
