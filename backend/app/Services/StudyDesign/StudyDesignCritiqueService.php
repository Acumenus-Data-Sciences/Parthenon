<?php

namespace App\Services\StudyDesign;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;

class StudyDesignCritiqueService
{
    /**
     * @return list<StudyDesignAsset>
     */
    public function critique(Study $study, StudyDesignSession $session, StudyDesignVersion $version, int $userId): array
    {
        $findings = [
            ...$this->picoFindings($version),
            ...$this->cohortFindings($study),
            ...$this->feasibilityFindings($session, $version),
            ...$this->analysisFindings($study),
        ];

        StudyDesignAiEvent::create([
            'session_id' => $session->id,
            'version_id' => $version->id,
            'created_by' => $userId,
            'event_type' => 'design_critique',
            'provider' => 'deterministic',
            'model' => null,
            'prompt_template_version' => 'study-design-critique-v1',
            'input_summary_json' => [
                'study_id' => $study->id,
                'version_id' => $version->id,
                'cohort_count' => $study->cohorts()->count(),
                'analysis_count' => $study->analyses()->count(),
            ],
            'output_json' => [
                'finding_count' => count($findings),
                'findings' => $findings,
            ],
            'safety_flags_json' => [[
                'type' => 'no_patient_data',
                'message' => 'Critique used study metadata, design assets, cohort definitions, and analysis metadata only.',
            ]],
            'latency_ms' => null,
        ]);

        return collect($findings)
            ->map(fn (array $finding): StudyDesignAsset => $this->storeFinding($session, $version, $finding))
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function picoFindings(StudyDesignVersion $version): array
    {
        $findings = [];
        $lintIssues = (array) data_get($version->lint_results_json, 'issues', []);
        foreach ($lintIssues as $issue) {
            if (! is_array($issue)) {
                continue;
            }

            $findings[] = $this->finding(
                'pico_gap',
                (string) ($issue['severity'] ?? 'review'),
                (string) ($issue['message'] ?? 'Review missing PICO information.'),
                [
                    'field' => $issue['field'] ?? null,
                    'source' => 'study_design_lint',
                ],
            );
        }

        return $findings;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function cohortFindings(Study $study): array
    {
        $findings = [];
        $studyCohorts = $study->cohorts()->with('cohortDefinition')->orderBy('sort_order')->get();
        $roles = $studyCohorts
            ->pluck('role')
            ->map(fn (string $role): string => $this->normalizeRole($role))
            ->unique()
            ->values()
            ->all();

        if (! in_array('target', $roles, true)) {
            $findings[] = $this->finding('missing_target_cohort', 'blocking', 'Add or map a target cohort before feasibility and analysis.', [
                'roles' => $roles,
            ]);
        }

        if (str_contains((string) $study->study_type, 'comparative') && ! in_array('comparator', $roles, true)) {
            $findings[] = $this->finding('missing_comparator_cohort', 'review', 'Comparative studies usually need a comparator cohort.', [
                'study_type' => $study->study_type,
            ]);
        }

        foreach ($studyCohorts as $cohort) {
            if ($cohort->cohortDefinition?->isDeprecated() === true) {
                $findings[] = $this->finding('deprecated_cohort', 'blocking', 'Replace deprecated cohort definitions before lock or execution.', [
                    'study_cohort_id' => $cohort->id,
                    'cohort_definition_id' => $cohort->cohort_definition_id,
                ]);
            }

            if (($cohort->concept_set_ids ?? []) === []) {
                $findings[] = $this->finding('missing_concept_metadata', 'review', 'A linked study cohort is missing concept set traceability.', [
                    'study_cohort_id' => $cohort->id,
                    'cohort_definition_id' => $cohort->cohort_definition_id,
                    'role' => $this->normalizeRole($cohort->role),
                ]);
            }
        }

        return $findings;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function feasibilityFindings(StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $latest = $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'feasibility_result')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->first();
        $payload = is_array($latest?->draft_payload_json) ? $latest->draft_payload_json : [];

        if ($latest === null) {
            return [$this->finding('missing_feasibility_evidence', 'blocking', 'Run source-aware feasibility before analysis planning or lock.', [])];
        }

        if (($payload['status'] ?? null) !== 'ready') {
            return [$this->finding('feasibility_not_ready', 'blocking', 'Resolve feasibility blockers before analysis planning or lock.', [
                'asset_id' => $latest->id,
                'status' => $payload['status'] ?? 'unknown',
            ])];
        }

        return [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function analysisFindings(Study $study): array
    {
        $findings = [];
        $roles = $study->cohorts()
            ->pluck('role')
            ->map(fn (string $role): string => $this->normalizeRole($role))
            ->unique()
            ->values()
            ->all();

        $study->analyses()
            ->orderBy('id')
            ->get()
            ->each(function (StudyAnalysis $analysis) use (&$findings, $roles): void {
                $type = (string) ($analysis->toArray()['analysis_type'] ?? 'unknown');
                $required = match ($type) {
                    'estimation' => ['target', 'comparator', 'outcome'],
                    'prediction', 'sccs', 'self_controlled_cohort' => ['target', 'outcome'],
                    'pathway' => ['target', 'comparator'],
                    default => ['target'],
                };
                $missing = array_values(array_diff($required, $roles));

                if ($missing !== []) {
                    $findings[] = $this->finding('analysis_missing_required_roles', 'blocking', 'A native analysis is missing required study cohort roles.', [
                        'study_analysis_id' => $analysis->id,
                        'analysis_type' => $type,
                        'missing_roles' => $missing,
                    ]);
                }
            });

        return $findings;
    }

    /**
     * @param  array<string, mixed>  $finding
     */
    private function storeFinding(StudyDesignSession $session, StudyDesignVersion $version, array $finding): StudyDesignAsset
    {
        $severity = (string) ($finding['severity'] ?? 'review');

        return StudyDesignAsset::create([
            'session_id' => $session->id,
            'version_id' => $version->id,
            'asset_type' => 'design_critique',
            'role' => $finding['meta']['role'] ?? null,
            'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
            'draft_payload_json' => $finding,
            'provenance_json' => [
                'source' => 'study_designer_critique',
                'generated_at' => now()->toIso8601String(),
            ],
            'verification_status' => StudyDesignVerificationStatus::VERIFIED->value,
            'verification_json' => [
                'status' => StudyDesignVerificationStatus::VERIFIED->value,
                'eligibility' => [
                    'can_accept' => true,
                    'can_materialize' => false,
                    'reason' => 'Critique findings are reviewable suggestions and never mutate canonical study assets directly.',
                ],
                'blocking_reasons' => [],
                'warnings' => $severity === 'blocking' ? [] : [$finding['message']],
                'checks' => [[
                    'name' => (string) ($finding['code'] ?? 'design_critique'),
                    'status' => $severity === 'blocking' ? 'warn' : 'info',
                    'message' => (string) ($finding['message'] ?? 'Review this design critique.'),
                    'meta' => (array) ($finding['meta'] ?? []),
                ]],
                'accepted_downstream_actions' => ['acknowledge', 'create_superseding_version'],
                'acceptance_policy' => 'Accepted critique assets document reviewer acknowledgement only.',
            ],
            'verified_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private function finding(string $code, string $severity, string $message, array $meta): array
    {
        return [
            'code' => $code,
            'severity' => $severity,
            'message' => $message,
            'meta' => $meta,
            'policy' => 'Bottom-up critique creates reviewable design findings without changing existing cohorts, analyses, or study metadata.',
        ];
    }

    private function normalizeRole(string $role): string
    {
        return match (trim(strtolower($role))) {
            'population', 'exposure', 'intervention' => 'target',
            'comparator', 'outcome', 'exclusion', 'subgroup', 'event' => trim(strtolower($role)),
            default => 'target',
        };
    }
}
