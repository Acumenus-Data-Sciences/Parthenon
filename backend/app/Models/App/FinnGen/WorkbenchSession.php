<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use App\Models\User;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * SP4 Phase A — Cohort Workbench session.
 *
 * Each session captures a researcher's in-flight cohort-operation tree, the
 * source they're working against, and the UI state needed to resume the
 * 6-step wizard. session_state is intentionally unstructured here; the React
 * store owns the shape and bumps schema_version when it evolves.
 *
 * @property string $id ULID
 * @property int $user_id
 * @property string $source_key
 * @property string $name
 * @property string|null $description
 * @property int $schema_version
 * @property array<string, mixed> $session_state
 * @property Carbon $last_active_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
class WorkbenchSession extends Model
{
    use HasUlids;

    protected $table = 'app.finngen_workbench_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    /** @var list<string> */
    protected $fillable = [
        'id', 'user_id', 'source_key', 'name', 'description',
        'schema_version', 'session_state', 'last_active_at',
    ];

    /** @var array<string, string> */
    protected $casts = [
        'session_state' => 'array',
        'schema_version' => 'integer',
        'last_active_at' => 'datetime',
    ];

    /** @return BelongsTo<User, $this> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
