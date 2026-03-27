<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Persisted mapping session for later resumption.
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string|null $description
 * @property array<int, string> $source_terms
 * @property array<int, mixed> $results
 * @property array<string, string|null> $decisions
 * @property array<int, string>|null $target_vocabularies
 * @property array<int, string>|null $target_domains
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class MappingProject extends Model
{
    protected $table = 'mapping_projects';

    protected $fillable = [
        'name',
        'description',
        'user_id',
        'source_terms',
        'results',
        'decisions',
        'target_vocabularies',
        'target_domains',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'source_terms' => 'array',
            'results' => 'array',
            'decisions' => 'array',
            'target_vocabularies' => 'array',
            'target_domains' => 'array',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
