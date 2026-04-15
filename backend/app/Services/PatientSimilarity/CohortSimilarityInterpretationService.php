<?php

namespace App\Services\PatientSimilarity;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Models\App\AiProviderSetting;
use App\Models\App\PatientSimilarityInterpretation;
use App\Services\AI\AnalyticsLlmService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;

class CohortSimilarityInterpretationService
{
    /** @var array<int, string> */
    private const STEP_IDS = [
        'profile',
        'balance',
        'psm',
        'landscape',
        'phenotypes',
        'snf',
        'centroid',
        'similar',
    ];

    public function __construct(
        private readonly AnalyticsLlmService $llm,
    ) {}

    /**
     * @param  array<string, mixed>  $result
     * @param  array<string, mixed>  $context
     * @param  array<int, array<string, mixed>>  $priorStepSummaries
     * @return array<string, mixed>
     */
    public function interpret(
        string $mode,
        string $stepId,
        array $result,
        array $context = [],
        array $priorStepSummaries = [],
        ?int $userId = null,
        ?int $runId = null,
        ?int $runStepId = null,
        bool $forceRefresh = false,
    ): array {
        $provider = $this->activeProviderMetadata();
        $sanitizedResult = $this->summarizeResultForStep($stepId, $result);
        $sanitizedContext = $this->summarizeContext($context);
        $sanitizedPrior = $this->summarizePriorSteps($priorStepSummaries);
        $resultHash = $this->hashStepResult($mode, $stepId, $sanitizedResult, $sanitizedContext);

        if ($userId !== null && ! $forceRefresh) {
            $cached = $this->findCachedInterpretation($userId, $mode, $stepId, $sanitizedContext, $resultHash);
            if ($cached) {
                return $this->linkCachedInterpretation($cached, $runId, $runStepId)->toInterpretationPayload('hit');
            }
        }

        $baseResponse = [
            'id' => null,
            'run_id' => $runId,
            'run_step_id' => $runStepId,
            'cache_status' => $forceRefresh ? 'refreshed' : 'miss',
            'result_hash' => $resultHash,
            'status' => 'not_requested',
            'provider' => $provider['provider'] ?? 'analytics_llm',
            'model' => $provider['model'] ?? 'configured AI provider',
            'mode' => $mode,
            'step_id' => $stepId,
            'summary' => '',
            'interpretation' => '',
            'clinical_implications' => [],
            'methodologic_cautions' => [],
            'recommended_next_steps' => [],
            'confidence' => 0.0,
        ];

        try {
            $content = $this->llm->chat(
                messages: [
                    ['role' => 'user', 'content' => $this->buildPrompt(
                        mode: $mode,
                        stepId: $stepId,
                        result: $sanitizedResult,
                        context: $sanitizedContext,
                        priorStepSummaries: $sanitizedPrior,
                    )],
                ],
                options: [
                    'system' => 'You are a senior clinical epidemiologist interpreting aggregate OHDSI/OMOP cohort similarity analyses for researchers. Return only valid JSON.',
                    'max_tokens' => 1800,
                    'temperature' => 0.1,
                ],
            );

            $parsed = $this->extractJsonObject($content);
            if ($parsed === []) {
                $response = [
                    ...$baseResponse,
                    'status' => 'unparseable',
                    'raw_response' => substr($content, 0, 2000),
                    'sanitized_result' => $sanitizedResult,
                ];

                return $this->persistIfPossible($response, $userId, $runId, $runStepId, $sanitizedContext);
            }

            $response = [
                ...$baseResponse,
                'status' => 'interpreted',
                'summary' => (string) ($parsed['summary'] ?? ''),
                'interpretation' => (string) ($parsed['interpretation'] ?? ''),
                'clinical_implications' => $this->stringList($parsed['clinical_implications'] ?? []),
                'methodologic_cautions' => $this->stringList($parsed['methodologic_cautions'] ?? []),
                'recommended_next_steps' => $this->stringList($parsed['recommended_next_steps'] ?? []),
                'confidence' => $this->clampConfidence($parsed['confidence'] ?? 0.0),
                'sanitized_result' => $sanitizedResult,
            ];

            return $this->persistIfPossible($response, $userId, $runId, $runStepId, $sanitizedContext);
        } catch (AiProviderNotConfiguredException $e) {
            $response = [
                ...$baseResponse,
                'status' => 'unavailable',
                'error' => $e->getMessage(),
                'sanitized_result' => $sanitizedResult,
            ];

            return $this->persistIfPossible($response, $userId, $runId, $runStepId, $sanitizedContext);
        } catch (\Throwable $e) {
            Log::warning('Cohort similarity interpretation failed', [
                'mode' => $mode,
                'step_id' => $stepId,
                'provider' => $baseResponse['provider'],
                'model' => $baseResponse['model'],
                'error' => $e->getMessage(),
            ]);

            $response = [
                ...$baseResponse,
                'status' => 'unavailable',
                'error' => $e->getMessage(),
                'sanitized_result' => $sanitizedResult,
            ];

            return $this->persistIfPossible($response, $userId, $runId, $runStepId, $sanitizedContext);
        }
    }

    /**
     * @param  array<string, mixed>  $result
     * @param  array<string, mixed>  $context
     * @param  array<int, array<string, mixed>>  $priorStepSummaries
     */
    public function buildPrompt(
        string $mode,
        string $stepId,
        array $result,
        array $context = [],
        array $priorStepSummaries = [],
    ): string {
        $payload = [
            'workflow_mode' => $mode,
            'step_id' => $stepId,
            'step_name' => $this->stepName($stepId),
            'research_context' => $context,
            'prior_step_summaries' => $priorStepSummaries,
            'aggregate_result' => $result,
        ];

        $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

        return implode("\n\n", [
            'Interpret this aggregate Cohort Similarities analysis step for a researcher.',
            'Use only the supplied aggregate result. Do not infer individual patient facts, protected health information, diagnoses that are not supported by the data, or causal effects.',
            'When the statistics are weak, unstable, capped, sparse, or imbalanced, make that uncertainty explicit. Prefer practical research guidance over generic prose.',
            'Return only JSON with these keys: summary(string), interpretation(string), clinical_implications(array of strings), methodologic_cautions(array of strings), recommended_next_steps(array of strings), confidence(number 0-1).',
            "Aggregate analysis payload:\n{$json}",
        ]);
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    public function summarizeResultForStep(string $stepId, array $result): array
    {
        return match ($stepId) {
            'profile' => $this->summarizeProfile($result),
            'balance' => $this->summarizeBalance($result),
            'psm' => $this->summarizePsm($result),
            'landscape' => $this->summarizeLandscape($result),
            'phenotypes' => $this->summarizePhenotypes($result),
            'snf' => $this->summarizeSnf($result),
            'centroid' => $this->summarizeCentroid($result),
            'similar' => $this->summarizeSimilarPatients($result),
            default => $this->redactPatientLevelData($result),
        };
    }

    /**
     * @param  array<string, mixed>  $result
     * @param  array<string, mixed>  $context
     */
    public function hashStepResult(string $mode, string $stepId, array $result, array $context = []): string
    {
        return hash('sha256', json_encode([
            'mode' => $mode,
            'step_id' => $stepId,
            'context' => $this->normalizeForHash($context),
            'result' => $this->normalizeForHash($result),
        ], JSON_UNESCAPED_SLASHES));
    }

    /**
     * @return array<int, string>
     */
    public static function stepIds(): array
    {
        return self::STEP_IDS;
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeProfile(array $result): array
    {
        $divergence = [];
        foreach (($result['divergence'] ?? []) as $dimension => $row) {
            if (! is_array($row)) {
                continue;
            }
            $divergence[$dimension] = [
                'score' => $row['score'] ?? null,
                'label' => $row['label'] ?? null,
            ];
        }

        uasort($divergence, fn (array $a, array $b): int => ((float) ($b['score'] ?? 0)) <=> ((float) ($a['score'] ?? 0)));

        return [
            'source_cohort' => $this->summarizeCohort($result['source_cohort'] ?? []),
            'target_cohort' => $this->summarizeCohort($result['target_cohort'] ?? []),
            'overall_divergence' => $result['overall_divergence'] ?? null,
            'dimension_divergence' => $divergence,
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeBalance(array $result): array
    {
        $covariates = is_array($result['covariates'] ?? null) ? $result['covariates'] : [];
        $total = count($covariates);
        $meanAbs = $total > 0
            ? array_sum(array_map(fn ($row): float => abs((float) ($row['smd'] ?? 0.0)), $covariates)) / $total
            : 0.0;

        $top = $this->topRowsByAbsoluteValue($covariates, 'smd', 12);
        $distributional = is_array($result['distributional_divergence'] ?? null)
            ? $this->topRowsByAbsoluteValue($result['distributional_divergence'], 'value', 8)
            : [];

        return [
            'overall_divergence' => $result['overall_divergence'] ?? null,
            'covariate_count' => $total,
            'imbalanced_covariates' => count(array_filter($covariates, fn ($row): bool => abs((float) ($row['smd'] ?? 0.0)) >= 0.1)),
            'high_imbalance_covariates' => count(array_filter($covariates, fn ($row): bool => abs((float) ($row['smd'] ?? 0.0)) >= 0.2)),
            'mean_absolute_smd' => round($meanAbs, 4),
            'top_imbalanced_covariates' => array_map(fn (array $row): array => [
                'covariate' => $row['covariate'] ?? null,
                'smd' => $row['smd'] ?? null,
                'domain' => $row['domain'] ?? null,
                'type' => $row['type'] ?? null,
            ], $top),
            'distributional_divergence' => array_map(fn (array $row): array => [
                'dimension' => $row['dimension'] ?? null,
                'metric' => $row['metric'] ?? null,
                'value' => $row['value'] ?? null,
                'interpretation' => $row['interpretation'] ?? null,
            ], $distributional),
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizePsm(array $result): array
    {
        $before = is_array($result['balance']['before'] ?? null) ? $result['balance']['before'] : [];
        $after = is_array($result['balance']['after'] ?? null) ? $result['balance']['after'] : [];

        return [
            'model_metrics' => $result['model_metrics'] ?? [],
            'matched_pair_count' => count(is_array($result['matched_pairs'] ?? null) ? $result['matched_pairs'] : []),
            'unmatched_counts' => [
                'target' => count(is_array($result['unmatched']['target_ids'] ?? null) ? $result['unmatched']['target_ids'] : []),
                'comparator' => count(is_array($result['unmatched']['comparator_ids'] ?? null) ? $result['unmatched']['comparator_ids'] : []),
            ],
            'balance_before' => $this->balanceSummaryRows($before),
            'balance_after' => $this->balanceSummaryRows($after),
            'worst_residual_covariates' => array_map(fn (array $row): array => [
                'covariate' => $row['covariate'] ?? null,
                'smd' => $row['smd'] ?? null,
                'domain' => $row['domain'] ?? null,
                'type' => $row['type'] ?? null,
            ], $this->topRowsByAbsoluteValue($after, 'smd', 10)),
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeLandscape(array $result): array
    {
        $points = is_array($result['points'] ?? null) ? $result['points'] : [];
        $clusterCounts = [];
        $cohortCount = 0;
        foreach ($points as $point) {
            if (! is_array($point)) {
                continue;
            }
            $cluster = (string) ($point['cluster_id'] ?? 'unknown');
            $clusterCounts[$cluster] = ($clusterCounts[$cluster] ?? 0) + 1;
            if ((bool) ($point['is_cohort_member'] ?? false)) {
                $cohortCount++;
            }
        }
        arsort($clusterCounts);

        return [
            'n_patients' => $result['n_patients'] ?? count($points),
            'dimensions' => $result['dimensions'] ?? null,
            'n_clusters' => $result['n_clusters'] ?? count($clusterCounts),
            'cohort_member_points' => $cohortCount,
            'non_cohort_points' => max(0, count($points) - $cohortCount),
            'cluster_sizes' => $clusterCounts,
            'stats' => $result['stats'] ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizePhenotypes(array $result): array
    {
        $clusters = [];
        foreach (($result['clusters'] ?? []) as $cluster) {
            if (! is_array($cluster)) {
                continue;
            }
            $clusters[] = [
                'cluster_id' => $cluster['cluster_id'] ?? null,
                'size' => $cluster['size'] ?? null,
                'demographics' => $cluster['demographics'] ?? [],
                'top_conditions' => $this->summarizeFeatures($cluster['top_conditions'] ?? [], 8),
                'top_drugs' => $this->summarizeFeatures($cluster['top_drugs'] ?? [], 6),
            ];
        }

        return [
            'quality' => $result['quality'] ?? [],
            'feature_matrix_info' => $result['feature_matrix_info'] ?? [],
            'capped_at' => $result['capped_at'] ?? null,
            'original_n_patients' => $result['original_n_patients'] ?? null,
            'clusters' => $clusters,
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeSnf(array $result): array
    {
        $communities = is_array($result['communities'] ?? null) ? $result['communities'] : [];
        $sizes = array_map(fn ($community): int => is_array($community) ? (int) ($community['size'] ?? 0) : 0, $communities);
        rsort($sizes);

        return [
            'n_patients' => $result['n_patients'] ?? null,
            'capped_at' => $result['capped_at'] ?? null,
            'community_count' => count($communities),
            'largest_community_sizes' => array_slice($sizes, 0, 10),
            'modality_contributions' => $result['modality_contributions'] ?? [],
            'convergence' => $result['convergence'] ?? [],
            'edge_count' => count(is_array($result['edges'] ?? null) ? $result['edges'] : []),
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeCentroid(array $result): array
    {
        return [
            'cohort_definition_id' => $result['cohort_definition_id'] ?? null,
            'source_id' => $result['source_id'] ?? null,
            'member_count' => $result['member_count'] ?? null,
            'generated' => $result['generated'] ?? null,
            'dimensions_available' => $result['dimensions_available'] ?? [],
            'dimensions' => $result['dimensions'] ?? [],
        ];
    }

    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeSimilarPatients(array $result): array
    {
        $patients = is_array($result['similar_patients'] ?? null) ? $result['similar_patients'] : [];
        $scores = array_map(fn ($row): float => is_array($row) ? (float) ($row['overall_score'] ?? 0.0) : 0.0, $patients);
        rsort($scores);

        $dimensionSums = [];
        $dimensionCounts = [];
        foreach ($patients as $patient) {
            if (! is_array($patient) || ! is_array($patient['dimension_scores'] ?? null)) {
                continue;
            }
            foreach ($patient['dimension_scores'] as $dimension => $score) {
                if ($score === null) {
                    continue;
                }
                $dimensionSums[$dimension] = ($dimensionSums[$dimension] ?? 0.0) + (float) $score;
                $dimensionCounts[$dimension] = ($dimensionCounts[$dimension] ?? 0) + 1;
            }
        }

        $dimensionMeans = [];
        foreach ($dimensionSums as $dimension => $sum) {
            $dimensionMeans[$dimension] = round($sum / max(1, $dimensionCounts[$dimension] ?? 1), 4);
        }
        arsort($dimensionMeans);

        return [
            'mode' => $result['mode'] ?? null,
            'returned_count' => count($patients),
            'score_summary' => [
                'max' => $scores[0] ?? null,
                'median' => $this->median($scores),
                'min' => $scores !== [] ? min($scores) : null,
            ],
            'mean_dimension_scores' => $dimensionMeans,
            'metadata' => $this->redactPatientLevelData(is_array($result['metadata'] ?? null) ? $result['metadata'] : []),
            'diagnostics' => $this->redactPatientLevelData(is_array($result['metadata']['diagnostics'] ?? null) ? $result['metadata']['diagnostics'] : []),
        ];
    }

    /**
     * @param  array<string, mixed>|mixed  $cohort
     * @return array<string, mixed>
     */
    private function summarizeCohort(mixed $cohort): array
    {
        if (! is_array($cohort)) {
            return [];
        }

        return [
            'cohort_definition_id' => $cohort['cohort_definition_id'] ?? null,
            'name' => $cohort['name'] ?? null,
            'member_count' => $cohort['member_count'] ?? null,
            'dimensions' => $cohort['dimensions'] ?? [],
        ];
    }

    /**
     * @param  array<int, mixed>  $rows
     * @return array<string, mixed>
     */
    private function balanceSummaryRows(array $rows): array
    {
        $total = count($rows);
        $meanAbs = $total > 0
            ? array_sum(array_map(fn ($row): float => is_array($row) ? abs((float) ($row['smd'] ?? 0.0)) : 0.0, $rows)) / $total
            : 0.0;

        return [
            'covariate_count' => $total,
            'imbalanced_covariates' => count(array_filter($rows, fn ($row): bool => is_array($row) && abs((float) ($row['smd'] ?? 0.0)) >= 0.1)),
            'high_imbalance_covariates' => count(array_filter($rows, fn ($row): bool => is_array($row) && abs((float) ($row['smd'] ?? 0.0)) >= 0.2)),
            'mean_absolute_smd' => round($meanAbs, 4),
        ];
    }

    /**
     * @param  array<int, mixed>  $rows
     * @return array<int, array<string, mixed>>
     */
    private function topRowsByAbsoluteValue(array $rows, string $key, int $limit): array
    {
        $filtered = array_values(array_filter($rows, fn ($row): bool => is_array($row)));
        usort($filtered, fn (array $a, array $b): int => abs((float) ($b[$key] ?? 0.0)) <=> abs((float) ($a[$key] ?? 0.0)));

        return array_slice($filtered, 0, $limit);
    }

    /**
     * @param  array<int, mixed>  $features
     * @return array<int, array<string, mixed>>
     */
    private function summarizeFeatures(mixed $features, int $limit): array
    {
        if (! is_array($features)) {
            return [];
        }

        $rows = array_values(array_filter($features, fn ($feature): bool => is_array($feature)));
        usort($rows, function (array $a, array $b): int {
            $aDelta = abs((float) ($a['prevalence'] ?? 0.0) - (float) ($a['overall_prevalence'] ?? 0.0));
            $bDelta = abs((float) ($b['prevalence'] ?? 0.0) - (float) ($b['overall_prevalence'] ?? 0.0));

            return $bDelta <=> $aDelta;
        });

        return array_map(fn (array $feature): array => [
            'concept_id' => $feature['concept_id'] ?? null,
            'name' => $feature['name'] ?? null,
            'prevalence' => $feature['prevalence'] ?? null,
            'overall_prevalence' => $feature['overall_prevalence'] ?? null,
        ], array_slice($rows, 0, $limit));
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function summarizeContext(array $context): array
    {
        return $this->redactPatientLevelData($context);
    }

    /**
     * @param  array<int, array<string, mixed>>  $priorStepSummaries
     * @return array<int, array<string, mixed>>
     */
    private function summarizePriorSteps(array $priorStepSummaries): array
    {
        return array_map(fn (array $step): array => [
            'step_id' => $step['step_id'] ?? null,
            'summary' => $step['summary'] ?? null,
            'status' => $step['status'] ?? null,
        ], array_slice($priorStepSummaries, 0, 8));
    }

    /**
     * @param  array<string, mixed>  $value
     * @return array<string, mixed>
     */
    private function redactPatientLevelData(array $value): array
    {
        $blockedKeys = [
            'person_id',
            'person_ids',
            'member_ids',
            'target_ids',
            'comparator_ids',
            'target_id',
            'comparator_id',
            'matched_pairs',
            'propensity_scores',
            'points',
            'edges',
            'assignments',
        ];

        $redact = function (mixed $item) use (&$redact, $blockedKeys): mixed {
            if (! is_array($item)) {
                return $item;
            }

            $output = [];
            foreach ($item as $key => $child) {
                if (is_string($key) && in_array($key, $blockedKeys, true)) {
                    $output[$key.'_count'] = is_array($child) ? count($child) : null;

                    continue;
                }
                $output[$key] = $redact($child);
            }

            return $output;
        };

        $redacted = $redact($value);

        return is_array($redacted) ? $redacted : [];
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function findCachedInterpretation(
        int $userId,
        string $mode,
        string $stepId,
        array $context,
        string $resultHash,
    ): ?PatientSimilarityInterpretation {
        $query = PatientSimilarityInterpretation::query()
            ->where('user_id', $userId)
            ->where('mode', $mode)
            ->where('step_id', $stepId)
            ->where('result_hash', $resultHash)
            ->where('status', 'interpreted');

        $this->applyInterpretationContext($query, $context);

        return $query->latest('updated_at')
            ->first();
    }

    private function linkCachedInterpretation(
        PatientSimilarityInterpretation $cached,
        ?int $runId,
        ?int $runStepId,
    ): PatientSimilarityInterpretation {
        if ($runId === null) {
            return $cached;
        }

        $linked = PatientSimilarityInterpretation::query()
            ->where('user_id', $cached->user_id)
            ->where('patient_similarity_run_id', $runId)
            ->where('step_id', $cached->step_id)
            ->where('result_hash', $cached->result_hash)
            ->first();

        if ($linked) {
            if ($runStepId !== null && $linked->patient_similarity_run_step_id !== $runStepId) {
                $linked->update(['patient_similarity_run_step_id' => $runStepId]);
                $linked->refresh();
            }

            return $linked;
        }

        return PatientSimilarityInterpretation::query()->create([
            'user_id' => $cached->user_id,
            'patient_similarity_run_id' => $runId,
            'patient_similarity_run_step_id' => $runStepId,
            'mode' => $cached->mode,
            'step_id' => $cached->step_id,
            'source_id' => $cached->source_id,
            'target_cohort_id' => $cached->target_cohort_id,
            'comparator_cohort_id' => $cached->comparator_cohort_id,
            'result_hash' => $cached->result_hash,
            'provider' => $cached->provider,
            'model' => $cached->model,
            'status' => $cached->status,
            'summary' => $cached->summary,
            'interpretation' => $cached->interpretation,
            'clinical_implications' => $cached->clinical_implications,
            'methodologic_cautions' => $cached->methodologic_cautions,
            'recommended_next_steps' => $cached->recommended_next_steps,
            'confidence' => $cached->confidence,
            'sanitized_result' => $cached->sanitized_result,
            'error' => $cached->error,
            'raw_response' => $cached->raw_response,
        ]);
    }

    /**
     * @param  array<string, mixed>  $response
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function persistIfPossible(
        array $response,
        ?int $userId,
        ?int $runId,
        ?int $runStepId,
        array $context,
    ): array {
        if ($userId === null) {
            return $response;
        }

        $interpretation = PatientSimilarityInterpretation::query()->updateOrCreate(
            [
                'user_id' => $userId,
                'patient_similarity_run_id' => $runId,
                'step_id' => (string) $response['step_id'],
                'result_hash' => (string) $response['result_hash'],
            ],
            [
                'patient_similarity_run_step_id' => $runStepId,
                'mode' => (string) $response['mode'],
                'source_id' => $context['source_id'] ?? null,
                'target_cohort_id' => $context['target_cohort_id'] ?? null,
                'comparator_cohort_id' => $context['comparator_cohort_id'] ?? null,
                'provider' => (string) $response['provider'],
                'model' => (string) $response['model'],
                'status' => (string) $response['status'],
                'summary' => (string) ($response['summary'] ?? ''),
                'interpretation' => (string) ($response['interpretation'] ?? ''),
                'clinical_implications' => $response['clinical_implications'] ?? [],
                'methodologic_cautions' => $response['methodologic_cautions'] ?? [],
                'recommended_next_steps' => $response['recommended_next_steps'] ?? [],
                'confidence' => $response['confidence'] ?? 0.0,
                'sanitized_result' => $response['sanitized_result'] ?? [],
                'error' => $response['error'] ?? null,
                'raw_response' => $response['raw_response'] ?? null,
            ],
        );

        return $interpretation->toInterpretationPayload((string) $response['cache_status']);
    }

    /**
     * @param  Builder<PatientSimilarityInterpretation>  $query
     * @param  array<string, mixed>  $context
     */
    private function applyInterpretationContext(Builder $query, array $context): void
    {
        foreach (['source_id', 'target_cohort_id', 'comparator_cohort_id'] as $key) {
            if (($context[$key] ?? null) === null) {
                $query->whereNull($key);
            } else {
                $query->where($key, $context[$key]);
            }
        }
    }

    private function normalizeForHash(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map(fn (mixed $item): mixed => $this->normalizeForHash($item), $value);
        }

        ksort($value);

        foreach ($value as $key => $item) {
            $value[$key] = $this->normalizeForHash($item);
        }

        return $value;
    }

    private function stepName(string $stepId): string
    {
        return match ($stepId) {
            'profile' => 'Profile Comparison',
            'balance' => 'Covariate Balance',
            'psm' => 'Propensity Score Matching',
            'landscape' => 'UMAP Landscape',
            'phenotypes' => 'Phenotype Discovery',
            'snf' => 'Network Fusion',
            'centroid' => 'Centroid Profile',
            'similar' => 'Similar Patients',
            default => $stepId,
        };
    }

    /**
     * @return array<int, string>
     */
    private function stringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values(array_map(fn ($item): string => (string) $item, $value));
    }

    /**
     * @param  array<int, float>  $values
     */
    private function median(array $values): ?float
    {
        if ($values === []) {
            return null;
        }

        sort($values);
        $count = count($values);
        $middle = intdiv($count, 2);

        if ($count % 2 === 1) {
            return round($values[$middle], 4);
        }

        return round(($values[$middle - 1] + $values[$middle]) / 2, 4);
    }

    private function clampConfidence(mixed $confidence): float
    {
        $value = is_numeric($confidence) ? (float) $confidence : 0.0;

        return max(0.0, min(1.0, $value));
    }

    /**
     * @return array<string, mixed>
     */
    private function extractJsonObject(string $content): array
    {
        $cleaned = trim($content);
        if (str_starts_with($cleaned, '```')) {
            $cleaned = trim($cleaned, "` \n\r\t");
            if (str_starts_with(strtolower($cleaned), 'json')) {
                $cleaned = trim(substr($cleaned, 4));
            }
        }

        $decoded = json_decode($cleaned, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($cleaned, '{');
        $end = strrpos($cleaned, '}');
        if ($start === false || $end === false || $end <= $start) {
            return [];
        }

        $decoded = json_decode(substr($cleaned, $start, $end - $start + 1), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * @return array{provider?: string, model?: string}
     */
    private function activeProviderMetadata(): array
    {
        try {
            $provider = AiProviderSetting::where('is_active', true)->first();
        } catch (\Throwable) {
            return [];
        }

        if (! $provider) {
            return [];
        }

        return [
            'provider' => $provider->provider_type,
            'model' => $provider->model,
        ];
    }
}
