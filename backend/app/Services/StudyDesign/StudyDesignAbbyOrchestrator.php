<?php

namespace App\Services\StudyDesign;

use App\Models\App\AiProviderSetting;
use App\Models\App\Study;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use RuntimeException;

class StudyDesignAbbyOrchestrator
{
    public const PROTOCOL_SOURCE = 'protocol_upload_abby';

    public const PROTOCOL_PROMPT_VERSION = 'study-design-protocol-v2';

    public const PROTOCOL_CLOUD_SCOPE = 'study_design_protocol_import';

    public function __construct(
        private readonly StudyDesignStructuredOutputSchemas $schemas,
        private readonly StudyDesignContextBuilder $contextBuilder,
        private readonly StudyDesignToolRunner $toolRunner,
        private readonly StudyDesignGuidanceService $guidanceService,
        private readonly StudyDesignOllamaClient $ollamaClient,
        private readonly StudyDesignClaudeClient $claudeClient,
    ) {}

    /**
     * @param  array{max_assets?: int, max_ai_events?: int, max_artifacts?: int}  $options
     * @return array<string, mixed>
     */
    public function studyDesignContext(Study $study, StudyDesignSession $session, ?StudyDesignVersion $version = null, array $options = []): array
    {
        return $this->contextBuilder->build($study, $session, $version, $options);
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function runTool(string $tool, array $arguments = []): array
    {
        return $this->toolRunner->run($tool, $arguments);
    }

    /**
     * @return array<string, mixed>
     */
    public function studyDesignGuidance(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        return $this->guidanceService->build($study, $session, $version);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function runLocalHarness(string $task, array $payload, array $options = []): array
    {
        $result = $this->ollamaClient->runJsonTask($task, $payload, $options);
        /** @var array<string, mixed> $output */
        $output = is_array($result['output'] ?? null) ? $result['output'] : [];
        $result['output'] = $this->schemas->validateLocalHarnessOutput($task, $output);

        return $result;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function validateDraftAssetInputs(array $payload): array
    {
        return $this->schemas->validateDraftAssetInputs($payload);
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function structuredOutputSchemas(): array
    {
        return $this->schemas->catalog();
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array{
     *   extracted: array<string, mixed>,
     *   evaluator: array{api_key: string, model: string, harness_model: string},
     *   provider: string,
     *   model: string,
     *   prompt_version: string,
     *   cloud_scope: string
     * }
     */
    public function evaluateProtocol(Study $study, string $protocolText, array $metadata): array
    {
        $evaluator = $this->protocolEvaluatorSettings();
        $rawExtraction = $this->callProtocolEvaluator($study, $protocolText, $metadata, $evaluator);
        $extracted = $this->schemas->validateProtocolExtraction($rawExtraction);

        return [
            'extracted' => $extracted,
            'evaluator' => $evaluator,
            'provider' => 'anthropic',
            'model' => $evaluator['model'],
            'prompt_version' => self::PROTOCOL_PROMPT_VERSION,
            'cloud_scope' => self::PROTOCOL_CLOUD_SCOPE,
        ];
    }

    /**
     * @param  array<string, mixed>  $evaluation
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function protocolProvenance(array $evaluation, array $metadata): array
    {
        $evaluator = $this->evaluatorFromEvaluation($evaluation);

        return [
            'source' => self::PROTOCOL_SOURCE,
            'orchestrator' => 'abby',
            'harness_provider' => 'ollama',
            'harness_model' => $evaluator['harness_model'],
            'evaluator_provider' => $evaluation['provider'] ?? 'anthropic',
            'evaluator_model' => $evaluator['model'],
            'cloud_scope' => self::PROTOCOL_CLOUD_SCOPE,
            'prompt_version' => self::PROTOCOL_PROMPT_VERSION,
            'requires_human_review' => true,
            'created_at' => now()->toISOString(),
            'protocol_file' => $metadata,
        ];
    }

    /**
     * @param  array<string, mixed>  $evaluation
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function protocolAiEventInput(array $evaluation, array $metadata): array
    {
        $evaluator = $this->evaluatorFromEvaluation($evaluation);

        return [
            'orchestrator' => 'abby',
            'harness_provider' => 'ollama',
            'harness_model' => $evaluator['harness_model'],
            'evaluator_provider' => $evaluation['provider'] ?? 'anthropic',
            'evaluator_model' => $evaluator['model'],
            'cloud_scope' => self::PROTOCOL_CLOUD_SCOPE,
            'prompt_version' => self::PROTOCOL_PROMPT_VERSION,
            'protocol_file' => $metadata,
            'raw_protocol_text_stored' => false,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function protocolSafetyFlags(): array
    {
        return [
            'requires_human_review' => true,
            'raw_document_not_persisted' => true,
            'no_omop_concept_ids_requested' => true,
            'ordinary_abby_chat_stays_local' => ! (bool) config('services.abby.cloud_routing_enabled', false),
            'cloud_evaluation_scoped_to_protocol_import' => true,
            'protocol_prompt_caching_enabled' => (bool) config('services.abby.protocol_prompt_caching_enabled', false),
        ];
    }

    /**
     * @return array{api_key: string, model: string, harness_model: string}
     */
    private function protocolEvaluatorSettings(): array
    {
        if (! (bool) config('services.abby.protocol_cloud_evaluation_enabled', true)) {
            throw new RuntimeException('Abby protocol cloud evaluation is disabled. Set ABBY_PROTOCOL_CLOUD_EVALUATION_ENABLED=true to allow research-grade evaluation of uploaded protocols while ordinary Abby chat remains local.');
        }

        $provider = AiProviderSetting::query()
            ->where('provider_type', 'anthropic')
            ->where('is_enabled', true)
            ->orderByDesc('is_active')
            ->first();

        /** @var array<string, string> $providerSettings */
        $providerSettings = $provider?->settings ?? [];

        $apiKey = trim((string) ($providerSettings['api_key'] ?? ''));
        if ($apiKey === '') {
            $apiKey = trim((string) config('services.anthropic.key'));
        }

        if ($apiKey === '') {
            throw new RuntimeException('Abby protocol evaluator is not configured. Add a protocol evaluator API key in System Health > AI Providers.');
        }

        $model = trim((string) ($provider?->model ?? ''));
        if ($model === '') {
            $model = trim((string) config('services.anthropic.model', 'claude-opus-4-7'));
        }

        return [
            'api_key' => $apiKey,
            'model' => $model !== '' ? $model : 'claude-opus-4-7',
            'harness_model' => trim((string) config('services.abby.ollama_model', 'puyangwang/medgemma-27b-it:q4_0')),
        ];
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @param  array{api_key: string, model: string, harness_model: string}  $evaluator
     * @return array<string, mixed>
     */
    private function callProtocolEvaluator(Study $study, string $protocolText, array $metadata, array $evaluator): array
    {
        $system = <<<'PROMPT'
You are Claude acting as Abby's research-grade protocol evaluator for an OHDSI/OMOP Study Designer.
Abby is the user-facing local harness. You perform the deep protocol interpretation task only.
Use the extract_protocol tool with only values supported by the protocol.
Extract only values supported by the protocol. Use empty strings or empty arrays when absent.
Do not invent OMOP concept IDs, cohort IDs, or analysis IDs.
For each extracted PICO/intent value, include evidence_spans with the supported quote or concise excerpt, field name, protocol section/page when available, and confidence from 0.0 to 1.0.
Include a confidence object with field-level confidence, uncertainty entries for ambiguous protocol details, and design_assumptions only when the protocol forces an assumption that must be ratified by a user.
If the protocol lacks enough detail to support initial Study Design gates, set initial_gate.status to fail and list specific issues with field, severity, message, and evidence when available.
Initial gates require a research question, objective, population, exposure/index event, primary outcome, and usable time-at-risk. Comparator may be empty only when the protocol is clearly descriptive or single-arm.
Return a complete analysis_plan array for every analysis family supported by the protocol.
Use characterization for baseline descriptives when cohort characterization is applicable.
Use incidence_rate for incidence or prevalence estimation, pathway for treatment sequences,
estimation for comparative effectiveness or population-level effect estimation, prediction for
patient-level risk prediction, sccs for self-controlled case series safety questions,
self_controlled_cohort for self-controlled cohort designs, and evidence_synthesis for
multi-source or meta-analytic evidence synthesis.
PROMPT;

        $requestBody = [
            'model' => $evaluator['model'],
            'max_tokens' => 5000,
            'system' => $system,
            'tools' => [$this->protocolExtractionTool()],
            'tool_choice' => [
                'type' => 'tool',
                'name' => 'extract_protocol',
            ],
            'messages' => [
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'study' => [
                            'title' => $study->title,
                            'study_type' => $study->study_type,
                            'study_design' => $study->study_design,
                            'primary_objective' => $study->primary_objective,
                        ],
                        'protocol_file' => [
                            'filename' => $metadata['filename'],
                            'extension' => $metadata['extension'],
                            'truncated_for_ai' => $metadata['truncated_for_ai'] ?? false,
                        ],
                        'protocol_text' => $protocolText,
                    ], JSON_THROW_ON_ERROR),
                ],
            ],
        ];

        $cacheControl = $this->protocolPromptCacheControl();
        if ($cacheControl !== null) {
            $requestBody['cache_control'] = $cacheControl;
        }

        $response = $this->claudeClient->createMessage($requestBody, $evaluator['api_key']);

        if (($response['stop_reason'] ?? null) === 'max_tokens') {
            throw new RuntimeException('Abby protocol evaluator was truncated before structured output completed.');
        }

        $content = $response['content'] ?? null;
        if ($this->containsRefusal($content)) {
            throw new RuntimeException('Abby protocol evaluator refused the protocol extraction request.');
        }

        $toolInput = $this->decodeToolInput($content);
        if ($toolInput !== []) {
            return $toolInput;
        }

        $textContent = data_get($response, 'content.0.text');
        if (! is_string($textContent) || trim($textContent) === '') {
            throw new RuntimeException('Abby protocol evaluator did not return protocol extraction data.');
        }

        $decoded = $this->decodeJsonContent($textContent);
        if ($decoded === []) {
            throw new RuntimeException('Abby protocol evaluator did not return usable JSON.');
        }

        return $decoded;
    }

    /**
     * @return array<string, mixed>
     */
    private function protocolExtractionTool(): array
    {
        return [
            'name' => 'extract_protocol',
            'description' => 'Extract OHDSI/OMOP Study Designer fields from an observational health research protocol.',
            'input_schema' => $this->schemas->protocolExtractionSchema(),
        ];
    }

    /**
     * @return array{type: string, ttl?: string}|null
     */
    private function protocolPromptCacheControl(): ?array
    {
        if (! (bool) config('services.abby.protocol_prompt_caching_enabled', false)) {
            return null;
        }

        $ttl = trim((string) config('services.abby.protocol_prompt_cache_ttl', '5m'));
        $cacheControl = ['type' => 'ephemeral'];
        if ($ttl === '1h') {
            $cacheControl['ttl'] = '1h';
        }

        return $cacheControl;
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeToolInput(mixed $content): array
    {
        if (! is_array($content)) {
            return [];
        }

        foreach ($content as $block) {
            if (
                is_array($block)
                && ($block['type'] ?? null) === 'tool_use'
                && ($block['name'] ?? null) === 'extract_protocol'
                && isset($block['input'])
                && is_array($block['input'])
            ) {
                return $block['input'];
            }
        }

        return [];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeJsonContent(string $content): array
    {
        $content = trim($content);
        $decoded = json_decode($content, true);

        if (is_array($decoded)) {
            return $decoded;
        }

        if (preg_match('/\{.*\}/s', $content, $matches) === 1) {
            $decoded = json_decode($matches[0], true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }

    private function containsRefusal(mixed $content): bool
    {
        if (! is_array($content)) {
            return false;
        }

        foreach ($content as $block) {
            if (! is_array($block) || ! is_string($block['text'] ?? null)) {
                continue;
            }

            $text = strtolower($block['text']);
            if (
                str_contains($text, "i can't")
                || str_contains($text, 'i cannot')
                || str_contains($text, 'unable to comply')
                || str_contains($text, 'refuse')
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $evaluation
     * @return array{api_key: string, model: string, harness_model: string}
     */
    private function evaluatorFromEvaluation(array $evaluation): array
    {
        /** @var array{api_key: string, model: string, harness_model: string}|null $evaluator */
        $evaluator = $evaluation['evaluator'] ?? null;

        if (! is_array($evaluator)) {
            throw new RuntimeException('Abby protocol evaluation metadata is incomplete.');
        }

        return $evaluator;
    }
}
