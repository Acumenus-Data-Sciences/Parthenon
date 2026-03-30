<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\DaimonType;
use App\Http\Controllers\Controller;
use App\Models\App\Source;
use App\Models\Results\PopulationRiskScoreResult;
use App\Services\PopulationRisk\PopulationRiskScoreEngineService;
use App\Services\PopulationRisk\PopulationRiskScoreRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * @group Population Analytics
 */
class PopulationRiskScoreController extends Controller
{
    public function __construct(
        private readonly PopulationRiskScoreEngineService $engine,
        private readonly PopulationRiskScoreRegistry $registry,
    ) {}

    /**
     * GET /api/v1/sources/{source}/risk-scores
     *
     * Population-level summary of all risk scores, grouped by clinical category.
     */
    public function index(Source $source): JsonResponse
    {
        $summary = $this->engine->getSummary($source);
        $grouped = $this->engine->getResults($source);
        $lastRun = PopulationRiskScoreResult::where('source_id', $source->id)->max('run_at');

        return response()->json([
            'source_id' => $source->id,
            'last_run' => $lastRun,
            'scores_computed' => count($summary),
            'summary' => $summary,
            'by_category' => $grouped,
        ]);
    }

    /**
     * POST /api/v1/sources/{source}/risk-scores/run
     *
     * Execute all 20 risk score analyses and persist population summaries.
     */
    public function run(Source $source): JsonResponse
    {
        set_time_limit(120); // 20 scores can take up to ~60s on large CDMs

        $outcome = $this->engine->run($source);

        return response()->json([
            'source_id' => $source->id,
            'completed' => $outcome['completed'],
            'failed' => $outcome['failed'],
            'scores' => $outcome['results'],
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/risk-scores/{scoreId}
     *
     * Detailed tier breakdown for a single risk score with confidence and missing data.
     */
    public function show(Source $source, string $scoreId): JsonResponse
    {
        $scoreId = strtoupper($scoreId);
        $score = $this->registry->get($scoreId);

        $rows = PopulationRiskScoreResult::where('source_id', $source->id)
            ->where('score_id', $scoreId)
            ->orderByRaw("CASE risk_tier WHEN 'very_high' THEN 0 WHEN 'high' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'low' THEN 3 ELSE 4 END")
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'message' => "No results for {$scoreId}. Run the risk scoring analysis first.",
            ], 404);
        }

        $totalEligible = $rows->first()->total_eligible;
        $totalComputable = $rows->where('risk_tier', '!=', 'uncomputable')->sum('patient_count');

        return response()->json([
            'score_id' => $scoreId,
            'score_name' => $score?->scoreName() ?? $rows->first()->score_name,
            'category' => $rows->first()->category,
            'description' => $score?->description(),
            'eligible_population' => $score?->eligiblePopulation(),
            'required_components' => $score?->requiredComponents() ?? [],
            'risk_tiers_defined' => $score?->riskTiers() ?? [],
            'total_eligible' => $totalEligible,
            'total_computable' => $totalComputable,
            'completeness_rate' => $totalEligible > 0
                ? round($totalComputable / $totalEligible, 4)
                : null,
            'mean_confidence' => round($rows->avg('mean_confidence') ?? 0, 4),
            'mean_completeness' => round($rows->avg('mean_completeness') ?? 0, 4),
            'last_run' => $rows->max('run_at'),
            'tiers' => $rows->map(fn ($r) => [
                'risk_tier' => $r->risk_tier,
                'patient_count' => $r->patient_count,
                'tier_fraction' => $totalEligible > 0
                    ? round($r->patient_count / $totalEligible, 4) : null,
                'mean_score' => $r->mean_score,
                'p25_score' => $r->p25_score,
                'median_score' => $r->median_score,
                'p75_score' => $r->p75_score,
                'mean_confidence' => $r->mean_confidence,
                'mean_completeness' => $r->mean_completeness,
                'missing_components' => json_decode($r->missing_components ?? '{}', true),
            ])->values(),
        ]);
    }

    /**
     * GET /api/v1/sources/{source}/risk-scores/eligibility
     *
     * Pre-flight check: which scores can run on this source's CDM data?
     */
    public function eligibility(Source $source): JsonResponse
    {
        $cacheKey = "risk-scores:eligibility:{$source->id}";

        // Return cached results if available
        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return response()->json([
                'data' => $cached,
                'cached' => true,
                'cached_at' => Cache::get("{$cacheKey}:timestamp"),
            ]);
        }

        // Compute fresh — with per-query timeout protection
        $result = $this->computeEligibility($source);

        if ($result !== null) {
            Cache::put($cacheKey, $result, now()->addHours(4));
            Cache::put("{$cacheKey}:timestamp", now()->toIso8601String(), now()->addHours(4));

            return response()->json([
                'data' => $result,
                'cached' => false,
                'cached_at' => now()->toIso8601String(),
            ]);
        }

        return response()->json([
            'data' => null,
            'cached' => false,
            'error' => 'Could not connect to the source database. Use the refresh button to retry.',
        ], 200);
    }

    /**
     * POST /sources/{source}/risk-scores/eligibility/refresh
     *
     * Clear cached eligibility and recompute. Returns immediately if source is unreachable.
     */
    public function refreshEligibility(Source $source): JsonResponse
    {
        $cacheKey = "risk-scores:eligibility:{$source->id}";
        Cache::forget($cacheKey);
        Cache::forget("{$cacheKey}:timestamp");

        $result = $this->computeEligibility($source);

        if ($result !== null) {
            Cache::put($cacheKey, $result, now()->addHours(4));
            Cache::put("{$cacheKey}:timestamp", now()->toIso8601String(), now()->addHours(4));

            return response()->json([
                'data' => $result,
                'cached' => false,
                'cached_at' => now()->toIso8601String(),
            ]);
        }

        return response()->json([
            'data' => null,
            'error' => 'Source database is unreachable. Check connection settings.',
        ], 200);
    }

    /**
     * Compute eligibility for all scores on a source, with timeout protection.
     *
     * @return array<string, array{eligible: bool, patient_count: int, missing: list<string>}>|null
     */
    private function computeEligibility(Source $source): ?array
    {
        $connection = $source->source_connection ?? 'omop';
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

        if (! $cdmSchema) {
            return null;
        }

        // Set connection timeout to 5 seconds to avoid hanging on unreachable hosts
        $connConfig = config("database.connections.{$connection}", []);
        $origOptions = $connConfig['options'] ?? [];
        config(["database.connections.{$connection}.options" => array_merge($origOptions, [
            \PDO::ATTR_TIMEOUT => 5,
        ])]);
        DB::purge($connection);

        // Quick connectivity check
        try {
            DB::connection($connection)->selectOne('SELECT 1');
            DB::connection($connection)->statement('SET statement_timeout = 5000');
        } catch (\Throwable) {
            // Restore original options
            config(["database.connections.{$connection}.options" => $origOptions]);
            DB::purge($connection);

            return null;
        }

        // Check which tables exist and have rows — batch unique tables first
        $allTables = [];
        foreach ($this->registry->all() as $score) {
            foreach ($score->requiredTables() as $table) {
                $allTables[$table] = true;
            }
        }

        $tableStatus = [];
        foreach (array_keys($allTables) as $table) {
            try {
                $count = DB::connection($connection)
                    ->selectOne("SELECT COUNT(*) AS cnt FROM {$cdmSchema}.{$table} LIMIT 1");
                $tableStatus[$table] = (int) ($count->cnt ?? 0) > 0;
            } catch (\Throwable) {
                $tableStatus[$table] = false;
            }
        }

        // Get patient count once
        $patientCount = 0;
        try {
            $row = DB::connection($connection)
                ->selectOne("SELECT COUNT(*) AS cnt FROM {$cdmSchema}.person");
            $patientCount = (int) ($row->cnt ?? 0);
        } catch (\Throwable) {
            // ignore
        }

        // Build per-score eligibility from table status
        $result = [];
        foreach ($this->registry->all() as $score) {
            $missing = [];
            foreach ($score->requiredTables() as $table) {
                if (! ($tableStatus[$table] ?? false)) {
                    $missing[] = $table;
                }
            }

            $result[$score->scoreId()] = [
                'eligible' => empty($missing),
                'patient_count' => empty($missing) ? $patientCount : 0,
                'missing' => $missing,
            ];
        }

        // Reset statement timeout and restore connection options
        try {
            DB::connection($connection)->statement('SET statement_timeout = 0');
        } catch (\Throwable) {
            // ignore
        }
        config(["database.connections.{$connection}.options" => $origOptions]);
        DB::purge($connection);

        return $result;
    }

    /**
     * GET /api/v1/sources/{source}/risk-scores/catalogue
     *
     * Metadata for all registered scores (no CDM required — static).
     */
    public function catalogue(): JsonResponse
    {
        $scores = array_map(fn ($s) => [
            'score_id' => $s->scoreId(),
            'score_name' => $s->scoreName(),
            'category' => $s->category(),
            'description' => $s->description(),
            'eligible_population' => $s->eligiblePopulation(),
            'required_components' => $s->requiredComponents(),
            'risk_tiers' => $s->riskTiers(),
            'required_tables' => $s->requiredTables(),
        ], $this->registry->all());

        return response()->json(['scores' => $scores]);
    }
}
