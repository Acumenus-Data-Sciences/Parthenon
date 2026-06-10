<?php

namespace App\Models\App;

use App\Concerns\HasLibraryLifecycle;
use App\Models\User;
use App\Support\Hashing\DefinitionHasher;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ConceptSet extends Model
{
    use HasFactory, HasLibraryLifecycle, SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'expression_json',
        'author_id',
        'is_public',
        'tags',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expression_json' => 'array',
            'is_public' => 'boolean',
            'tags' => 'array',
        ];
    }

    /**
     * Stamp a content-addressable provenance hash on every write so the set's
     * exact composition is fingerprinted regardless of how it was saved.
     */
    protected static function booted(): void
    {
        static::saving(function (self $conceptSet): void {
            $conceptSet->expression_sha256 = app(DefinitionHasher::class)
                ->hashExpression($conceptSet->expression_json ?? []);
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * @return HasMany<ConceptSetItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(ConceptSetItem::class);
    }
}
