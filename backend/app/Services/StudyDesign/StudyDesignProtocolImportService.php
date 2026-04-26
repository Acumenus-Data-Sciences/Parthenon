<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\AiProviderSetting;
use App\Models\App\Study;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PhpOffice\PhpWord\Element\AbstractContainer;
use PhpOffice\PhpWord\Element\AbstractElement;
use PhpOffice\PhpWord\Element\ListItem;
use PhpOffice\PhpWord\Element\Table;
use PhpOffice\PhpWord\IOFactory;
use RuntimeException;
use Symfony\Component\Process\Process;

class StudyDesignProtocolImportService
{
    private const MAX_PROTOCOL_CHARS = 80000;

    /**
     * @return array{version: StudyDesignVersion, extracted: array<string, mixed>, metadata: array<string, mixed>}
     */
    public function import(Study $study, StudyDesignSession $session, UploadedFile $file, int $userId): array
    {
        $metadata = $this->fileMetadata($file);
        $text = $this->extractText($file, (string) $metadata['extension']);
        $text = $this->normalizeExtractedText($text);

        if ($text === '') {
            throw new RuntimeException('No readable protocol text could be extracted from the uploaded file.');
        }

        $truncated = strlen($text) > self::MAX_PROTOCOL_CHARS;
        $promptText = $truncated ? substr($text, 0, self::MAX_PROTOCOL_CHARS) : $text;
        $metadata['text_sha256'] = hash('sha256', $text);
        $metadata['text_length'] = strlen($text);
        $metadata['truncated_for_ai'] = $truncated;

        $anthropic = $this->anthropicSettings();
        $model = $anthropic['model'];
        $extracted = $this->callClaude($study, $promptText, $metadata, $anthropic['api_key'], $model);
        $intent = $this->toIntent($study, $extracted, $metadata);
        $normalizedSpec = $this->toNormalizedSpec($study, $intent, $extracted, $metadata);
        $status = $this->isReviewReady($intent) ? 'review_ready' : 'draft';

        $version = DB::transaction(function () use ($session, $userId, $intent, $normalizedSpec, $metadata, $extracted, $model, $status): StudyDesignVersion {
            $versionNumber = ((int) $session->versions()->max('version_number')) + 1;

            /** @var StudyDesignVersion $version */
            $version = $session->versions()->create([
                'version_number' => $versionNumber,
                'status' => $status,
                'intent_json' => $intent,
                'normalized_spec_json' => $normalizedSpec,
                'provenance_json' => [
                    'source' => 'protocol_upload_claude',
                    'provider' => 'anthropic',
                    'model' => $model,
                    'requires_human_review' => true,
                    'created_at' => now()->toISOString(),
                    'protocol_file' => $metadata,
                ],
            ]);

            $session->update([
                'active_version_id' => $version->id,
                'status' => 'reviewing',
                'source_mode' => 'protocol_upload',
                'settings_json' => array_merge($session->settings_json ?? [], [
                    'last_protocol_upload' => [
                        'filename' => $metadata['filename'],
                        'imported_at' => now()->toISOString(),
                    ],
                ]),
            ]);

            StudyDesignAiEvent::create([
                'session_id' => $session->id,
                'version_id' => $version->id,
                'event_type' => 'protocol_import',
                'provider' => 'anthropic',
                'model' => $model,
                'prompt_sha256' => hash('sha256', 'study-design-protocol-v1'.$metadata['text_sha256']),
                'input_json' => [
                    'protocol_file' => $metadata,
                    'raw_protocol_text_stored' => false,
                ],
                'output_json' => [
                    'extracted' => $extracted,
                    'intent' => $intent,
                    'normalized_spec' => $normalizedSpec,
                ],
                'safety_json' => [
                    'requires_human_review' => true,
                    'raw_document_not_persisted' => true,
                    'no_omop_concept_ids_requested' => true,
                ],
                'created_by' => $userId,
            ]);

            foreach ($this->draftAssets($extracted) as $asset) {
                $session->assets()->create(array_merge([
                    'version_id' => $version->id,
                    'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
                    'verification_status' => StudyDesignVerificationStatus::UNVERIFIED->value,
                    'provenance_json' => [
                        'source' => 'protocol_upload_claude',
                        'provider' => 'anthropic',
                        'version_id' => $version->id,
                    ],
                ], $asset));
            }

            return $version->fresh();
        });

        return [
            'version' => $version,
            'extracted' => $extracted,
            'metadata' => $metadata,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function fileMetadata(UploadedFile $file): array
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: $file->extension() ?: '');
        $allowed = ['doc', 'docx', 'pdf', 'md', 'markdown'];

        if (! in_array($extension, $allowed, true)) {
            throw new RuntimeException('Protocol uploads must be .doc, .docx, .pdf, or .md files.');
        }

        return [
            'filename' => $file->getClientOriginalName(),
            'extension' => $extension,
            'mime_type' => $file->getClientMimeType(),
            'size_bytes' => $file->getSize(),
        ];
    }

    private function extractText(UploadedFile $file, string $extension): string
    {
        $path = $file->getRealPath();
        if (! is_string($path) || $path === '') {
            throw new RuntimeException('Uploaded protocol file was not readable.');
        }

        return match ($extension) {
            'md', 'markdown' => (string) file_get_contents($path),
            'doc' => $this->extractLegacyDocText($path),
            'docx' => $this->extractWordText($path),
            'pdf' => $this->extractPdfText($path),
            default => '',
        };
    }

    private function extractLegacyDocText(string $path): string
    {
        if (! $this->commandExists('antiword')) {
            throw new RuntimeException('Legacy .doc protocol import requires antiword on the application server.');
        }

        $process = new Process(['antiword', $path]);
        $process->setTimeout(60);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException('Unable to extract text from the uploaded .doc protocol.');
        }

        return $process->getOutput();
    }

    private function extractWordText(string $path): string
    {
        try {
            $document = IOFactory::load($path);
        } catch (\Throwable $exception) {
            throw new RuntimeException('Unable to read the uploaded Word protocol: '.$exception->getMessage(), previous: $exception);
        }

        $parts = [];
        foreach ($document->getSections() as $section) {
            foreach ($section->getElements() as $element) {
                $this->collectElementText($element, $parts);
            }
        }

        return implode("\n", array_filter($parts, fn (string $part) => trim($part) !== ''));
    }

    private function extractPdfText(string $path): string
    {
        if (! $this->commandExists('pdftotext')) {
            throw new RuntimeException('PDF protocol import requires pdftotext on the application server.');
        }

        $process = new Process(['pdftotext', '-layout', '-enc', 'UTF-8', $path, '-']);
        $process->setTimeout(60);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException('Unable to extract text from the uploaded PDF protocol.');
        }

        return $process->getOutput();
    }

    /**
     * @param  list<string>  $parts
     */
    private function collectElementText(AbstractElement $element, array &$parts): void
    {
        if ($element instanceof Table) {
            foreach ($element->getRows() as $row) {
                foreach ($row->getCells() as $cell) {
                    foreach ($cell->getElements() as $child) {
                        $this->collectElementText($child, $parts);
                    }
                }
            }

            return;
        }

        if ($element instanceof ListItem) {
            $text = $element->getText();
            if (is_string($text) && trim($text) !== '') {
                $parts[] = $text;
            }

            return;
        }

        if ($element instanceof AbstractContainer) {
            foreach ($element->getElements() as $child) {
                $this->collectElementText($child, $parts);
            }

            return;
        }

        if (method_exists($element, 'getText')) {
            $text = $element->getText();
            if (is_scalar($text) && trim((string) $text) !== '') {
                $parts[] = (string) $text;
            }
        }
    }

    private function commandExists(string $command): bool
    {
        $process = Process::fromShellCommandline('command -v '.escapeshellarg($command));
        $process->setTimeout(5);
        $process->run();

        return $process->isSuccessful() && trim($process->getOutput()) !== '';
    }

    private function normalizeExtractedText(string $text): string
    {
        $text = str_replace("\0", '', $text);
        $text = preg_replace("/[ \t]+/", ' ', $text) ?? $text;
        $text = preg_replace("/\R{3,}/", "\n\n", $text) ?? $text;

        return trim($text);
    }

    /**
     * @return array{api_key: string, model: string}
     */
    private function anthropicSettings(): array
    {
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
            throw new RuntimeException('Anthropic API key is not configured. Add it in System Health > AI Providers.');
        }

        $model = trim((string) ($provider?->model ?? ''));
        if ($model === '') {
            $model = trim((string) config('services.anthropic.model', 'claude-sonnet-4-6'));
        }

        return [
            'api_key' => $apiKey,
            'model' => $model !== '' ? $model : 'claude-sonnet-4-6',
        ];
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function callClaude(Study $study, string $protocolText, array $metadata, string $apiKey, string $model): array
    {
        $system = <<<'PROMPT'
You evaluate observational health research protocols for an OHDSI/OMOP Study Designer.
Return only valid JSON. Do not include markdown fences or commentary.
Extract only values supported by the protocol. Use empty strings or empty arrays when absent.
Do not invent OMOP concept IDs, cohort IDs, or analysis IDs.
Schema:
{
  "research_question": "",
  "primary_objective": "",
  "population": "",
  "exposure": "",
  "comparator": "",
  "outcome": "",
  "time_at_risk": "",
  "study_type": "",
  "study_design": "",
  "hypothesis": "",
  "scientific_rationale": "",
  "concept_set_drafts": [{"title": "", "role": "", "domain": "", "clinical_rationale": "", "search_terms": []}],
  "cohort_definition_drafts": [{"title": "", "role": "", "description": "", "entry_event": "", "exit_strategy": ""}],
  "analysis_plan": [{"title": "", "analysis_type": "", "hades_package": "", "rationale": ""}],
  "feasibility_plan": {"summary": "", "minimum_cell_count": null, "source_requirements": []},
  "validation_plan": {"summary": "", "checks": []},
  "publication_plan": {"summary": "", "outputs": []},
  "open_questions": [{"field": "", "question": "", "severity": "review"}],
  "risk_notes": []
}
PROMPT;

        $response = Http::timeout((int) config('services.anthropic.timeout', 120))
            ->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])
            ->post('https://api.anthropic.com/v1/messages', [
                'model' => $model,
                'max_tokens' => 3000,
                'temperature' => 0,
                'system' => $system,
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
            ]);

        if ($response->failed()) {
            $message = $response->json('error.message');
            if (! is_string($message) || $message === '') {
                $message = $response->body();
            }

            throw new RuntimeException('Anthropic protocol evaluation returned HTTP '.$response->status().': '.$message);
        }

        $content = $response->json('content.0.text');
        if (! is_string($content) || trim($content) === '') {
            throw new RuntimeException('Anthropic protocol evaluation did not return text.');
        }

        $decoded = $this->decodeJsonContent($content);
        if ($decoded === []) {
            throw new RuntimeException('Anthropic protocol evaluation did not return usable JSON.');
        }

        return $decoded;
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

    /**
     * @param  array<string, mixed>  $extracted
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function toIntent(Study $study, array $extracted, array $metadata): array
    {
        $researchQuestion = $this->text($extracted['research_question'] ?? '')
            ?: $this->text($extracted['primary_objective'] ?? '')
            ?: ($study->primary_objective ?: $study->description ?: $study->title);

        return [
            'research_question' => $researchQuestion,
            'study_title' => $study->title,
            'source' => 'protocol_upload',
            'analysis_family' => $this->text($extracted['study_type'] ?? '') ?: ($study->study_type ?: 'custom'),
            'primary_objective' => $this->text($extracted['primary_objective'] ?? '') ?: $researchQuestion,
            'hypothesis' => $this->text($extracted['hypothesis'] ?? ''),
            'scientific_rationale' => $this->text($extracted['scientific_rationale'] ?? ''),
            'pico' => [
                'population' => $this->text($extracted['population'] ?? ''),
                'intervention' => $this->text($extracted['exposure'] ?? ''),
                'comparator' => $this->text($extracted['comparator'] ?? ''),
                'outcome' => $this->text($extracted['outcome'] ?? ''),
                'time_at_risk' => $this->text($extracted['time_at_risk'] ?? ''),
            ],
            'open_questions' => $this->list($extracted['open_questions'] ?? []),
            'risk_notes' => $this->list($extracted['risk_notes'] ?? []),
            'known_gaps' => ['Protocol-derived fields require ratification before downstream materialization.'],
            'protocol_import' => [
                'filename' => $metadata['filename'],
                'text_sha256' => $metadata['text_sha256'],
                'truncated_for_ai' => $metadata['truncated_for_ai'],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $intent
     * @param  array<string, mixed>  $extracted
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function toNormalizedSpec(Study $study, array $intent, array $extracted, array $metadata): array
    {
        $pico = $intent['pico'];

        return [
            'schema_version' => '1.0',
            'study' => [
                'title' => $study->title,
                'short_title' => $study->short_title,
                'research_question' => $intent['research_question'],
                'primary_objective' => $intent['primary_objective'],
                'scientific_rationale' => $intent['scientific_rationale'],
                'hypothesis' => $intent['hypothesis'],
                'study_design' => $this->text($extracted['study_design'] ?? '') ?: ($study->study_design ?: 'observational'),
                'study_type' => $intent['analysis_family'],
                'target_population_summary' => $pico['population'],
            ],
            'pico' => $pico,
            'concept_set_drafts' => $this->list($extracted['concept_set_drafts'] ?? []),
            'cohort_definition_drafts' => $this->list($extracted['cohort_definition_drafts'] ?? []),
            'analysis_plan' => $this->list($extracted['analysis_plan'] ?? []),
            'feasibility_plan' => $this->object($extracted['feasibility_plan'] ?? []),
            'validation_plan' => $this->object($extracted['validation_plan'] ?? []),
            'publication_plan' => $this->object($extracted['publication_plan'] ?? []),
            'open_questions' => $intent['open_questions'],
            'risk_notes' => $intent['risk_notes'],
            'protocol_import' => [
                'filename' => $metadata['filename'],
                'mime_type' => $metadata['mime_type'],
                'size_bytes' => $metadata['size_bytes'],
                'text_length' => $metadata['text_length'],
                'truncated_for_ai' => $metadata['truncated_for_ai'],
            ],
            'standards' => ['OMOP CDM', 'OHDSI ATLAS/Circe cohort conventions', 'HADES package manifest'],
        ];
    }

    /**
     * @param  array<string, mixed>  $extracted
     * @return list<array<string, mixed>>
     */
    private function draftAssets(array $extracted): array
    {
        $assets = [];

        foreach ($this->list($extracted['concept_set_drafts'] ?? []) as $draft) {
            if (! is_array($draft)) {
                continue;
            }
            $assets[] = [
                'asset_type' => 'concept_set_draft',
                'role' => $this->text($draft['role'] ?? '') ?: 'population',
                'draft_payload_json' => [
                    'title' => $this->text($draft['title'] ?? '') ?: 'Protocol concept set draft',
                    'role' => $this->text($draft['role'] ?? '') ?: 'population',
                    'domain' => $this->text($draft['domain'] ?? ''),
                    'clinical_rationale' => $this->text($draft['clinical_rationale'] ?? ''),
                    'search_terms' => $this->stringList($draft['search_terms'] ?? []),
                    'concepts' => [],
                ],
            ];
        }

        foreach ($this->list($extracted['cohort_definition_drafts'] ?? []) as $draft) {
            if (! is_array($draft)) {
                continue;
            }
            $assets[] = [
                'asset_type' => 'cohort_draft',
                'role' => $this->text($draft['role'] ?? '') ?: 'target',
                'draft_payload_json' => [
                    'title' => $this->text($draft['title'] ?? '') ?: 'Protocol cohort draft',
                    'role' => $this->text($draft['role'] ?? '') ?: 'target',
                    'description' => $this->text($draft['description'] ?? ''),
                    'entry_event' => $this->text($draft['entry_event'] ?? ''),
                    'exit_strategy' => $this->text($draft['exit_strategy'] ?? ''),
                ],
            ];
        }

        foreach ($this->list($extracted['analysis_plan'] ?? []) as $plan) {
            if (! is_array($plan)) {
                continue;
            }
            $assets[] = [
                'asset_type' => 'analysis_plan_draft',
                'role' => 'analysis',
                'draft_payload_json' => [
                    'title' => $this->text($plan['title'] ?? '') ?: 'Protocol analysis plan',
                    'analysis_type' => $this->text($plan['analysis_type'] ?? '') ?: 'characterization',
                    'hades_package' => $this->text($plan['hades_package'] ?? ''),
                    'rationale' => $this->text($plan['rationale'] ?? ''),
                    'required_roles' => ['target'],
                ],
            ];
        }

        return $assets;
    }

    /**
     * @param  array<string, mixed>  $intent
     */
    private function isReviewReady(array $intent): bool
    {
        $pico = is_array($intent['pico'] ?? null) ? $intent['pico'] : [];

        return $this->text($intent['research_question'] ?? '') !== ''
            && $this->text($pico['population'] ?? '') !== ''
            && $this->text($pico['outcome'] ?? '') !== '';
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    /**
     * @return list<mixed>
     */
    private function list(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function object(mixed $value): array
    {
        return is_array($value) && ! array_is_list($value) ? $value : [];
    }

    /**
     * @return list<string>
     */
    private function stringList(mixed $value): array
    {
        return array_values(array_filter(array_map(
            fn (mixed $item): string => $this->text($item),
            $this->list($value),
        ), fn (string $item): bool => $item !== ''));
    }
}
