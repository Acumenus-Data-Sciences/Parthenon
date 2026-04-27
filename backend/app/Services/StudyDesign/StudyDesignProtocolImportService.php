<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\Study;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
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

    private const PROTOCOL_SOURCE = 'protocol_upload_abby';

    private const ANALYSIS_PACKAGES = [
        'characterization' => ['package' => 'Characterization', 'endpoint' => '/characterization/run', 'label' => 'Baseline Characterization'],
        'incidence_rate' => ['package' => 'CohortIncidence', 'endpoint' => '/cohort-incidence/run', 'label' => 'Incidence Rate'],
        'pathway' => ['package' => 'TreatmentPatterns', 'endpoint' => '/treatment-patterns/run', 'label' => 'Treatment Pathways'],
        'estimation' => ['package' => 'CohortMethod', 'endpoint' => '/estimation/run', 'label' => 'Population-Level Estimation'],
        'prediction' => ['package' => 'PatientLevelPrediction', 'endpoint' => '/prediction/run', 'label' => 'Patient-Level Prediction'],
        'sccs' => ['package' => 'SelfControlledCaseSeries', 'endpoint' => '/sccs/run', 'label' => 'Self-Controlled Case Series'],
        'self_controlled_cohort' => ['package' => 'SelfControlledCohort', 'endpoint' => '/self-controlled-cohort/run', 'label' => 'Self-Controlled Cohort'],
        'evidence_synthesis' => ['package' => 'EvidenceSynthesis', 'endpoint' => '/evidence-synthesis/run', 'label' => 'Evidence Synthesis'],
    ];

    private const ANALYSIS_ALIASES = [
        'baseline_characterization' => 'characterization',
        'characterisation' => 'characterization',
        'cohort_characterization' => 'characterization',
        'cohortincidence' => 'incidence_rate',
        'cohort_incidence' => 'incidence_rate',
        'incidence' => 'incidence_rate',
        'incidenceprevalence' => 'incidence_rate',
        'prevalence' => 'incidence_rate',
        'treatment_pathway' => 'pathway',
        'treatment_pathways' => 'pathway',
        'treatmentpatterns' => 'pathway',
        'comparative_effectiveness' => 'estimation',
        'cohort_method' => 'estimation',
        'cohortmethod' => 'estimation',
        'effect_estimation' => 'estimation',
        'population_level_estimation' => 'estimation',
        'patient_level_prediction' => 'prediction',
        'plp' => 'prediction',
        'risk_prediction' => 'prediction',
        'self_controlled_case_series' => 'sccs',
        'self-controlled_case_series' => 'sccs',
        'selfcontrolledcaseseries' => 'sccs',
        'scc' => 'self_controlled_cohort',
        'self-controlled_cohort' => 'self_controlled_cohort',
        'selfcontrolledcohort' => 'self_controlled_cohort',
        'evidencesynthesis' => 'evidence_synthesis',
        'meta_analysis' => 'evidence_synthesis',
        'network_meta_analysis' => 'evidence_synthesis',
    ];

    public function __construct(
        private readonly StudyDesignAbbyOrchestrator $abbyOrchestrator,
    ) {}

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

        $evaluation = $this->abbyOrchestrator->evaluateProtocol($study, $promptText, $metadata);
        $model = (string) $evaluation['model'];
        $provenance = $this->abbyOrchestrator->protocolProvenance($evaluation, $metadata);
        /** @var array<string, mixed> $extracted */
        $extracted = $evaluation['extracted'];
        $intent = $this->toIntent($study, $extracted, $metadata);
        $normalizedSpec = $this->toNormalizedSpec($study, $intent, $extracted, $metadata);
        $normalizedSpec = $this->abbyOrchestrator->validateDraftAssetInputs($normalizedSpec);
        $initialGate = $this->initialGate($intent, $extracted, $metadata);
        $intent['initial_gate'] = $initialGate;
        $normalizedSpec['initial_gate'] = $initialGate;
        $status = $this->isReviewReady($intent) && ($initialGate['status'] ?? null) === 'ready' ? 'review_ready' : 'draft';

        $version = DB::transaction(function () use ($session, $userId, $intent, $normalizedSpec, $metadata, $extracted, $model, $status, $provenance, $evaluation): StudyDesignVersion {
            $versionNumber = ((int) $session->versions()->max('version_number')) + 1;

            /** @var StudyDesignVersion $version */
            $version = $session->versions()->create([
                'version_number' => $versionNumber,
                'status' => $status,
                'intent_json' => $intent,
                'normalized_spec_json' => $normalizedSpec,
                'provenance_json' => $provenance,
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
                'prompt_sha256' => hash('sha256', StudyDesignAbbyOrchestrator::PROTOCOL_PROMPT_VERSION.$metadata['text_sha256']),
                'input_json' => $this->abbyOrchestrator->protocolAiEventInput($evaluation, $metadata),
                'output_json' => [
                    'extracted' => $extracted,
                    'intent' => $intent,
                    'normalized_spec' => $normalizedSpec,
                ],
                'safety_json' => $this->abbyOrchestrator->protocolSafetyFlags(),
                'created_by' => $userId,
            ]);

            foreach ($this->draftAssets($normalizedSpec) as $asset) {
                $session->assets()->create(array_merge([
                    'version_id' => $version->id,
                    'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
                    'verification_status' => StudyDesignVerificationStatus::UNVERIFIED->value,
                    'provenance_json' => [
                        'source' => self::PROTOCOL_SOURCE,
                        'orchestrator' => 'abby',
                        'evaluator_provider' => 'anthropic',
                        'evaluator_model' => $model,
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
            'initial_gate' => $this->object($extracted['initial_gate'] ?? []),
            'evidence_spans' => $this->objectList($extracted['evidence_spans'] ?? []),
            'confidence' => $this->object($extracted['confidence'] ?? []),
            'uncertainty' => $this->objectList($extracted['uncertainty'] ?? []),
            'design_assumptions' => $this->objectList($extracted['design_assumptions'] ?? []),
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
        $analysisPlans = $this->analysisPlans($study, $intent, $extracted);

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
            'analysis_plan' => $analysisPlans,
            'feasibility_plan' => $this->object($extracted['feasibility_plan'] ?? []),
            'validation_plan' => $this->object($extracted['validation_plan'] ?? []),
            'publication_plan' => $this->object($extracted['publication_plan'] ?? []),
            'open_questions' => $intent['open_questions'],
            'risk_notes' => $intent['risk_notes'],
            'initial_gate' => $this->object($extracted['initial_gate'] ?? []),
            'evidence_spans' => $intent['evidence_spans'],
            'confidence' => $intent['confidence'],
            'uncertainty' => $intent['uncertainty'],
            'design_assumptions' => $intent['design_assumptions'],
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
                    'evidence_spans' => $this->objectList($draft['evidence_spans'] ?? []),
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
                    'evidence_spans' => $this->objectList($draft['evidence_spans'] ?? []),
                ],
            ];
        }

        foreach ($this->list($extracted['analysis_plan'] ?? []) as $plan) {
            if (! is_array($plan)) {
                continue;
            }
            $assets[] = [
                'asset_type' => 'analysis_plan',
                'role' => null,
                'draft_payload_json' => [
                    ...$plan,
                    'evidence_spans' => $this->objectList($plan['evidence_spans'] ?? []),
                    'schema_version' => $this->text($plan['schema_version'] ?? '') ?: 'study-analysis-plan.v1',
                ],
                'rank_score' => $this->analysisRankScore($plan),
                'rank_score_json' => [
                    'analysis_type' => $this->text($plan['analysis_type'] ?? '') ?: 'characterization',
                    'source' => self::PROTOCOL_SOURCE,
                    'requires_feasibility' => true,
                ],
            ];
        }

        return $assets;
    }

    /**
     * @param  array<string, mixed>  $intent
     * @param  array<string, mixed>  $extracted
     * @return list<array<string, mixed>>
     */
    private function analysisPlans(Study $study, array $intent, array $extracted): array
    {
        $pico = is_array($intent['pico'] ?? null) ? $intent['pico'] : [];
        $studyType = strtolower($this->text($extracted['study_type'] ?? '') ?: $this->text($study->study_type ?? ''));
        $provided = [];

        foreach ($this->list($extracted['analysis_plan'] ?? []) as $plan) {
            if (! is_array($plan)) {
                continue;
            }

            $type = $this->normalizeAnalysisType(
                $this->text($plan['analysis_type'] ?? ''),
                $this->text($plan['hades_package'] ?? ''),
            );
            $provided[$type] ??= $plan;
        }

        $types = array_values(array_unique(array_merge(
            ['characterization'],
            array_keys($provided),
            $this->recommendedAnalysisTypes($studyType, $pico),
        )));

        return array_values(array_map(
            fn (string $type): array => $this->analysisPlanPayload($type, $study, $pico, $provided[$type] ?? []),
            $types,
        ));
    }

    /**
     * @param  array<string, mixed>  $pico
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function analysisPlanPayload(string $analysisType, Study $study, array $pico, array $plan): array
    {
        $meta = self::ANALYSIS_PACKAGES[$analysisType] ?? self::ANALYSIS_PACKAGES['characterization'];
        $package = $meta['package'];
        $description = $this->text($plan['description'] ?? '')
            ?: $this->text($plan['design_summary'] ?? '')
            ?: $this->text($plan['rationale'] ?? '')
            ?: $this->analysisDescription($analysisType, $pico);
        $designJson = $this->object($plan['design_json'] ?? []);

        return [
            'schema_version' => 'study-analysis-plan.v1',
            'title' => $this->text($plan['title'] ?? '') ?: "{$study->title}: {$meta['label']}",
            'analysis_type' => $analysisType,
            'description' => $description,
            'rationale' => $this->text($plan['rationale'] ?? '') ?: $description,
            'hades_package' => $package,
            'hades_endpoint' => $meta['endpoint'],
            'hades_capability' => [
                'package' => $package,
                'installed' => false,
                'status' => 'pending_hades_inventory',
            ],
            'required_roles' => $this->analysisRequiredRoles($analysisType, $plan),
            'cohort_role_map' => [],
            'design_json' => $designJson !== [] ? $designJson : $this->protocolDesignJson($analysisType, $pico, $plan),
            'evidence_spans' => $this->objectList($plan['evidence_spans'] ?? []),
            'feasibility' => [
                'status' => null,
                'ready_source_count' => 0,
                'source_count' => 0,
                'ran_at' => null,
            ],
            'blockers' => [
                $this->analysisIssue('missing_feasibility', 'Run source feasibility before materializing this protocol-derived analysis plan.'),
            ],
            'warnings' => [
                $this->analysisIssue('requires_human_review', 'Protocol-derived analysis settings require Study Designer review before execution.'),
            ],
            'materialization_target' => 'native_'.$analysisType.'_analysis',
            'policy' => 'Protocol-derived analysis plans compile into native Parthenon analysis records after feasibility, verification, and review.',
        ];
    }

    /**
     * @param  array<string, mixed>  $pico
     * @return list<string>
     */
    private function recommendedAnalysisTypes(string $studyType, array $pico): array
    {
        $types = [];
        $hasComparator = $this->text($pico['comparator'] ?? '') !== '';
        $hasOutcome = $this->text($pico['outcome'] ?? '') !== '';
        $studyText = strtolower($studyType.' '.$this->text($pico['time_at_risk'] ?? ''));

        if ($hasComparator && $hasOutcome || str_contains($studyText, 'comparative') || str_contains($studyText, 'effect')) {
            $types[] = 'estimation';
        }

        if ($hasOutcome && (str_contains($studyText, 'prediction') || str_contains($studyText, 'risk model'))) {
            $types[] = 'prediction';
        }

        if (str_contains($studyText, 'incidence') || str_contains($studyText, 'prevalence')) {
            $types[] = 'incidence_rate';
        }

        if (str_contains($studyText, 'pathway') || str_contains($studyText, 'sequence')) {
            $types[] = 'pathway';
        }

        if ($hasOutcome && (str_contains($studyText, 'self-controlled') || str_contains($studyText, 'sccs') || str_contains($studyText, 'safety'))) {
            $types[] = 'sccs';
        }

        if (str_contains($studyText, 'evidence synthesis') || str_contains($studyText, 'meta-analysis') || str_contains($studyText, 'network')) {
            $types[] = 'evidence_synthesis';
        }

        return array_values(array_unique($types));
    }

    private function normalizeAnalysisType(string $type, string $package = ''): string
    {
        $key = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '_', $type) ?? '', '_'));
        if (isset(self::ANALYSIS_PACKAGES[$key])) {
            return $key;
        }
        if (isset(self::ANALYSIS_ALIASES[$key])) {
            return self::ANALYSIS_ALIASES[$key];
        }

        return match (strtolower(trim($package))) {
            'characterization', 'featureextraction' => 'characterization',
            'cohortincidence', 'incidenceprevalence' => 'incidence_rate',
            'treatmentpatterns' => 'pathway',
            'cohortmethod' => 'estimation',
            'patientlevelprediction' => 'prediction',
            'selfcontrolledcaseseries' => 'sccs',
            'selfcontrolledcohort' => 'self_controlled_cohort',
            'evidencesynthesis' => 'evidence_synthesis',
            default => 'characterization',
        };
    }

    /**
     * @param  array<string, mixed>  $plan
     * @return list<string>
     */
    private function analysisRequiredRoles(string $analysisType, array $plan): array
    {
        $provided = $this->stringList($plan['required_roles'] ?? []);
        if ($provided !== []) {
            return $provided;
        }

        return match ($analysisType) {
            'estimation' => ['target', 'comparator', 'outcome'],
            'prediction', 'sccs', 'self_controlled_cohort', 'incidence_rate' => ['target', 'outcome'],
            'pathway' => ['target', 'comparator'],
            default => ['target'],
        };
    }

    /**
     * @param  array<string, mixed>  $pico
     */
    private function analysisDescription(string $analysisType, array $pico): string
    {
        $outcome = $this->text($pico['outcome'] ?? '');
        $comparator = $this->text($pico['comparator'] ?? '');

        return match ($analysisType) {
            'estimation' => 'Estimate the target-comparator effect'.($outcome !== '' ? " on {$outcome}" : '').' with CohortMethod.',
            'prediction' => 'Train and evaluate patient-level risk prediction models'.($outcome !== '' ? " for {$outcome}" : '').'.',
            'incidence_rate' => 'Estimate incidence or prevalence for protocol-defined cohorts across selected sources.',
            'pathway' => 'Describe treatment sequence patterns'.($comparator !== '' ? " including {$comparator}" : '').'.',
            'sccs' => 'Evaluate self-controlled exposure-outcome association windows with SCCS.',
            'self_controlled_cohort' => 'Evaluate self-controlled cohort risk windows for protocol-defined exposure and outcome cohorts.',
            'evidence_synthesis' => 'Prepare multi-source estimates for evidence synthesis.',
            default => 'Describe baseline covariates and cohort characteristics before inferential analysis.',
        };
    }

    /**
     * @param  array<string, mixed>  $pico
     * @param  array<string, mixed>  $plan
     * @return array<string, mixed>
     */
    private function protocolDesignJson(string $analysisType, array $pico, array $plan): array
    {
        $base = [
            'source' => self::PROTOCOL_SOURCE,
            'protocol_fields' => [
                'population' => $this->text($pico['population'] ?? ''),
                'exposure' => $this->text($pico['intervention'] ?? ''),
                'comparator' => $this->text($pico['comparator'] ?? ''),
                'outcome' => $this->text($pico['outcome'] ?? ''),
                'time_at_risk' => $this->text($plan['time_at_risk'] ?? '') ?: $this->text($pico['time_at_risk'] ?? ''),
            ],
            'covariates' => $this->stringList($plan['covariates'] ?? []),
            'stratifications' => $this->stringList($plan['stratifications'] ?? []),
            'sensitivity_analyses' => $this->stringList($plan['sensitivity_analyses'] ?? []),
        ];

        return $base + match ($analysisType) {
            'estimation' => [
                'estimand' => $this->text($plan['estimand'] ?? '') ?: 'comparative effect estimate',
                'model' => ['type' => 'cox', 'timeAtRiskStart' => 1, 'timeAtRiskEnd' => 365, 'endAnchor' => 'cohort_start'],
                'propensityScore' => ['enabled' => true, 'method' => 'matching'],
                'negative_controls' => $this->stringList($plan['negative_controls'] ?? []),
            ],
            'prediction' => [
                'model' => ['type' => 'lasso_logistic_regression'],
                'timeAtRisk' => ['start' => 1, 'end' => 365, 'endAnchor' => 'cohort_start'],
                'populationSettings' => ['washoutPeriod' => 365, 'removeSubjectsWithPriorOutcome' => true],
            ],
            'incidence_rate' => [
                'timeAtRisk' => ['start' => 1, 'end' => 365],
                'stratified' => true,
            ],
            'pathway' => [
                'periodPriorToIndex' => 0,
                'minEraDuration' => 0,
            ],
            'sccs' => [
                'riskWindows' => [['start' => 1, 'end' => 30, 'label' => 'primary']],
                'controlInterval' => ['start' => -365, 'end' => -1],
            ],
            'self_controlled_cohort' => [
                'riskWindows' => [['start' => 1, 'end' => 30, 'label' => 'primary']],
            ],
            'evidence_synthesis' => [
                'method' => 'random_effects',
                'input' => 'study_level_estimates',
            ],
            default => [
                'featureTypes' => ['demographics', 'conditions', 'drugs', 'measurements'],
                'stratifyByGender' => true,
                'stratifyByAge' => true,
                'topN' => 100,
                'minCellCount' => 5,
            ],
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function analysisIssue(string $code, string $message): array
    {
        return ['code' => $code, 'message' => $message];
    }

    /**
     * @param  array<string, mixed>  $plan
     */
    private function analysisRankScore(array $plan): float
    {
        return ($this->text($plan['analysis_type'] ?? '') === 'characterization') ? 55.0 : 60.0;
    }

    /**
     * @param  array<string, mixed>  $intent
     * @param  array<string, mixed>  $extracted
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function initialGate(array $intent, array $extracted, array $metadata): array
    {
        $pico = $this->object($intent['pico'] ?? []);
        $issues = [
            ...$this->llmInitialGateIssues($extracted),
            ...$this->blockingOpenQuestionIssues($intent),
        ];

        foreach ([
            'research_question' => ['label' => 'Research question', 'value' => $intent['research_question'] ?? null],
            'primary_objective' => ['label' => 'Primary objective', 'value' => $intent['primary_objective'] ?? null],
            'population' => ['label' => 'Population', 'value' => $pico['population'] ?? null],
            'exposure' => ['label' => 'Exposure or index event', 'value' => $pico['intervention'] ?? null],
            'outcome' => ['label' => 'Primary outcome', 'value' => $pico['outcome'] ?? null],
            'time_at_risk' => ['label' => 'Time at risk', 'value' => $pico['time_at_risk'] ?? null],
        ] as $field => $definition) {
            $value = $this->text($definition['value'] ?? '');
            if ($this->isMissingProtocolValue($value)) {
                $issues[] = $this->gateIssue(
                    $field,
                    'blocking',
                    "{$definition['label']} is missing or not specific enough in the uploaded protocol.",
                );
            }
        }

        $comparator = $this->text($pico['comparator'] ?? '');
        if ($this->isMissingProtocolValue($comparator)) {
            $severity = $this->appearsComparative($intent) ? 'blocking' : 'review';
            $issues[] = $this->gateIssue(
                'comparator',
                $severity,
                $severity === 'blocking'
                    ? 'Comparator is required because the protocol appears to describe a comparative design.'
                    : 'Comparator is not specified; confirm the study is descriptive or single-arm before accepting intent.',
            );
        }

        $timeAtRisk = $this->text($pico['time_at_risk'] ?? '');
        if ($timeAtRisk !== '' && $this->isWeakTimeAtRisk($timeAtRisk)) {
            $issues[] = $this->gateIssue(
                'time_at_risk',
                'blocking',
                'Time at risk must include an index anchor plus follow-up end or censoring logic.',
            );
        }

        $issues = $this->dedupeGateIssues($issues);
        $blocking = array_values(array_filter($issues, fn (array $issue): bool => $this->isBlockingSeverity($issue['severity'] ?? null)));
        $gate = [
            'status' => $blocking === [] ? 'ready' : 'failed',
            'summary' => $blocking === []
                ? 'Protocol contains the minimum intent details needed for human review.'
                : 'Protocol is under-specified for initial Study Design Compiler gates.',
            'issues' => $issues,
            'protocol_file' => [
                'filename' => $metadata['filename'] ?? null,
                'truncated_for_ai' => $metadata['truncated_for_ai'] ?? false,
            ],
        ];

        if ($blocking !== []) {
            throw new StudyDesignProtocolGateException($issues, [
                'status' => 'failed',
                'blocking_count' => count($blocking),
                'filename' => $metadata['filename'] ?? null,
            ]);
        }

        return $gate;
    }

    /**
     * @param  array<string, mixed>  $extracted
     * @return list<array<string, mixed>>
     */
    private function llmInitialGateIssues(array $extracted): array
    {
        $gate = $this->object($extracted['initial_gate'] ?? []);
        $issues = [];

        foreach ($this->list($gate['issues'] ?? []) as $issue) {
            if (! is_array($issue)) {
                continue;
            }

            $message = $this->text($issue['message'] ?? $issue['question'] ?? '');
            if ($message === '') {
                continue;
            }

            $issues[] = $this->gateIssue(
                $this->text($issue['field'] ?? 'protocol'),
                $this->text($issue['severity'] ?? 'review') ?: 'review',
                $message,
                $this->text($issue['evidence'] ?? ''),
                'llm_initial_gate',
            );
        }

        $status = strtolower($this->text($gate['status'] ?? ''));
        if (in_array($status, ['fail', 'failed', 'blocked', 'insufficient', 'inadequate'], true) && $issues === []) {
            $issues[] = $this->gateIssue(
                'protocol',
                'blocking',
                $this->text($gate['summary'] ?? '') ?: 'The protocol was flagged as inadequate for initial Study Design gates.',
                '',
                'llm_initial_gate',
            );
        }

        return $issues;
    }

    /**
     * @param  array<string, mixed>  $intent
     * @return list<array<string, mixed>>
     */
    private function blockingOpenQuestionIssues(array $intent): array
    {
        $issues = [];
        foreach ($this->list($intent['open_questions'] ?? []) as $question) {
            if (! is_array($question)) {
                continue;
            }

            $severity = $this->text($question['severity'] ?? 'review') ?: 'review';
            if (! $this->isBlockingSeverity($severity)) {
                continue;
            }

            $message = $this->text($question['question'] ?? $question['message'] ?? '');
            if ($message === '') {
                continue;
            }

            $issues[] = $this->gateIssue(
                $this->text($question['field'] ?? 'protocol'),
                'blocking',
                $message,
                '',
                'open_question',
            );
        }

        return $issues;
    }

    /**
     * @return array<string, mixed>
     */
    private function gateIssue(string $field, string $severity, string $message, string $evidence = '', string $source = 'deterministic_gate'): array
    {
        return array_filter([
            'field' => $field,
            'severity' => $severity,
            'message' => $message,
            'evidence' => $evidence,
            'source' => $source,
        ], fn (mixed $value): bool => $value !== '');
    }

    /**
     * @param  list<array<string, mixed>>  $issues
     * @return list<array<string, mixed>>
     */
    private function dedupeGateIssues(array $issues): array
    {
        $seen = [];

        return array_values(array_filter($issues, function (array $issue) use (&$seen): bool {
            $field = (string) ($issue['field'] ?? '');
            $key = $field !== '' ? $field : (string) ($issue['message'] ?? '');
            if (isset($seen[$key])) {
                return false;
            }
            $seen[$key] = true;

            return true;
        }));
    }

    private function appearsComparative(array $intent): bool
    {
        $text = strtolower(implode(' ', [
            $this->text($intent['research_question'] ?? ''),
            $this->text($intent['analysis_family'] ?? ''),
        ]));

        return str_contains($text, 'compar')
            || str_contains($text, ' versus ')
            || str_contains($text, ' vs ')
            || str_contains($text, 'effectiveness')
            || str_contains($text, 'estimation');
    }

    private function isMissingProtocolValue(string $value): bool
    {
        $normalized = strtolower(trim($value));

        return $normalized === ''
            || in_array($normalized, ['n/a', 'na', 'none', 'not applicable', 'not specified', 'unspecified', 'unknown', 'tbd', 'to be determined'], true)
            || strlen($normalized) < 4;
    }

    private function isWeakTimeAtRisk(string $value): bool
    {
        $normalized = strtolower(trim($value));
        $hasAnchor = preg_match('/\b(index|entry|start|baseline|exposure|diagnosis|cohort|admission)\b/', $normalized) === 1;
        $hasEnd = preg_match('/\b(end|until|through|follow|censor|observation|death|disenrollment|day|days|week|weeks|month|months|year|years)\b/', $normalized) === 1;

        return strlen($normalized) < 15 || ! $hasAnchor || ! $hasEnd;
    }

    private function isBlockingSeverity(mixed $severity): bool
    {
        return in_array(strtolower($this->text($severity)), ['blocking', 'blocked', 'high', 'fail', 'failed', 'error'], true);
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
     * @return list<array<string, mixed>>
     */
    private function objectList(mixed $value): array
    {
        return array_values(array_filter(
            $this->list($value),
            fn (mixed $item): bool => is_array($item) && ! array_is_list($item),
        ));
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
