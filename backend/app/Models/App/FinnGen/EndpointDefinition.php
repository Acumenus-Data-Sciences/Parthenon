<?php

declare(strict_types=1);

namespace App\Models\App\FinnGen;

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGenEndpointGeneration;
use Database\Factories\App\FinnGen\EndpointDefinitionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
 * Wave 3 (Plan 13.1-03) expanded this from the Wave 0 stub: added the
 * generations() HasMany relationship, explicit newFactory() method, and
 * full production usage from FinnGenEndpointImporter + EndpointBrowserController.
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

    protected static function newFactory(): EndpointDefinitionFactory
    {
        return EndpointDefinitionFactory::new();
    }

    /**
     * Generations for this endpoint (per-source materializations). D-07 FK
     * split: new rows populate finngen_endpoint_name alongside the legacy
     * cohort_definition_id column.
     *
     * @return HasMany<FinnGenEndpointGeneration, $this>
     */
    public function generations(): HasMany
    {
        return $this->hasMany(
            FinnGenEndpointGeneration::class,
            'finngen_endpoint_name',
            'name',
        );
    }
}
