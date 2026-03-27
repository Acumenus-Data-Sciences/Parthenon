<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\DB;

class PatientArrivalForecastService
{
    /**
     * Achilles analysis IDs for monthly concept counts by domain.
     * stratum_1 = concept_id, stratum_2 = YYYYMM month, count_value = patient count
     *
     * @var array<string, int>
     */
    private const DOMAIN_MONTHLY_MAP = [
        'condition' => 411,
        'drug' => 711,
        'procedure' => 611,
        'measurement' => 1811,
        'observation' => 811,
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Forecast patient accrual for a feasibility assessment + source.
     *
     * @return array{source_id: int, source_name: string, historical: array<int, array{month: string, patient_count: int}>, projected: array<int, array{month: string, projected_count: int, lower_bound: int, upper_bound: int}>, monthly_rate: float, months_to_target: int|null}
     */
    public function forecast(int $assessmentId, int $sourceId, int $months = 24): array
    {
        // Load the assessment and source
        $assessment = DB::table('feasibility_assessments')->where('id', $assessmentId)->first();
        if (! $assessment) {
            throw new \InvalidArgumentException("Assessment {$assessmentId} not found");
        }

        $source = Source::findOrFail($sourceId);

        /** @var array{required_concepts?: int[], min_patients?: int} $criteria */
        $criteria = json_decode($assessment->criteria, true) ?? [];
        $requiredConcepts = $criteria['required_concepts'] ?? [];
        $targetPatients = $criteria['min_patients'] ?? null;

        // Get connection for source
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            DB::connection('results')->statement("SET search_path TO \"{$schema}\", public");
        }

        // Get historical monthly patient counts
        $historical = $this->getHistoricalMonthly($connection, $requiredConcepts);

        if (count($historical) < 6) {
            return [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'historical' => $historical,
                'projected' => [],
                'monthly_rate' => 0.0,
                'months_to_target' => null,
            ];
        }

        // Fit linear regression on last 12 months
        $recentHistory = array_slice($historical, -12);
        $regression = $this->fitLinearRegression($recentHistory);

        // Project forward
        $projected = $this->projectForward($recentHistory, $regression, $months);

        // Compute months to target
        $monthsToTarget = null;
        if ($targetPatients !== null && $targetPatients > 0 && $regression['slope'] > 0) {
            $last = end($recentHistory);
            $lastCount = is_array($last) ? (int) $last['patient_count'] : 0;
            $remaining = $targetPatients - $lastCount;
            if ($remaining > 0) {
                $monthsToTarget = (int) ceil($remaining / max(1, $regression['slope']));
            } else {
                $monthsToTarget = 0; // Already at target
            }
        }

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'historical' => $historical,
            'projected' => $projected,
            'monthly_rate' => round($regression['slope'], 1),
            'months_to_target' => $monthsToTarget,
        ];
    }

    /**
     * Get historical monthly patient counts for the given concepts.
     *
     * When multiple concepts are required, uses the minimum monthly count
     * across concepts as an approximation of the intersection.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, array{month: string, patient_count: int}>
     */
    private function getHistoricalMonthly(string $connection, array $conceptIds): array
    {
        if (empty($conceptIds)) {
            // If no specific concepts, use total observation period analysis
            // Analysis 113: Number of persons by observation period year-month
            $rows = AchillesResult::on($connection)
                ->where('analysis_id', 113)
                ->whereNotNull('stratum_1')
                ->orderBy('stratum_1')
                ->get();

            $monthly = [];
            foreach ($rows as $row) {
                $monthly[] = [
                    'month' => $this->formatMonth((string) $row->stratum_1),
                    'patient_count' => (int) ($row->count_value ?? 0),
                ];
            }

            return $monthly;
        }

        // For each concept, get monthly counts across all domains
        $conceptMonthly = [];

        foreach ($conceptIds as $conceptId) {
            $monthlyForConcept = [];
            $analysisIds = array_values(self::DOMAIN_MONTHLY_MAP);

            $rows = AchillesResult::on($connection)
                ->whereIn('analysis_id', $analysisIds)
                ->where('stratum_1', (string) $conceptId)
                ->whereNotNull('stratum_2')
                ->orderBy('stratum_2')
                ->get();

            foreach ($rows as $row) {
                $month = (string) $row->stratum_2;
                $count = (int) ($row->count_value ?? 0);
                $monthlyForConcept[$month] = ($monthlyForConcept[$month] ?? 0) + $count;
            }

            $conceptMonthly[] = $monthlyForConcept;
        }

        // Compute intersection: minimum count per month across all concepts
        if (empty($conceptMonthly)) {
            return [];
        }

        $allMonths = [];
        foreach ($conceptMonthly as $cm) {
            $allMonths = array_merge($allMonths, array_keys($cm));
        }
        $allMonths = array_unique($allMonths);
        sort($allMonths);

        $result = [];
        foreach ($allMonths as $month) {
            $minCount = PHP_INT_MAX;
            $hasAll = true;

            foreach ($conceptMonthly as $cm) {
                if (! isset($cm[$month])) {
                    $hasAll = false;
                    break;
                }
                $minCount = min($minCount, $cm[$month]);
            }

            if ($hasAll) {
                $result[] = [
                    'month' => $this->formatMonth($month),
                    'patient_count' => $minCount,
                ];
            }
        }

        return $result;
    }

    /**
     * Fit simple linear regression: y = slope*x + intercept
     *
     * @param  array<int, array{month: string, patient_count: int}>  $data
     * @return array{slope: float, intercept: float, r_squared: float}
     */
    private function fitLinearRegression(array $data): array
    {
        $n = count($data);
        if ($n < 2) {
            return ['slope' => 0.0, 'intercept' => 0.0, 'r_squared' => 0.0];
        }

        $sumX = 0.0;
        $sumY = 0.0;
        $sumXY = 0.0;
        $sumX2 = 0.0;
        $sumY2 = 0.0;

        foreach ($data as $i => $point) {
            $x = (float) $i;
            $y = (float) $point['patient_count'];
            $sumX += $x;
            $sumY += $y;
            $sumXY += $x * $y;
            $sumX2 += $x * $x;
            $sumY2 += $y * $y;
        }

        $denominator = ($n * $sumX2) - ($sumX * $sumX);
        if (abs($denominator) < 1e-10) {
            return ['slope' => 0.0, 'intercept' => $sumY / $n, 'r_squared' => 0.0];
        }

        $slope = (($n * $sumXY) - ($sumX * $sumY)) / $denominator;
        $intercept = ($sumY - ($slope * $sumX)) / $n;

        // R-squared
        $meanY = $sumY / $n;
        $ssTotal = $sumY2 - ($n * $meanY * $meanY);
        $ssResidual = 0.0;
        foreach ($data as $i => $point) {
            $predicted = $slope * $i + $intercept;
            $ssResidual += ($point['patient_count'] - $predicted) ** 2;
        }

        $rSquared = $ssTotal > 0 ? 1.0 - ($ssResidual / $ssTotal) : 0.0;

        return [
            'slope' => $slope,
            'intercept' => $intercept,
            'r_squared' => max(0.0, $rSquared),
        ];
    }

    /**
     * Project forward from the last historical data point.
     *
     * @param  array<int, array{month: string, patient_count: int}>  $recentHistory
     * @param  array{slope: float, intercept: float, r_squared: float}  $regression
     * @return array<int, array{month: string, projected_count: int, lower_bound: int, upper_bound: int}>
     */
    private function projectForward(array $recentHistory, array $regression, int $months): array
    {
        $n = count($recentHistory);
        if ($n === 0) {
            return [];
        }

        // Compute residual standard error for prediction intervals
        $residuals = [];
        foreach ($recentHistory as $i => $point) {
            $predicted = $regression['slope'] * $i + $regression['intercept'];
            $residuals[] = $point['patient_count'] - $predicted;
        }

        $residualStdDev = 0.0;
        if ($n > 2) {
            $ssResidual = array_sum(array_map(fn (float $r) => $r * $r, $residuals));
            $residualStdDev = sqrt($ssResidual / ($n - 2));
        }

        // Get last month for projection base
        $lastMonth = end($recentHistory)['month'];
        $lastTs = strtotime($lastMonth.'-01');

        $projected = [];
        for ($m = 1; $m <= $months; $m++) {
            $projectedTs = strtotime("+{$m} months", (int) $lastTs);
            $month = date('Y-m', $projectedTs);

            $x = $n - 1 + $m; // Continuation of x-axis
            $pointEstimate = max(0, $regression['slope'] * $x + $regression['intercept']);

            // Prediction interval widens with distance from data
            // Using 95% CI: estimate +/- 1.96 * SE * sqrt(1 + 1/n + (x - mean_x)^2 / SSx)
            $meanX = ($n - 1) / 2.0;
            $ssX = 0.0;
            for ($i = 0; $i < $n; $i++) {
                $ssX += ($i - $meanX) ** 2;
            }

            $leverageFactor = $ssX > 0 ? sqrt(1.0 + (1.0 / $n) + (($x - $meanX) ** 2) / $ssX) : 1.0;
            $margin = 1.96 * $residualStdDev * $leverageFactor;

            $projected[] = [
                'month' => $month,
                'projected_count' => (int) round($pointEstimate),
                'lower_bound' => max(0, (int) round($pointEstimate - $margin)),
                'upper_bound' => (int) round($pointEstimate + $margin),
            ];
        }

        return $projected;
    }

    /**
     * Format a YYYYMM string into YYYY-MM.
     */
    private function formatMonth(string $yyyymm): string
    {
        if (strlen($yyyymm) === 6) {
            return substr($yyyymm, 0, 4).'-'.substr($yyyymm, 4, 2);
        }

        // Already formatted or different format
        return $yyyymm;
    }
}
