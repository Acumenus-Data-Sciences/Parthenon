<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareGapPatientBundle extends Model
{
    protected $table = 'care_gap_patient_bundles';

    public $timestamps = false;

    protected $fillable = [
        'source_id',
        'bundle_id',
        'person_id',
        'enrolled_at',
        'refreshed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enrolled_at' => 'date',
            'refreshed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class, 'source_id');
    }

    /**
     * @return BelongsTo<ConditionBundle, $this>
     */
    public function bundle(): BelongsTo
    {
        return $this->belongsTo(ConditionBundle::class, 'bundle_id');
    }
}
