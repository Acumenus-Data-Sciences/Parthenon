<?php

declare(strict_types=1);

namespace App\Models\App;

use App\Http\Controllers\Api\V1\FinnGen\EndpointBrowserController;
use App\Models\App\FinnGen\Run;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Index over (endpoint_name, source_key) FinnGen-endpoint cohort generations.
 *
 * Created on dispatch by EndpointBrowserController::generate; refreshed on
 * subsequent dispatches (upsert keeps the latest run + status). The truth of
 * "this cohort exists in source X" lives in {source_results}.cohort with the
 * matching cohort_definition_id; this table is a fast index so the browser
 * doesn't need a per-source query to render generation badges.
 */
class FinnGenEndpointGeneration extends Model
{
    /**
     * OMOP write-key offset for FinnGen-generated cohorts.
     *
     * FinnGen endpoint generations key `{source}.cohort.cohort_definition_id`
     * as `finngen.endpoint_generations.id + self::OMOP_COHORT_ID_OFFSET`,
     * producing a collision-free numeric range above any realistic
     * `app.cohort_definitions.id` value (current high-water mark is ~1e3;
     * 1e11 gives 8 orders of magnitude of headroom).
     *
     * Mirrored in R at darkstar/api/finngen/cohort_ops.R
     * (function `finngen_endpoint_generate_execute`) as a numeric literal
     * `100000000000` — R's `integer` type is 32-bit; the offset exceeds
     * INT_MAX, so the R side MUST use numeric/double, not `L` suffix.
     *
     * @see EndpointBrowserController::generate()
     * @see darkstar/api/finngen/cohort_ops.R::finngen_endpoint_generate_execute
     */
    public const OMOP_COHORT_ID_OFFSET = 100_000_000_000;

    protected $connection = 'finngen';

    protected $table = 'endpoint_generations';

    /**
     * Mass-assignment whitelist (HIGHSEC §3.1).
     *
     * @var list<string>
     */
    protected $fillable = [
        'endpoint_name',
        'finngen_endpoint_name',
        'source_key',
        'cohort_definition_id',
        'run_id',
        'last_subject_count',
        'last_status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'cohort_definition_id' => 'integer',
            'last_subject_count' => 'integer',
        ];
    }

    /**
     * Latest run for this generation pair.
     *
     * @return BelongsTo<Run, $this>
     */
    public function run(): BelongsTo
    {
        return $this->belongsTo(Run::class, 'run_id');
    }
}
