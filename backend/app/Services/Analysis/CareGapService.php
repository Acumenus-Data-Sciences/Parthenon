<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\BundleOverlapRule;
use App\Models\App\CareGapEvaluation;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CareGapService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Evaluate care gaps for a condition bundle against a data source.
     */
    public function evaluate(
        ConditionBundle $bundle,
        Source $source,
        ?int $cohortDefinitionId,
        CareGapEvaluation $evaluation,
    ): void {
        $evaluation->update([
            'status' => 'running',
        ]);

        Log::info('CareGapEvaluation started', [
            'bundle_id' => $bundle->id,
            'source_id' => $source->id,
            'evaluation_id' => $evaluation->id,
        ]);

        try {
            // Resolve schemas from source daimons
            $source->load('daimons');
            $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
            $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
            $resultsSchema = $source->getTableQualifier(DaimonType::Results);

            if ($cdmSchema === null) {
                throw new \RuntimeException(
                    'Source is missing required CDM schema configuration.'
                );
            }

            $connectionName = $source->source_connection ?? 'cdm';
            $dialect = $source->source_dialect ?? 'postgresql';

            // Step 1: Find patients with the bundle's conditions
            $patientIds = $this->findEligiblePatients(
                $bundle,
                $cdmSchema,
                $resultsSchema,
                $cohortDefinitionId,
                $connectionName,
                $dialect,
            );

            $totalPatients = count($patientIds);

            if ($totalPatients === 0) {
                $evaluation->update([
                    'status' => 'completed',
                    'evaluated_at' => now(),
                    'person_count' => 0,
                    'result_json' => [
                        'bundle_code' => $bundle->bundle_code,
                        'condition_name' => $bundle->condition_name,
                        'total_patients' => 0,
                        'measures' => [],
                        'overlap_deductions' => [],
                        'overall_compliance_pct' => 0,
                        'risk_distribution' => ['high' => 0, 'medium' => 0, 'low' => 0],
                    ],
                    'compliance_summary' => [
                        'met' => 0,
                        'open' => 0,
                        'excluded' => 0,
                        'compliance_pct' => 0,
                    ],
                ]);

                return;
            }

            // Step 2: Evaluate each quality measure
            $bundle->load('measures');
            $measureResults = [];

            foreach ($bundle->measures as $measure) {
                $measureResult = $this->evaluateMeasure(
                    $measure,
                    $patientIds,
                    $cdmSchema,
                    $vocabSchema,
                    $connectionName,
                    $dialect,
                );
                $measureResults[] = $measureResult;
            }

            // Step 3: Apply overlap rules (deduplication)
            $overlapDeductions = $this->applyOverlapRules(
                $bundle,
                $measureResults,
            );

            // Step 4: Compute overall bundle compliance
            $overallCompliance = $this->computeOverallCompliance(
                $measureResults,
                $totalPatients,
            );

            // Step 5: Compute risk distribution
            $riskDistribution = $this->computeRiskDistribution(
                $measureResults,
                $totalPatients,
            );

            $resultJson = [
                'bundle_code' => $bundle->bundle_code,
                'condition_name' => $bundle->condition_name,
                'total_patients' => $totalPatients,
                'measures' => $measureResults,
                'overlap_deductions' => $overlapDeductions,
                'overall_compliance_pct' => $overallCompliance,
                'risk_distribution' => $riskDistribution,
            ];

            // Compute compliance summary
            $totalMet = 0;
            $totalOpen = 0;
            $totalExcluded = 0;

            foreach ($measureResults as $mr) {
                $totalMet += $mr['met'];
                $totalOpen += $mr['not_met'];
                $totalExcluded += $mr['excluded'];
            }

            $totalEligibleSlots = $totalMet + $totalOpen + $totalExcluded;
            $compliancePct = $totalEligibleSlots > 0
                ? round(($totalMet / $totalEligibleSlots) * 100, 1)
                : 0;

            $evaluation->update([
                'status' => 'completed',
                'evaluated_at' => now(),
                'person_count' => $totalPatients,
                'result_json' => $resultJson,
                'compliance_summary' => [
                    'met' => $totalMet,
                    'open' => $totalOpen,
                    'excluded' => $totalExcluded,
                    'compliance_pct' => $compliancePct,
                ],
            ]);

            Log::info('CareGapEvaluation completed', [
                'bundle_id' => $bundle->id,
                'evaluation_id' => $evaluation->id,
                'person_count' => $totalPatients,
                'compliance_pct' => $overallCompliance,
            ]);
        } catch (\Throwable $e) {
            $evaluation->update([
                'status' => 'failed',
                'evaluated_at' => now(),
                'fail_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);

            Log::error('CareGapEvaluation failed', [
                'bundle_id' => $bundle->id,
                'evaluation_id' => $evaluation->id,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Get population-level summary of care gap compliance across all bundles.
     *
     * @return array<string, mixed>
     */
    public function getPopulationSummary(Source $source): array
    {
        $bundles = ConditionBundle::where('is_active', true)
            ->with(['measures'])
            ->get();

        $summary = [];

        foreach ($bundles as $bundle) {
            $latestEvaluation = CareGapEvaluation::where('bundle_id', $bundle->id)
                ->where('source_id', $source->id)
                ->where('status', 'completed')
                ->orderByDesc('evaluated_at')
                ->first();

            $summary[] = [
                'bundle_code' => $bundle->bundle_code,
                'condition_name' => $bundle->condition_name,
                'disease_category' => $bundle->disease_category,
                'measure_count' => $bundle->measures->count(),
                'latest_evaluation' => $latestEvaluation ? [
                    'id' => $latestEvaluation->id,
                    'evaluated_at' => $latestEvaluation->evaluated_at?->toIso8601String(),
                    'person_count' => $latestEvaluation->person_count,
                    'compliance_summary' => $latestEvaluation->compliance_summary,
                    'overall_compliance_pct' => $latestEvaluation->result_json['overall_compliance_pct'] ?? null,
                ] : null,
            ];
        }

        // Compute aggregate statistics
        $totalPatients = 0;
        $totalGaps = 0;
        $evaluatedBundles = 0;
        $avgCompliance = 0;

        foreach ($summary as $item) {
            if ($item['latest_evaluation'] !== null) {
                $evaluatedBundles++;
                $totalPatients += $item['latest_evaluation']['person_count'] ?? 0;
                $totalGaps += $item['latest_evaluation']['compliance_summary']['open'] ?? 0;
                $avgCompliance += $item['latest_evaluation']['overall_compliance_pct'] ?? 0;
            }
        }

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'total_bundles' => $bundles->count(),
            'evaluated_bundles' => $evaluatedBundles,
            'aggregate' => [
                'total_patients_evaluated' => $totalPatients,
                'total_open_gaps' => $totalGaps,
                'average_compliance_pct' => $evaluatedBundles > 0
                    ? round($avgCompliance / $evaluatedBundles, 1)
                    : 0,
            ],
            'bundles' => $summary,
        ];
    }

    /**
     * Find patients eligible for this bundle's condition.
     *
     * @return list<int>
     */
    private function findEligiblePatients(
        ConditionBundle $bundle,
        string $cdmSchema,
        ?string $resultsSchema,
        ?int $cohortDefinitionId,
        string $connectionName,
        string $dialect,
    ): array {
        $conceptIds = $bundle->omop_concept_ids ?? [];

        if (empty($conceptIds)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($conceptIds), '?'));

        $sql = "SELECT DISTINCT co.person_id
            FROM {@cdmSchema}.condition_occurrence co
            WHERE co.condition_concept_id IN ({$placeholders})";

        // If a cohort is specified, intersect with cohort members
        if ($cohortDefinitionId !== null && $resultsSchema !== null) {
            $sql .= '
                AND co.person_id IN (
                    SELECT subject_id FROM {@resultsSchema}.cohort
                    WHERE cohort_definition_id = ?
                )';
        }

        $renderedSql = $this->sqlRenderer->render(
            $sql,
            [
                'cdmSchema' => $cdmSchema,
                'resultsSchema' => $resultsSchema ?? '',
            ],
            $dialect,
        );

        $bindings = $conceptIds;
        if ($cohortDefinitionId !== null && $resultsSchema !== null) {
            $bindings[] = $cohortDefinitionId;
        }

        $rows = DB::connection($connectionName)->select($renderedSql, $bindings);

        return array_map(fn ($row) => (int) $row->person_id, $rows);
    }

    /**
     * Evaluate a single quality measure against a set of patient IDs.
     *
     * @param  list<int>  $patientIds
     * @return array<string, mixed>
     */
    private function evaluateMeasure(
        QualityMeasure $measure,
        array $patientIds,
        string $cdmSchema,
        string $vocabSchema,
        string $connectionName,
        string $dialect,
    ): array {
        $numerator = $measure->numerator_criteria;

        if ($numerator === null || empty($numerator['concept_ids'] ?? [])) {
            return [
                'measure_code' => $measure->measure_code,
                'measure_name' => $measure->measure_name,
                'eligible' => count($patientIds),
                'met' => 0,
                'not_met' => count($patientIds),
                'excluded' => 0,
                'compliance_pct' => 0,
                'is_deduplicated' => false,
            ];
        }

        $eligible = count($patientIds);
        $excluded = 0;

        // Determine the CDM table to query based on measure domain
        $tableName = $this->resolveTableName($measure->domain);
        $conceptColumn = $this->resolveConceptColumn($measure->domain);
        $dateColumn = $this->resolveDateColumn($measure->domain);

        $conceptIds = $numerator['concept_ids'];
        $lookbackDays = $numerator['lookback_days'] ?? 365;

        // Build the compliance check query
        $conceptPlaceholders = implode(',', array_fill(0, count($conceptIds), '?'));

        // Chunk patient IDs to avoid too-large IN clauses
        $metPatientIds = [];
        $chunks = array_chunk($patientIds, 1000);

        foreach ($chunks as $chunk) {
            $patientPlaceholders = implode(',', array_fill(0, count($chunk), '?'));

            $sql = "SELECT DISTINCT t.person_id
                FROM {@cdmSchema}.{$tableName} t
                WHERE t.{$conceptColumn} IN ({$conceptPlaceholders})
                AND t.person_id IN ({$patientPlaceholders})
                AND t.{$dateColumn} >= DATEADD(day, -{$lookbackDays}, {CURRENT_DATE})";

            $renderedSql = $this->sqlRenderer->render(
                $sql,
                ['cdmSchema' => $cdmSchema],
                $dialect,
            );

            $bindings = array_merge($conceptIds, $chunk);

            $rows = DB::connection($connectionName)->select($renderedSql, $bindings);

            foreach ($rows as $row) {
                $metPatientIds[] = (int) $row->person_id;
            }
        }

        $metPatientIds = array_unique($metPatientIds);
        $metCount = count($metPatientIds);
        $notMetCount = $eligible - $metCount - $excluded;

        $compliancePct = $eligible > 0
            ? round(($metCount / $eligible) * 100, 1)
            : 0;

        return [
            'measure_code' => $measure->measure_code,
            'measure_name' => $measure->measure_name,
            'eligible' => $eligible,
            'met' => $metCount,
            'not_met' => max(0, $notMetCount),
            'excluded' => $excluded,
            'compliance_pct' => $compliancePct,
            'is_deduplicated' => false,
        ];
    }

    /**
     * Apply overlap/deduplication rules.
     *
     * @param  list<array<string, mixed>>  $measureResults
     * @return list<array<string, mixed>>
     */
    private function applyOverlapRules(
        ConditionBundle $bundle,
        array &$measureResults,
    ): array {
        $overlapDeductions = [];

        $activeRules = BundleOverlapRule::where('is_active', true)->get();

        foreach ($activeRules as $rule) {
            $applicableCodes = $rule->applicable_bundle_codes ?? [];

            if (! in_array($bundle->bundle_code, $applicableCodes, true)) {
                continue;
            }

            // If this bundle's code is NOT the canonical source, mark overlapping measures as deduplicated
            $canonicalCode = $rule->canonical_measure_code;

            foreach ($measureResults as &$result) {
                // Check if this measure overlaps with the canonical measure's domain
                // by comparing the shared domain context
                if ($this->isMeasureInOverlapDomain($result['measure_code'], $rule, $bundle->bundle_code)) {
                    // Only mark as deduplicated if this is NOT the canonical measure
                    if ($result['measure_code'] !== $canonicalCode) {
                        $result['is_deduplicated'] = true;
                        $overlapDeductions[] = [
                            'rule_code' => $rule->rule_code,
                            'shared_domain' => $rule->shared_domain,
                            'deduplicated_measure' => $result['measure_code'],
                            'canonical_measure' => $canonicalCode,
                        ];
                    }
                }
            }
            unset($result);
        }

        return $overlapDeductions;
    }

    /**
     * Determine if a measure is part of an overlap domain for a given bundle.
     */
    private function isMeasureInOverlapDomain(
        string $measureCode,
        BundleOverlapRule $rule,
        string $bundleCode,
    ): bool {
        // Map overlap rules to the specific measures they affect per bundle
        $overlapMap = [
            'DEDUP_BP_CONTROL' => [
                'HTN' => 'HTN-01',
                'DM' => 'DM-05',
                'CAD' => 'CAD-03',
                'HF' => 'HF-03',
            ],
            'DEDUP_LIPID_MGMT' => [
                'DM' => 'DM-06',
                'CAD' => 'CAD-02',
            ],
            'DEDUP_RENAL' => [
                'DM' => 'DM-04',
                'CKD' => 'CKD-01',
                'HF' => 'HF-06',
            ],
        ];

        $ruleMap = $overlapMap[$rule->rule_code] ?? [];
        $affectedMeasure = $ruleMap[$bundleCode] ?? null;

        return $affectedMeasure === $measureCode;
    }

    /**
     * Compute overall bundle compliance as average of non-deduplicated measures.
     *
     * @param  list<array<string, mixed>>  $measureResults
     */
    private function computeOverallCompliance(array $measureResults, int $totalPatients): float
    {
        if ($totalPatients === 0 || empty($measureResults)) {
            return 0;
        }

        $activeMeasures = array_filter(
            $measureResults,
            fn (array $m) => ! ($m['is_deduplicated'] ?? false),
        );

        if (empty($activeMeasures)) {
            return 0;
        }

        $totalCompliance = array_sum(
            array_map(fn (array $m) => $m['compliance_pct'], $activeMeasures),
        );

        return round($totalCompliance / count($activeMeasures), 1);
    }

    /**
     * Compute risk distribution based on per-patient compliance.
     *
     * @param  list<array<string, mixed>>  $measureResults
     * @return array{high: int, medium: int, low: int}
     */
    private function computeRiskDistribution(array $measureResults, int $totalPatients): array
    {
        if ($totalPatients === 0) {
            return ['high' => 0, 'medium' => 0, 'low' => 0];
        }

        // Approximate risk distribution based on overall compliance
        $activeMeasures = array_filter(
            $measureResults,
            fn (array $m) => ! ($m['is_deduplicated'] ?? false),
        );

        if (empty($activeMeasures)) {
            return ['high' => 0, 'medium' => 0, 'low' => $totalPatients];
        }

        $avgCompliance = $this->computeOverallCompliance($measureResults, $totalPatients);

        // Distribute patients into risk tiers based on compliance
        // High risk: patients likely non-compliant with most measures
        // Medium risk: partially compliant
        // Low risk: mostly compliant
        $highRiskPct = max(0, min(100, 100 - $avgCompliance)) / 100;
        $lowRiskPct = max(0, min(100, $avgCompliance - 20)) / 100;
        $mediumRiskPct = 1 - $highRiskPct - $lowRiskPct;

        // Ensure non-negative
        $mediumRiskPct = max(0, $mediumRiskPct);

        $high = (int) round($totalPatients * $highRiskPct);
        $low = (int) round($totalPatients * $lowRiskPct);
        $medium = $totalPatients - $high - $low;

        return [
            'high' => max(0, $high),
            'medium' => max(0, $medium),
            'low' => max(0, $low),
        ];
    }

    /**
     * Resolve CDM table name from measure domain.
     */
    private function resolveTableName(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement',
            'drug' => 'drug_exposure',
            'procedure' => 'procedure_occurrence',
            'condition' => 'condition_occurrence',
            'observation' => 'observation',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }

    /**
     * Resolve the concept ID column for a given domain.
     */
    private function resolveConceptColumn(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement_concept_id',
            'drug' => 'drug_concept_id',
            'procedure' => 'procedure_concept_id',
            'condition' => 'condition_concept_id',
            'observation' => 'observation_concept_id',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }

    /**
     * Resolve the date column for a given domain.
     */
    private function resolveDateColumn(string $domain): string
    {
        return match ($domain) {
            'measurement' => 'measurement_date',
            'drug' => 'drug_exposure_start_date',
            'procedure' => 'procedure_date',
            'condition' => 'condition_start_date',
            'observation' => 'observation_date',
            default => throw new \RuntimeException("Unknown measure domain: {$domain}"),
        };
    }
}
