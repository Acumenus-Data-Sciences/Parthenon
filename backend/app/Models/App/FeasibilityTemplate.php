<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Reusable feasibility assessment template.
 *
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property array<string, mixed> $criteria
 * @property int $created_by
 * @property bool $is_public
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class FeasibilityTemplate extends Model
{
    protected $table = 'feasibility_templates';

    protected $fillable = [
        'name',
        'description',
        'criteria',
        'created_by',
        'is_public',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'criteria' => 'array',
            'is_public' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
