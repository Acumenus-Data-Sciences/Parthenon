<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\AiProviderNotConfiguredException;
use App\Http\Controllers\Controller;
use App\Http\Requests\PublicationExportRequest;
use App\Http\Requests\PublicationNarrativeRequest;
use App\Services\AI\AnalyticsLlmService;
use App\Services\Publication\PublicationService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Group('Publication & Export', weight: 80)]
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
            .'Only reference data provided in the context.';

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
}
