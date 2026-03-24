<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChartAnnotation extends Model
{
    use HasFactory;

    protected static function newFactory(): \Database\Factories\ChartAnnotationFactory
    {
        return \Database\Factories\ChartAnnotationFactory::new();
    }

    protected $fillable = [
        'source_id',
        'chart_type',
        'chart_context',
        'x_value',
        'y_value',
        'annotation_text',
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
}
