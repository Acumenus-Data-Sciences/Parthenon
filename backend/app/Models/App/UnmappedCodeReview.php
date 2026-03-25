<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Review status for unmapped source codes.
 *
 * @property int $id
 * @property int $source_id
 * @property string $source_code
 * @property string $source_vocabulary_id
 * @property string $status
 * @property string|null $notes
 * @property int|null $reviewed_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class UnmappedCodeReview extends Model
{
    protected $table = 'unmapped_code_reviews';

    protected $fillable = [
        'source_id',
        'source_code',
        'source_vocabulary_id',
        'status',
        'notes',
        'reviewed_by',
    ];

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
