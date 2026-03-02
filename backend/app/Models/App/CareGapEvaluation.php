<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareGapEvaluation extends Model
{
    protected $table = 'care_gap_evaluations';

    protected $fillable = [
        'bundle_id',
        'source_id',
        'cohort_definition_id',
        'status',
        'evaluated_at',
        'result_json',
        'person_count',
        'compliance_summary',
        'fail_message',
        'author_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'result_json' => 'array',
            'compliance_summary' => 'array',
            'evaluated_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<ConditionBundle, $this>
     */
    public function bundle(): BelongsTo
    {
        return $this->belongsTo(ConditionBundle::class, 'bundle_id');
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class, 'source_id');
    }

    /**
     * @return BelongsTo<CohortDefinition, $this>
     */
    public function cohortDefinition(): BelongsTo
    {
        return $this->belongsTo(CohortDefinition::class, 'cohort_definition_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
