<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Phase 14 (D-07) — variant-index tracking row per CDM source. Row is
 * upserted by `php artisan finngen:prepare-source-variants --source=X`.
 *
 * FLAG: slated for Phase 13.2 schema rename; when that lands, change
 * $table to 'source_variant_indexes' and $connection to 'finngen'.
 *
 * HIGHSEC §3.1 — $fillable whitelists only D-07 writable columns; no
 * $guarded = [].
 *
 * @property int $id
 * @property string $source_key
 * @property string $format
 * @property string $pgen_path
 * @property string|null $pc_tsv_path
 * @property int|null $variant_count
 * @property int|null $sample_count
 * @property int $pc_count
 * @property Carbon|null $built_at
 * @property int|null $built_by_user_id
 */
class SourceVariantIndex extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'app.finngen_source_variant_indexes';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'source_key',
        'format',
        'pgen_path',
        'pc_tsv_path',
        'variant_count',
        'sample_count',
        'pc_count',
        'built_at',
        'built_by_user_id',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'variant_count' => 'integer',
        'sample_count' => 'integer',
        'pc_count' => 'integer',
        'built_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function builtBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'built_by_user_id');
    }
}
