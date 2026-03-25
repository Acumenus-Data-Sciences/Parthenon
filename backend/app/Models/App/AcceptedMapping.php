<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Accepted vocabulary mapping from source code to standard concept.
 *
 * @property int $id
 * @property int $source_id
 * @property string $source_code
 * @property string $source_vocabulary_id
 * @property int $target_concept_id
 * @property string|null $target_concept_name
 * @property string $mapping_method
 * @property float|null $confidence
 * @property int|null $reviewed_by
 * @property \Illuminate\Support\Carbon|null $reviewed_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class AcceptedMapping extends Model
{
    protected $table = 'accepted_mappings';

    protected $fillable = [
        'source_id',
        'source_code',
        'source_vocabulary_id',
        'target_concept_id',
        'target_concept_name',
        'mapping_method',
        'confidence',
        'reviewed_by',
        'reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'confidence' => 'float',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Source, $this>
     */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
