<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use App\Models\User;
use App\Observers\FinnGen\GwasCovariateSetObserver;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Phase 14 (D-17, D-18) — reusable GWAS covariate set registry. The
 * `covariate_columns_hash` column is maintained by
 * {@see GwasCovariateSetObserver}::saving — never
 * edit it manually.
 *
 * FLAG: slated for Phase 13.2 schema rename; when that lands, change
 * $table to 'gwas_covariate_sets' and $connection to 'finngen'.
 *
 * HIGHSEC §3.1 — $fillable whitelists only D-17 writable columns; no
 * $guarded = [].
 *
 * @property int $id
 * @property string $name
 * @property string|null $description
 * @property int|null $owner_user_id
 * @property array<int, array<string, string>> $covariate_columns
 * @property string $covariate_columns_hash
 * @property bool $is_default
 */
class GwasCovariateSet extends Model
{
    protected $connection = 'pgsql';

    protected $table = 'app.finngen_gwas_covariate_sets';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'description',
        'owner_user_id',
        'covariate_columns',
        'covariate_columns_hash',
        'is_default',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'covariate_columns' => 'array',
        'is_default' => 'boolean',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }
}
