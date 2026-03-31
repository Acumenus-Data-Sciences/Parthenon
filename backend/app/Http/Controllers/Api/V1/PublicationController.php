<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Http\Controllers\Controller;
use App\Http\Requests\PublicationExportRequest;
use App\Http\Requests\PublicationNarrativeRequest;
use App\Services\AI\AnalyticsLlmService;
use App\Services\Publication\PublicationService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @group Publication & Export
 */
class PublicationController extends Controller
{
    public function __construct(
        private readonly AnalyticsLlmService $llm,
        private readonly PublicationService $publicationService,
    ) {}

    /**
     * POST /api/v1/publish/narrative
     *
     * Generate AI-authored narrative text for a publication section.
     */
    public function narrative(PublicationNarrativeRequest $request): JsonResponse
    {
        $validated = $request->validated();
        /** @var string $sectionType */
        $sectionType = $validated['section_type'];
        /** @var array<string, mixed> $context */
        $context = $validated['context'];

        $context = $this->summarizeContext($context);
        $systemPrompt = $this->buildSystemPrompt($sectionType);
        $userPrompt = $this->buildUserPrompt($sectionType, $context);

        try {
            $text = $this->llm->chat(
                messages: [
                    ['role' => 'user', 'content' => $userPrompt],
                ],
                options: [
                    'system' => $systemPrompt,
                    'max_tokens' => 8192,
                    'temperature' => 0.3,
                ],
            );

            return response()->json([
                'data' => [
                    'text' => $text,
                    'section_type' => $sectionType,
                ],
            ]);
        } catch (AiProviderNotConfiguredException $e) {
            return response()->json([
                'message' => $e->getMessage(),
            ], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'AI narrative generation failed: '.$e->getMessage(),
            ], 503);
        }
    }

    /**
     * POST /api/v1/publish/export
     *
     * Export a publication document in the requested format (docx, pdf, figures-zip).
     */
    public function export(PublicationExportRequest $request): StreamedResponse|JsonResponse
    {
        $validated = $request->validated();

        try {
            return $this->publicationService->export($validated);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Export failed: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Build the system prompt for the LLM based on section type.
     */
    private function buildSystemPrompt(string $sectionType): string
    {
        $base = 'You are a senior clinical research writer producing publication-ready manuscript text '
            .'for an OHDSI observational study using the OMOP Common Data Model. '
            .'Write in formal academic prose suitable for a peer-reviewed journal (NEJM, Lancet, JAMA style). '
            .'Use passive voice and past tense. Never fabricate citations, statistics, or results. '
            .'Only reference data provided in the context. '
            .'IMPORTANT: Output plain text only. Do NOT use markdown formatting — no ##, **, *, ```, or any other markup. '
            .'Do not include section headings — the heading is already provided by the document template.';

        return match ($sectionType) {
            'methods' => $base.' Focus on study design, data source description, cohort definitions, '
                .'covariates, and statistical methods. Mention the OMOP CDM version and analysis framework (OHDSI HADES).',

            'results' => $base.' Report exact statistics from the analysis output. '
                ."Use hedging language ('was associated with' not 'caused'). "
                .'Include confidence intervals and p-values where available. '
                .'When multiple cohorts or outcomes are reported, present comparisons systematically. '
                .'Reference tables and figures by number (e.g., Table 1, Figure 2).',

            'discussion' => $base.' Discuss clinical significance of the findings, compare with prior literature, '
                .'address study limitations (unmeasured confounding, selection bias, generalizability, '
                .'immortal time bias if applicable), and suggest future research directions. '
                .'If multiple analyses are referenced, synthesize the findings into a coherent narrative.',

            'caption' => 'You are a medical research writer. Write a single-sentence figure caption. '
                .'Be specific about what is plotted, the axes, and the key takeaway.',

            default => $base,
        };
    }

    /**
     * Build the user prompt with analysis context data.
     *
     * @param  array<string, mixed>  $context
     */
    private function buildUserPrompt(string $sectionType, array $context): string
    {
        $contextJson = json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        return match ($sectionType) {
            'methods' => "Write the Methods section (2-3 paragraphs) based on this analysis context:\n\n{$contextJson}",
            'results' => "Write the Results subsection (1-3 paragraphs) based on this analysis output:\n\n{$contextJson}",
            'discussion' => "Write the Discussion section (2-4 paragraphs) synthesizing these findings:\n\n{$contextJson}",
            'caption' => "Write a figure caption based on this context:\n\n{$contextJson}",
            default => "Write a narrative summary of the following research context:\n\n{$contextJson}",
        };
    }

    /**
     * Summarize large context data to fit within LLM token limits.
     *
     * Raw result_json from characterizations can be 300KB+ (thousands of feature rows).
     * This method extracts the most meaningful summary while keeping the context under ~8K tokens.
     *
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function summarizeContext(array $context): array
    {
        // Summarize resultJson if it's large
        if (isset($context['resultJson']) && is_array($context['resultJson'])) {
            $context['resultJson'] = $this->summarizeResultJson($context['resultJson']);
        }

        // Summarize each item in groupedResults
        if (isset($context['groupedResults']) && is_array($context['groupedResults'])) {
            $context['groupedResults'] = array_map(function ($item) {
                if (is_array($item)) {
                    // Items from "all results" context (introduction/methods/discussion)
                    if (isset($item['resultJson']) && is_array($item['resultJson'])) {
                        $item['resultJson'] = $this->summarizeResultJson($item['resultJson']);
                    }
                    // Direct result objects (from grouped results sections)
                    if (isset($item['results']) || isset($item['outcomes'])) {
                        $item = $this->summarizeResultJson($item);
                    }
                }

                return $item;
            }, $context['groupedResults']);
        }

        return $context;
    }

    /**
     * Summarize a single result_json blob.
     *
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    private function summarizeResultJson(array $result): array
    {
        $jsonSize = strlen(json_encode($result));

        // If under 8KB, keep as-is
        if ($jsonSize < 8192) {
            return $result;
        }

        $summary = ['_summarized' => true, '_original_size_bytes' => $jsonSize];

        // ── Characterization results ────────────────────────────────────
        // Structure: results[].{cohort_id, cohort_name, person_count, features.{drugs[], conditions[], ...}}
        // + smd_X_vs_Y[] top-level SMD pair arrays
        if (isset($result['results']) && is_array($result['results'])) {
            $cohorts = [];
            foreach ($result['results'] as $r) {
                if (! is_array($r)) {
                    continue;
                }

                $cohortSummary = [
                    'cohort_id' => $r['cohort_id'] ?? null,
                    'cohort_name' => $r['cohort_name'] ?? null,
                    'person_count' => $r['person_count'] ?? 0,
                ];

                // Summarize features: keep top 10 per category by count
                if (isset($r['features']) && is_array($r['features'])) {
                    $featureSummary = [];
                    foreach ($r['features'] as $category => $features) {
                        if (! is_array($features)) {
                            continue;
                        }
                        // Sort by count desc, take top 5
                        usort($features, fn ($a, $b) => ($b['count'] ?? 0) <=> ($a['count'] ?? 0));
                        $featureSummary[$category] = array_map(
                            fn ($f) => [
                                'name' => $f['concept_name'] ?? $f['feature_name'] ?? 'unknown',
                                'count' => $f['count'] ?? $f['person_count'] ?? 0,
                                'percent' => $f['percent'] ?? $f['percent_value'] ?? null,
                            ],
                            array_slice($features, 0, 5),
                        );
                    }
                    $cohortSummary['top_features'] = $featureSummary;
                }

                // Extract strata for IR/estimation results
                if (isset($r['strata']) && is_array($r['strata'])) {
                    $cohortSummary['strata'] = array_map(
                        fn ($s) => is_array($s) ? array_intersect_key($s, array_flip([
                            'stratum_name', 'stratum_value', 'person_years',
                            'incidence_rate', 'event_count', 'person_count',
                        ])) : $s,
                        array_slice($r['strata'], 0, 20),
                    );
                }

                $cohorts[] = $cohortSummary;
            }
            $summary['cohorts'] = $cohorts;

            // Extract SMD pairs (top-level keys like smd_166_vs_165)
            $smdPairs = [];
            foreach ($result as $key => $value) {
                if (str_starts_with($key, 'smd_') && is_array($value)) {
                    // Sort by abs SMD, take top 20
                    usort($value, fn ($a, $b) => abs($b['smd'] ?? 0) <=> abs($a['smd'] ?? 0));
                    $smdPairs[$key] = array_map(
                        fn ($p) => [
                            'feature' => $p['feature_name'] ?? $p['concept_name'] ?? 'unknown',
                            'smd' => round((float) ($p['smd'] ?? 0), 3),
                            'category' => $p['category'] ?? null,
                        ],
                        array_slice($value, 0, 20),
                    );
                }
            }
            if (! empty($smdPairs)) {
                $summary['smd_pairs'] = $smdPairs;
            }
        }

        // ── Preserve structural keys ────────────────────────────────────
        foreach (['targetCohorts', 'comparatorCohorts', 'targetCohortId', 'comparatorCohortId', 'analysisName'] as $key) {
            if (isset($result[$key])) {
                $summary[$key] = $result[$key];
            }
        }

        // ── Outcomes (IR/estimation) — keep but trim rates ──────────────
        if (isset($result['outcomes']) && is_array($result['outcomes'])) {
            $summary['outcomes'] = array_map(function ($outcome) {
                if (! is_array($outcome)) {
                    return $outcome;
                }
                if (isset($outcome['rates']) && is_array($outcome['rates'])) {
                    $outcome['rates'] = array_slice($outcome['rates'], 0, 20);
                }

                return $outcome;
            }, $result['outcomes']);
        }

        return $summary;
    }
}
