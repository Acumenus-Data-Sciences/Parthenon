<?php

declare(strict_types=1);

namespace App\Models\App;

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
    protected $table = 'finngen_endpoint_generations';

    /**
     * Mass-assignment whitelist (HIGHSEC §3.1).
     *
     * @var list<string>
     */
    protected $fillable = [
        'endpoint_name',
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
