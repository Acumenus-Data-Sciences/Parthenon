<?php

namespace App\Models\App;

use App\Models\User;
use Database\Factories\ChartAnnotationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChartAnnotation extends Model
{
    use HasFactory;

    protected static function newFactory(): ChartAnnotationFactory
    {
        return ChartAnnotationFactory::new();
    }

    protected $fillable = [
        'source_id',
        'chart_type',
        'chart_context',
        'x_value',
        'y_value',
        'annotation_text',
        'tag',
        'parent_id',
        'created_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'chart_context' => 'array',
            'y_value' => 'float',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
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
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return BelongsTo<self, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * @return HasMany<self, $this>
     */
    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    /**
     * Scope to only root-level annotations (no parent).
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeRootAnnotations(Builder $query): Builder
    {
        return $query->whereNull('parent_id');
    }
}
