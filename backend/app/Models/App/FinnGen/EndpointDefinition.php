<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Phase 13.1 — FinnGen endpoint definition.
 *
 * Replaces the Phase-13-era fiction of storing 5,161 FinnGen endpoints as
 * rows in app.cohort_definitions with domain='finngen-endpoint'. After
 * Plan 13.1-02 migration, these rows live in finngen.endpoint_definitions
 * with purpose-built typed columns (D-04) and natural TEXT primary key on
 * `name` (D-05).
 *
 * @property string $name FinnGen endpoint name (e.g. I9_AF, C3_COLON_ADENO)
 * @property string|null $longname Human-readable description
 * @property string|null $description Free-text detail
 * @property string $release FinnGen release tag (e.g. df14)
 * @property CoverageProfile $coverage_profile Portability classification (universal | partial | finland_only)
 * @property CoverageBucket $coverage_bucket Resolution completeness (FULLY_MAPPED | PARTIAL | SPARSE | UNMAPPED | CONTROL_ONLY)
 * @property string|null $universal_pct NUMERIC(5,2) — per-endpoint portability score; cast as decimal:2 string
 * @property int $total_tokens Total tokens in qualifying_event_spec
 * @property int $resolved_tokens Tokens that resolved to standard concepts
 * @property array<int, string> $tags FinnGen-authored tags (category, mode, level)
 * @property array<string, mixed> $qualifying_event_spec Structured FinnGen definition (ICD/NOMESCO/KELA_REIMB branches)
 * @property Carbon $created_at
 * @property Carbon $updated_at
 *
 * Wave 0 (Plan 13.1-01) creates this stub only. Wave 3 (Plan 13.1-03) extends
 * it with scopes, accessors, and relation methods once the underlying table
 * exists and downstream services are migrated off CohortDefinition.
 */
class EndpointDefinition extends Model
{
    use HasFactory;

    protected $connection = 'finngen';

    protected $table = 'endpoint_definitions';

    protected $primaryKey = 'name';

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'longname',
        'description',
        'release',
        'coverage_profile',
        'coverage_bucket',
        'universal_pct',
        'total_tokens',
        'resolved_tokens',
        'tags',
        'qualifying_event_spec',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'coverage_profile' => CoverageProfile::class,
        'coverage_bucket' => CoverageBucket::class,
        'universal_pct' => 'decimal:2',
        'total_tokens' => 'integer',
        'resolved_tokens' => 'integer',
        'tags' => 'array',
        'qualifying_event_spec' => 'array',
    ];
}
