<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PublicationExportRequest;
use App\Http\Requests\PublicationNarrativeRequest;
use App\Services\AiService;
use App\Services\Publication\PublicationService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Group('Publication & Export', weight: 80)]
class PublicationController extends Controller
{
    public function __construct(
        private readonly AiService $aiService,
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

        $prompt = $this->buildNarrativePrompt($sectionType, $context);

        try {
            $response = $this->aiService->abbyChat(
                message: $prompt,
                pageContext: 'publication',
                pageData: $context,
            );

            $text = $response['reply'] ?? '';

            return response()->json([
                'data' => [
                    'text' => $text,
                    'section_type' => $sectionType,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'AI service is unavailable. Please try again later.',
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
     * Build a section-specific prompt for AI narrative generation.
     *
     * @param  array<string, mixed>  $context
     */
    private function buildNarrativePrompt(string $sectionType, array $context): string
    {
        $contextJson = json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        return match ($sectionType) {
            'methods' => 'You are a medical research writer drafting the Methods section of an observational study manuscript. '
                .'Write 2-3 paragraphs in passive voice, past tense. Do not make causal claims. Do not fabricate citations. '
                ."Describe the study design, data source, cohort definitions, covariates, and statistical methods based on the following context:\n\n{$contextJson}",

            'results' => 'You are a medical research writer drafting the Results section of an observational study manuscript. '
                ."Write 1-2 paragraphs reporting exact statistics from the analysis output. Use hedging language (e.g., 'was associated with' rather than 'caused'). "
                ."Report confidence intervals and p-values where available. Base your narrative on the following context:\n\n{$contextJson}",

            'discussion' => 'You are a medical research writer drafting the Discussion section of an observational study manuscript. '
                .'Write 2-3 paragraphs discussing clinical significance of the findings, comparison with prior literature, study limitations '
                .'(including unmeasured confounding, selection bias, and generalizability), and future research directions. '
                ."Base your narrative on the following context:\n\n{$contextJson}",

            'caption' => 'You are a medical research writer. Write a single-sentence figure caption that concisely describes '
                .'the visualization shown. Be specific about what is plotted, the axes, and the key takeaway. '
                ."Base your caption on the following context:\n\n{$contextJson}",

            default => "Summarize the following research context:\n\n{$contextJson}",
        };
    }
}
