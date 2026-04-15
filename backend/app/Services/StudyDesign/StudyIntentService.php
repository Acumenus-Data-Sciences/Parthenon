<?php

namespace App\Services\StudyDesign;

use App\Models\App\Study;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class StudyIntentService
{
    public function __construct(
        private readonly StudyDesignSpecValidator $validator,
    ) {}

    public function generate(Study $study, StudyDesignSession $session, string $researchQuestion, int $userId): StudyDesignVersion
    {
        $started = microtime(true);
        $provider = 'study-agent';
        $model = null;
        $aiPayload = [];
        $safetyFlags = [];

        try {
            $aiPayload = $this->callStudyAgent($researchQuestion);
        } catch (\Throwable $studyAgentException) {
            $safetyFlags[] = [
                'type' => 'provider_fallback',
                'message' => 'StudyAgent intent split failed; attempting Anthropic fallback if configured.',
            ];

            try {
                $provider = 'anthropic';
                $model = (string) config('services.anthropic.model');
                $aiPayload = $this->callAnthropic($study, $researchQuestion);
            } catch (\Throwable $anthropicException) {
                Log::warning('Study intent generation failed', [
                    'study_id' => $study->id,
                    'session_id' => $session->id,
                    'study_agent_error' => $studyAgentException->getMessage(),
                    'anthropic_error' => $anthropicException->getMessage(),
                ]);

                throw new RuntimeException('Unable to generate study intent. StudyAgent was unavailable and Anthropic fallback was not configured or failed.');
            }
        }

        $normalized = $this->validator->fromAiPayload($aiPayload, $study, $researchQuestion, $provider, $model);
        $latencyMs = (int) round((microtime(true) - $started) * 1000);

        return DB::transaction(function () use ($session, $userId, $normalized, $aiPayload, $researchQuestion, $provider, $model, $latencyMs, $safetyFlags): StudyDesignVersion {
            $versionNumber = ((int) $session->versions()->max('version_number')) + 1;
            $status = ($normalized['lint']['status'] ?? 'needs_review') === 'ready' ? 'review_ready' : 'draft';

            /** @var StudyDesignVersion $version */
            $version = $session->versions()->create([
                'version_number' => $versionNumber,
                'status' => $status,
                'spec_json' => $normalized['spec'],
                'normalized_spec_json' => $normalized['spec'],
                'lint_results_json' => $normalized['lint'],
                'ai_model_metadata_json' => [
                    'provider' => $provider,
                    'model' => $model,
                    'prompt_template_version' => 'study-intent-v1',
                ],
                'created_by' => $userId,
            ]);

            $session->update([
                'active_version_id' => $version->id,
                'status' => 'reviewing',
            ]);

            StudyDesignAiEvent::create([
                'session_id' => $session->id,
                'version_id' => $version->id,
                'created_by' => $userId,
                'event_type' => 'intent_extract',
                'provider' => $provider,
                'model' => $model,
                'prompt_template_version' => 'study-intent-v1',
                'input_summary_json' => [
                    'research_question_length' => strlen($researchQuestion),
                    'research_question_hash' => hash('sha256', $researchQuestion),
                ],
                'output_json' => [
                    'raw' => $aiPayload,
                    'normalized' => $normalized['spec'],
                    'lint' => $normalized['lint'],
                ],
                'safety_flags_json' => $safetyFlags,
                'latency_ms' => $latencyMs,
            ]);

            return $version->fresh(['creator', 'aiEvents']);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function callStudyAgent(string $researchQuestion): array
    {
        $baseUrl = rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');
        $response = Http::timeout(60)->post("{$baseUrl}/study-agent/intent/split", [
            'intent' => $researchQuestion,
        ]);

        if ($response->failed()) {
            throw new RuntimeException('StudyAgent returned HTTP '.$response->status());
        }

        $json = $response->json();

        return is_array($json) ? $json : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function callAnthropic(Study $study, string $researchQuestion): array
    {
        $apiKey = (string) config('services.anthropic.key');
        if ($apiKey === '') {
            throw new RuntimeException('Anthropic API key is not configured.');
        }

        $model = (string) config('services.anthropic.model', 'claude-sonnet-4-6');
        $timeout = (int) config('services.anthropic.timeout', 60);

        $system = <<<'PROMPT'
You extract OHDSI observational study intent. Return only compact JSON with these keys:
target_population, exposure, comparator, outcome, time, study_type, study_design, primary_objective, hypothesis, scientific_rationale, open_questions.
Use empty strings for missing fields and open_questions for ambiguity. Do not invent OMOP concept IDs.
PROMPT;

        $response = Http::timeout($timeout)
            ->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => $model,
                'max_tokens' => 1200,
                'system' => $system,
                'messages' => [
                    [
                        'role' => 'user',
                        'content' => json_encode([
                            'study_title' => $study->title,
                            'current_study_type' => $study->study_type,
                            'research_question' => $researchQuestion,
                        ], JSON_THROW_ON_ERROR),
                    ],
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Anthropic returned HTTP '.$response->status());
        }

        $content = $response->json('content.0.text');
        if (! is_string($content)) {
            throw new RuntimeException('Anthropic response did not contain text content.');
        }

        $decoded = json_decode($content, true);
        if (! is_array($decoded)) {
            throw new RuntimeException('Anthropic response was not valid JSON.');
        }

        return $decoded;
    }
}
