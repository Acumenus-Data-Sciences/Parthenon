<?php

namespace App\Services\StudyDesign;

use RuntimeException;

class StudyDesignStructuredOutputSchemas
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public function catalog(): array
    {
        return [
            'protocol_extraction' => $this->namedSchema('ProtocolExtractionSchema', 'study-design-protocol-extraction.v2', $this->protocolExtractionSchema()),
            'compiler_guidance' => $this->namedSchema('CompilerGuidanceSchema', 'study-design-compiler-guidance.v1', $this->compilerGuidanceSchema()),
            'phenotype_recommendation' => $this->namedSchema('PhenotypeRecommendationSchema', 'study-design-phenotype-recommendation.v1', $this->phenotypeRecommendationSchema()),
            'concept_set_draft' => $this->namedSchema('ConceptSetDraftSchema', 'study-design-concept-set-draft.v1', $this->conceptSetDraftSchema()),
            'cohort_draft' => $this->namedSchema('CohortDraftSchema', 'study-design-cohort-draft.v1', $this->cohortDraftSchema()),
            'analysis_plan_draft' => $this->namedSchema('AnalysisPlanDraftSchema', 'study-design-analysis-plan-draft.v1', $this->analysisPlanDraftSchema()),
            'asset_repair_suggestion' => $this->namedSchema('AssetRepairSuggestionSchema', 'study-design-asset-repair-suggestion.v1', $this->assetRepairSuggestionSchema()),
            'package_manifest_review' => $this->namedSchema('PackageManifestReviewSchema', 'study-design-package-manifest-review.v1', $this->packageManifestReviewSchema()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function protocolExtractionSchema(): array
    {
        $text = $this->textSchema();
        $stringList = $this->stringListSchema();
        $evidenceSpan = $this->evidenceSpanSchema();
        $issueSchema = [
            'type' => 'object',
            'properties' => [
                'field' => $text,
                'severity' => $text,
                'message' => $text,
                'evidence' => $text,
                'confidence' => ['type' => ['number', 'null']],
            ],
        ];

        return [
            'type' => 'object',
            'properties' => [
                'research_question' => $text,
                'primary_objective' => $text,
                'population' => $text,
                'exposure' => $text,
                'comparator' => $text,
                'outcome' => $text,
                'time_at_risk' => $text,
                'study_type' => $text,
                'study_design' => $text,
                'hypothesis' => $text,
                'scientific_rationale' => $text,
                'evidence_spans' => ['type' => 'array', 'items' => $evidenceSpan],
                'confidence' => [
                    'type' => 'object',
                    'properties' => [
                        'overall' => ['type' => ['number', 'null']],
                        'research_question' => ['type' => ['number', 'null']],
                        'population' => ['type' => ['number', 'null']],
                        'exposure' => ['type' => ['number', 'null']],
                        'comparator' => ['type' => ['number', 'null']],
                        'outcome' => ['type' => ['number', 'null']],
                        'time_at_risk' => ['type' => ['number', 'null']],
                    ],
                ],
                'uncertainty' => ['type' => 'array', 'items' => $issueSchema],
                'design_assumptions' => ['type' => 'array', 'items' => $issueSchema],
                'concept_set_drafts' => [
                    'type' => 'array',
                    'items' => $this->conceptSetDraftSchema()['properties']['drafts']['items'],
                ],
                'cohort_definition_drafts' => [
                    'type' => 'array',
                    'items' => $this->cohortDraftSchema()['properties']['drafts']['items'],
                ],
                'analysis_plan' => [
                    'type' => 'array',
                    'items' => $this->analysisPlanDraftSchema()['properties']['plans']['items'],
                ],
                'feasibility_plan' => [
                    'type' => 'object',
                    'properties' => [
                        'summary' => $text,
                        'minimum_cell_count' => ['type' => ['integer', 'null']],
                        'source_requirements' => $stringList,
                    ],
                ],
                'validation_plan' => [
                    'type' => 'object',
                    'properties' => [
                        'summary' => $text,
                        'checks' => $stringList,
                    ],
                ],
                'publication_plan' => [
                    'type' => 'object',
                    'properties' => [
                        'summary' => $text,
                        'outputs' => $stringList,
                    ],
                ],
                'initial_gate' => [
                    'type' => 'object',
                    'properties' => [
                        'status' => $text,
                        'summary' => $text,
                        'issues' => ['type' => 'array', 'items' => $issueSchema],
                    ],
                ],
                'open_questions' => ['type' => 'array', 'items' => $issueSchema],
                'risk_notes' => $stringList,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function compilerGuidanceSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'schema_version' => $text,
                'current_stage' => $text,
                'next_action' => ['type' => 'object'],
                'blockers' => ['type' => 'array', 'items' => ['type' => 'object']],
                'warnings' => ['type' => 'array', 'items' => ['type' => 'object']],
                'completed_stages' => $this->stringListSchema(),
                'action_targets' => ['type' => 'array', 'items' => ['type' => 'object']],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function phenotypeRecommendationSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'recommendations' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => $text,
                            'asset_type' => $text,
                            'role' => $text,
                            'rank_score' => ['type' => ['number', 'null']],
                            'rationale' => $text,
                            'provenance' => ['type' => 'object'],
                            'evidence_spans' => ['type' => 'array', 'items' => $this->evidenceSpanSchema()],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function conceptSetDraftSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'drafts' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => $text,
                            'role' => $text,
                            'domain' => $text,
                            'clinical_rationale' => $text,
                            'search_terms' => $this->stringListSchema(),
                            'candidate_concepts' => [
                                'type' => 'array',
                                'items' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'term' => $text,
                                        'domain' => $text,
                                        'include_descendants' => ['type' => ['boolean', 'null']],
                                        'include_mapped' => ['type' => ['boolean', 'null']],
                                        'is_excluded' => ['type' => ['boolean', 'null']],
                                        'rationale' => $text,
                                    ],
                                ],
                            ],
                            'evidence_spans' => ['type' => 'array', 'items' => $this->evidenceSpanSchema()],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function cohortDraftSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'drafts' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => $text,
                            'role' => $text,
                            'description' => $text,
                            'concept_sets' => $this->stringListSchema(),
                            'entry_event' => $text,
                            'observation_window' => ['type' => 'object'],
                            'inclusion_rules' => ['type' => 'array', 'items' => ['type' => 'object']],
                            'exit_strategy' => $text,
                            'censoring_criteria' => ['type' => 'array', 'items' => ['type' => 'object']],
                            'circe_expression' => ['type' => 'object'],
                            'evidence_spans' => ['type' => 'array', 'items' => $this->evidenceSpanSchema()],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function analysisPlanDraftSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'plans' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'title' => $text,
                            'analysis_type' => $text,
                            'analysis_family' => $text,
                            'hades_package' => $text,
                            'rationale' => $text,
                            'description' => $text,
                            'design_summary' => $text,
                            'target_cohort' => $text,
                            'comparator_cohort' => $text,
                            'outcome_cohort' => $text,
                            'time_at_risk' => $text,
                            'estimand' => $text,
                            'covariates' => $this->stringListSchema(),
                            'stratifications' => $this->stringListSchema(),
                            'negative_controls' => $this->stringListSchema(),
                            'sensitivity_analyses' => $this->stringListSchema(),
                            'required_roles' => $this->stringListSchema(),
                            'design_parameters' => ['type' => 'object'],
                            'feasibility_assumptions' => ['type' => 'array', 'items' => ['type' => 'object']],
                            'design_json' => ['type' => 'object'],
                            'evidence_spans' => ['type' => 'array', 'items' => $this->evidenceSpanSchema()],
                        ],
                    ],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function assetRepairSuggestionSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'asset_id' => ['type' => ['integer', 'null']],
                'asset_type' => $text,
                'patch' => ['type' => 'object'],
                'explanation' => $text,
                'risks' => $this->stringListSchema(),
                'verifier_expectations' => $this->stringListSchema(),
                'evidence_spans' => ['type' => 'array', 'items' => $this->evidenceSpanSchema()],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function packageManifestReviewSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'lock_ready' => ['type' => 'boolean'],
                'manifest_preview' => ['type' => 'object'],
                'unresolved_risks' => ['type' => 'array', 'items' => ['type' => 'object']],
                'provenance_summary' => ['type' => 'object'],
                'recommendation' => $text,
                'evidence_spans' => ['type' => 'array', 'items' => $this->evidenceSpanSchema()],
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function validateProtocolExtraction(array $payload): array
    {
        $errors = [];

        foreach (['research_question', 'population', 'outcome'] as $field) {
            if ($this->text($payload[$field] ?? '') === '') {
                $errors[] = "{$field} is required";
            }
        }

        foreach (['concept_set_drafts', 'cohort_definition_drafts', 'analysis_plan', 'open_questions', 'risk_notes', 'evidence_spans', 'uncertainty', 'design_assumptions'] as $field) {
            if (array_key_exists($field, $payload) && ! is_array($payload[$field])) {
                $errors[] = "{$field} must be an array";
            }
        }

        foreach (['feasibility_plan', 'validation_plan', 'publication_plan', 'initial_gate', 'confidence'] as $field) {
            if (array_key_exists($field, $payload) && ! $this->isObject($payload[$field])) {
                $errors[] = "{$field} must be an object";
            }
        }

        $initialGate = $this->isObject($payload['initial_gate'] ?? null) ? $payload['initial_gate'] : [];
        if (array_key_exists('issues', $initialGate) && ! is_array($initialGate['issues'])) {
            $errors[] = 'initial_gate.issues must be an array';
        }
        foreach ($this->list($initialGate['issues'] ?? []) as $index => $issue) {
            if (! is_array($issue)) {
                $errors[] = "initial_gate.issues.{$index} must be an object";
            }
        }

        foreach ($this->list($payload['evidence_spans'] ?? []) as $index => $span) {
            if (! $this->isObject($span)) {
                $errors[] = "evidence_spans.{$index} must be an object";

                continue;
            }
            if ($this->text($span['quote'] ?? $span['evidence'] ?? '') === '') {
                $errors[] = "evidence_spans.{$index}.quote is required";
            }
            if (array_key_exists('confidence', $span) && ! is_numeric($span['confidence']) && $span['confidence'] !== null) {
                $errors[] = "evidence_spans.{$index}.confidence must be numeric";
            }
        }

        foreach ($this->list($payload['concept_set_drafts'] ?? []) as $index => $draft) {
            if (! is_array($draft)) {
                $errors[] = "concept_set_drafts.{$index} must be an object";

                continue;
            }
            if (array_key_exists('search_terms', $draft) && ! is_array($draft['search_terms'])) {
                $errors[] = "concept_set_drafts.{$index}.search_terms must be an array";
            }
        }

        foreach ($this->list($payload['cohort_definition_drafts'] ?? []) as $index => $draft) {
            if (! is_array($draft)) {
                $errors[] = "cohort_definition_drafts.{$index} must be an object";
            }
        }

        foreach ($this->list($payload['analysis_plan'] ?? []) as $index => $plan) {
            if (! is_array($plan)) {
                $errors[] = "analysis_plan.{$index} must be an object";

                continue;
            }
            if ($this->text($plan['analysis_type'] ?? '') === '') {
                $errors[] = "analysis_plan.{$index}.analysis_type is required";
            }
            foreach (['covariates', 'stratifications', 'negative_controls', 'sensitivity_analyses', 'required_roles'] as $field) {
                if (array_key_exists($field, $plan) && ! is_array($plan[$field])) {
                    $errors[] = "analysis_plan.{$index}.{$field} must be an array";
                }
            }
            if (array_key_exists('design_json', $plan) && ! $this->isObject($plan['design_json'])) {
                $errors[] = "analysis_plan.{$index}.design_json must be an object";
            }
        }

        if ($errors !== []) {
            throw new RuntimeException('Abby protocol evaluator returned invalid structured output: '.implode('; ', $errors).'.');
        }

        return $payload + [
            'concept_set_drafts' => [],
            'cohort_definition_drafts' => [],
            'analysis_plan' => [],
            'feasibility_plan' => [],
            'validation_plan' => [],
            'publication_plan' => [],
            'open_questions' => [],
            'risk_notes' => [],
            'initial_gate' => [],
            'evidence_spans' => [],
            'confidence' => [],
            'uncertainty' => [],
            'design_assumptions' => [],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function validateLocalHarnessOutput(string $task, array $payload): array
    {
        $errors = [];

        if ($this->text($payload['summary'] ?? '') === '') {
            $errors[] = 'summary is required';
        }

        if (array_key_exists('actions', $payload) && ! is_array($payload['actions'])) {
            $errors[] = 'actions must be an array';
        }
        foreach ($this->list($payload['actions'] ?? []) as $index => $action) {
            if (! $this->isObject($action)) {
                $errors[] = "actions.{$index} must be an object";

                continue;
            }
            if ($this->text($action['type'] ?? '') === '') {
                $errors[] = "actions.{$index}.type is required";
            }
            if (array_key_exists('canonical_write', $action) && $action['canonical_write'] === true) {
                $errors[] = "actions.{$index}.canonical_write must not be true";
            }
        }

        if (array_key_exists('warnings', $payload) && ! is_array($payload['warnings'])) {
            $errors[] = 'warnings must be an array';
        }
        foreach ($this->list($payload['warnings'] ?? []) as $index => $warning) {
            if (! is_scalar($warning)) {
                $errors[] = "warnings.{$index} must be a string";
            }
        }

        foreach (['draft_payload_json', 'canonical_record', 'materialized_id', 'raw_protocol_text', 'source_rows', 'row_samples'] as $blockedKey) {
            if ($this->hasNestedKey($payload, $blockedKey)) {
                $errors[] = "{$blockedKey} is not allowed in local harness output";
            }
        }

        if ($errors !== []) {
            throw new RuntimeException("Local Abby harness returned invalid structured output for {$task}: ".implode('; ', $errors).'.');
        }

        return $payload + [
            'actions' => [],
            'warnings' => [],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function validateDraftAssetInputs(array $payload): array
    {
        $errors = [];

        foreach ($this->list($payload['concept_set_drafts'] ?? []) as $index => $draft) {
            if (! $this->isObject($draft)) {
                $errors[] = "concept_set_drafts.{$index} must be an object";

                continue;
            }
            if ($this->text($draft['title'] ?? '') === '') {
                $errors[] = "concept_set_drafts.{$index}.title is required";
            }
            if (array_key_exists('search_terms', $draft) && ! is_array($draft['search_terms'])) {
                $errors[] = "concept_set_drafts.{$index}.search_terms must be an array";
            }
            if ($this->hasNestedKey($draft, 'concept_id')) {
                $errors[] = "concept_set_drafts.{$index} must not include OMOP concept IDs before vocabulary validation";
            }
        }

        foreach ($this->list($payload['cohort_definition_drafts'] ?? []) as $index => $draft) {
            if (! $this->isObject($draft)) {
                $errors[] = "cohort_definition_drafts.{$index} must be an object";

                continue;
            }
            if ($this->text($draft['title'] ?? '') === '') {
                $errors[] = "cohort_definition_drafts.{$index}.title is required";
            }
        }

        foreach ($this->list($payload['analysis_plan'] ?? []) as $index => $plan) {
            if (! $this->isObject($plan)) {
                $errors[] = "analysis_plan.{$index} must be an object";

                continue;
            }
            foreach (['title', 'analysis_type', 'hades_package'] as $field) {
                if ($this->text($plan[$field] ?? '') === '') {
                    $errors[] = "analysis_plan.{$index}.{$field} is required";
                }
            }
            foreach (['required_roles', 'blockers', 'warnings'] as $field) {
                if (array_key_exists($field, $plan) && ! is_array($plan[$field])) {
                    $errors[] = "analysis_plan.{$index}.{$field} must be an array";
                }
            }
            if (array_key_exists('design_json', $plan) && ! $this->isObject($plan['design_json'])) {
                $errors[] = "analysis_plan.{$index}.design_json must be an object";
            }
        }

        if ($errors !== []) {
            throw new RuntimeException('Abby draft asset schema validation failed before persistence: '.implode('; ', $errors).'.');
        }

        return $payload;
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    /**
     * @return array<string, mixed>
     */
    private function namedSchema(string $name, string $version, array $schema): array
    {
        return [
            'name' => $name,
            'version' => $version,
            'json_schema' => $schema,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function textSchema(): array
    {
        return ['type' => 'string'];
    }

    /**
     * @return array<string, mixed>
     */
    private function stringListSchema(): array
    {
        return ['type' => 'array', 'items' => $this->textSchema()];
    }

    /**
     * @return array<string, mixed>
     */
    private function evidenceSpanSchema(): array
    {
        $text = $this->textSchema();

        return [
            'type' => 'object',
            'properties' => [
                'field' => $text,
                'label' => $text,
                'quote' => $text,
                'evidence' => $text,
                'section' => $text,
                'page' => ['type' => ['integer', 'string', 'null']],
                'confidence' => ['type' => ['number', 'null']],
            ],
        ];
    }

    /**
     * @return list<mixed>
     */
    private function list(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }

    private function isObject(mixed $value): bool
    {
        return is_array($value) && ! array_is_list($value);
    }

    private function hasNestedKey(mixed $value, string $blockedKey): bool
    {
        if (! is_array($value)) {
            return false;
        }

        foreach ($value as $key => $item) {
            if ($key === $blockedKey) {
                return true;
            }
            if ($this->hasNestedKey($item, $blockedKey)) {
                return true;
            }
        }

        return false;
    }
}
