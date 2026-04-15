<?php

namespace App\Services\StudyDesign;

use App\Models\App\Study;

class StudyDesignSpecValidator
{
    /**
     * @param  array<string, mixed>  $spec
     * @return array{spec: array<string, mixed>, lint: array<string, mixed>}
     */
    public function normalize(array $spec, Study $study, string $researchQuestion): array
    {
        $normalized = [
            'schema_version' => (string) ($spec['schema_version'] ?? '1.0'),
            'study' => $this->normalizeStudy($spec['study'] ?? [], $study, $researchQuestion),
            'pico' => $this->normalizePico($spec['pico'] ?? []),
            'cohort_roles' => $this->listValue($spec['cohort_roles'] ?? []),
            'concept_set_drafts' => $this->listValue($spec['concept_set_drafts'] ?? []),
            'cohort_definition_drafts' => $this->listValue($spec['cohort_definition_drafts'] ?? []),
            'analysis_plan' => $this->listValue($spec['analysis_plan'] ?? []),
            'feasibility_plan' => $this->objectValue($spec['feasibility_plan'] ?? []),
            'validation_plan' => $this->objectValue($spec['validation_plan'] ?? []),
            'publication_plan' => $this->objectValue($spec['publication_plan'] ?? []),
            'open_questions' => $this->listValue($spec['open_questions'] ?? []),
            'provenance' => $this->objectValue($spec['provenance'] ?? []),
        ];

        $lint = $this->lint($normalized);

        return [
            'spec' => $normalized,
            'lint' => $lint,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function fromAiPayload(array $payload, Study $study, string $researchQuestion, string $provider, ?string $model): array
    {
        $data = $this->unwrapPayload($payload);

        $target = $this->stringValue($data['target_population'] ?? $data['target_statement'] ?? $data['target'] ?? null);
        $outcome = $this->stringValue($data['outcome'] ?? $data['outcome_statement'] ?? null);
        $comparator = $this->stringValue($data['comparator'] ?? $data['comparator_statement'] ?? null);
        $exposure = $this->stringValue($data['exposure'] ?? $data['intervention'] ?? $data['intervention_or_exposure'] ?? null);
        $time = $this->stringValue($data['time'] ?? $data['time_horizon'] ?? $data['time_at_risk'] ?? null);
        $objective = $this->stringValue($data['primary_objective'] ?? $data['objective'] ?? null);
        $hypothesis = $this->stringValue($data['hypothesis'] ?? null);
        $rationale = $this->stringValue($data['rationale'] ?? $data['scientific_rationale'] ?? null);

        $spec = [
            'schema_version' => '1.0',
            'study' => [
                'title' => $study->title,
                'short_title' => $study->short_title,
                'research_question' => $researchQuestion,
                'scientific_rationale' => $rationale,
                'hypothesis' => $hypothesis,
                'primary_objective' => $objective !== '' ? $objective : $researchQuestion,
                'secondary_objectives' => $this->listValue($data['secondary_objectives'] ?? []),
                'study_design' => $this->stringValue($data['study_design'] ?? $study->study_design ?? 'observational'),
                'study_type' => $this->stringValue($data['study_type'] ?? $study->study_type ?? 'custom'),
                'target_population_summary' => $target,
                'estimand' => $this->objectValue($data['estimand'] ?? []),
            ],
            'pico' => [
                'population' => ['summary' => $target],
                'intervention_or_exposure' => ['summary' => $exposure],
                'comparator' => ['summary' => $comparator],
                'outcomes' => $outcome !== '' ? [['summary' => $outcome, 'primary' => true]] : [],
                'time' => ['summary' => $time],
            ],
            'cohort_roles' => [],
            'concept_set_drafts' => [],
            'cohort_definition_drafts' => [],
            'analysis_plan' => [],
            'feasibility_plan' => [],
            'validation_plan' => [],
            'publication_plan' => [],
            'open_questions' => $this->normalizeOpenQuestions($data),
            'provenance' => [
                'source' => 'study_intent_service',
                'provider' => $provider,
                'model' => $model,
                'generated_at' => now()->toIso8601String(),
            ],
        ];

        return $this->normalize($spec, $study, $researchQuestion);
    }

    /**
     * @return array<string, mixed>
     */
    private function unwrapPayload(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $data = $payload['data'] ?? $payload['result'] ?? $payload['output'] ?? $payload;
        if (is_array($data) && isset($data['data']) && is_array($data['data'])) {
            $data = $data['data'];
        }

        return is_array($data) ? $data : [];
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizeStudy(mixed $studySpec, Study $study, string $researchQuestion): array
    {
        $studySpec = is_array($studySpec) ? $studySpec : [];

        return [
            'title' => $this->stringValue($studySpec['title'] ?? $study->title),
            'short_title' => $studySpec['short_title'] ?? $study->short_title,
            'research_question' => $this->stringValue($studySpec['research_question'] ?? $researchQuestion),
            'scientific_rationale' => $this->stringValue($studySpec['scientific_rationale'] ?? ''),
            'hypothesis' => $this->stringValue($studySpec['hypothesis'] ?? ''),
            'primary_objective' => $this->stringValue($studySpec['primary_objective'] ?? $researchQuestion),
            'secondary_objectives' => $this->listValue($studySpec['secondary_objectives'] ?? []),
            'study_design' => $this->stringValue($studySpec['study_design'] ?? $study->study_design ?? 'observational'),
            'study_type' => $this->stringValue($studySpec['study_type'] ?? $study->study_type ?? 'custom'),
            'target_population_summary' => $this->stringValue($studySpec['target_population_summary'] ?? ''),
            'estimand' => $this->objectValue($studySpec['estimand'] ?? []),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function normalizePico(mixed $pico): array
    {
        $pico = is_array($pico) ? $pico : [];

        return [
            'population' => $this->objectWithSummary($pico['population'] ?? []),
            'intervention_or_exposure' => $this->objectWithSummary($pico['intervention_or_exposure'] ?? $pico['intervention'] ?? []),
            'comparator' => $this->objectWithSummary($pico['comparator'] ?? []),
            'outcomes' => $this->normalizeOutcomes($pico['outcomes'] ?? []),
            'time' => $this->objectWithSummary($pico['time'] ?? []),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function objectWithSummary(mixed $value): array
    {
        if (is_string($value)) {
            return ['summary' => trim($value)];
        }

        $object = $this->objectValue($value);
        $object['summary'] = $this->stringValue($object['summary'] ?? '');

        return $object;
    }

    /**
     * @return list<mixed>
     */
    private function listValue(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_values($value);
    }

    /**
     * @return array<string, mixed>
     */
    private function objectValue(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        return array_is_list($value) ? [] : $value;
    }

    private function stringValue(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function normalizeOutcomes(mixed $outcomes): array
    {
        if (is_string($outcomes)) {
            return [['summary' => trim($outcomes), 'primary' => true]];
        }

        if (! is_array($outcomes)) {
            return [];
        }

        $normalized = [];
        foreach (array_values($outcomes) as $index => $outcome) {
            $item = is_array($outcome) ? $outcome : ['summary' => $this->stringValue($outcome)];
            $item['summary'] = $this->stringValue($item['summary'] ?? '');
            $item['primary'] = (bool) ($item['primary'] ?? $index === 0);
            $normalized[] = $item;
        }

        return $normalized;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private function normalizeOpenQuestions(array $data): array
    {
        $questions = $this->listValue($data['open_questions'] ?? $data['questions'] ?? []);

        if ($questions === []) {
            foreach (['target_population', 'exposure', 'comparator', 'outcome', 'time'] as $field) {
                if ($this->stringValue($data[$field] ?? '') === '') {
                    $questions[] = [
                        'field' => $field,
                        'question' => "Clarify the {$field} for this study.",
                        'severity' => 'blocking',
                    ];
                }
            }
        }

        return array_map(function (mixed $question): array {
            if (is_string($question)) {
                return ['question' => $question, 'severity' => 'review'];
            }

            return is_array($question) ? $question : ['question' => 'Clarify this study design assumption.', 'severity' => 'review'];
        }, $questions);
    }

    /**
     * @param  array<string, mixed>  $spec
     * @return array<string, mixed>
     */
    private function lint(array $spec): array
    {
        $issues = [];
        $pico = $spec['pico'];

        foreach ([
            'population' => 'Population',
            'intervention_or_exposure' => 'Intervention or exposure',
            'comparator' => 'Comparator',
            'time' => 'Time frame',
        ] as $key => $label) {
            if ($this->stringValue($pico[$key]['summary'] ?? '') === '') {
                $issues[] = [
                    'severity' => $key === 'comparator' ? 'review' : 'blocking',
                    'field' => "pico.{$key}",
                    'message' => "{$label} is not yet specified.",
                ];
            }
        }

        if (($pico['outcomes'] ?? []) === []) {
            $issues[] = [
                'severity' => 'blocking',
                'field' => 'pico.outcomes',
                'message' => 'At least one outcome is required before cohort drafting.',
            ];
        }

        return [
            'status' => collect($issues)->contains(fn (array $issue) => $issue['severity'] === 'blocking') ? 'needs_review' : 'ready',
            'issues' => $issues,
        ];
    }
}
