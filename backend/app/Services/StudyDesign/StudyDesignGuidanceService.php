<?php

namespace App\Services\StudyDesign;

use App\Models\App\Study;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class StudyDesignGuidanceService
{
    public function __construct(
        private readonly StudyDesignContextBuilder $contextBuilder,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(Study $study, StudyDesignSession $session, StudyDesignVersion $version): array
    {
        $context = $this->contextBuilder->build($study, $session, $version);
        $initialGate = $this->initialGate($context);
        $sections = [
            $this->intentSection($context, $initialGate),
            $this->conceptSetSection($context),
            $this->cohortSection($context),
            $this->feasibilitySection($context),
            $this->analysisSection($context),
            $this->humanReviewSection($context),
            $this->packageLockSection($context),
        ];

        return [
            'schema_version' => 'study-design-guidance.v1',
            'generated_at' => now()->toISOString(),
            'mode' => 'abby_compiler_harness',
            'policy' => 'Abby guidance summarizes Study Design Compiler state and read-only readiness evidence. It does not mutate canonical study records.',
            'study' => $context['study'],
            'session' => $context['session'],
            'version' => $context['version'],
            'initial_gate' => $initialGate,
            'sections' => $sections,
            'next_best_actions' => $this->nextBestActions($sections, $initialGate),
            'action_targets' => $context['action_targets'] ?? [],
            'provenance' => [
                'context_schema_version' => $context['schema_version'] ?? null,
                'readiness_sources' => ['StudyDesignContextBuilder', 'StudyDesignReadinessService', 'StudyCohortReadinessService'],
                'raw_protocol_text_included' => false,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function initialGate(array $context): array
    {
        $version = $this->object($context['version'] ?? []);
        $intent = $this->object($version['intent'] ?? []);
        $spec = $this->object($version['normalized_spec'] ?? []);
        $gate = $this->object($intent['initial_gate'] ?? $spec['initial_gate'] ?? []);
        $issues = $this->listOfObjects($gate['issues'] ?? []);

        foreach ($this->missingIntentIssues($intent, $spec) as $issue) {
            $issues[] = $issue;
        }

        $issues = $this->dedupeIssues($issues);
        $blockingCount = collect($issues)
            ->filter(fn (array $issue): bool => $this->isBlockingSeverity($issue['severity'] ?? null))
            ->count();
        $status = strtolower($this->text($gate['status'] ?? ''));
        if ($status === '') {
            $status = $blockingCount > 0 ? 'failed' : 'ready';
        }
        if ($blockingCount > 0 && in_array($status, ['ready', 'pass', 'passed'], true)) {
            $status = 'failed';
        }

        return [
            'status' => in_array($status, ['pass', 'passed'], true) ? 'ready' : $status,
            'summary' => $this->text($gate['summary'] ?? '') ?: ($blockingCount > 0
                ? 'The current intent is missing details required before downstream compiler steps.'
                : 'The current intent has enough detail for Study Design review.'),
            'blocking_count' => $blockingCount,
            'issues' => $issues,
            'action' => $blockingCount > 0
                ? $this->action('resolve_initial_gate', 'Resolve initial protocol gate issues', 'blocking', [
                    'issue_count' => $blockingCount,
                ])
                : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $context
     * @param  array<string, mixed>  $initialGate
     * @return array<string, mixed>
     */
    private function intentSection(array $context, array $initialGate): array
    {
        $version = $this->object($context['version'] ?? []);
        $status = $this->text($version['status'] ?? '');
        $accepted = in_array($status, ['accepted', 'locked'], true);
        $gateBlocked = (int) ($initialGate['blocking_count'] ?? 0) > 0;
        $actions = [];

        if ($gateBlocked) {
            $actions[] = $this->action('resolve_initial_gate', 'Clarify missing protocol fields', 'blocking');
        } elseif (! $accepted) {
            $actions[] = $this->action('accept_intent', 'Accept reviewed design intent', 'high');
        }

        return $this->section(
            'intent',
            'Design Intent',
            $gateBlocked ? 'blocked' : ($accepted ? 'complete' : 'ready'),
            $gateBlocked
                ? 'Initial protocol gate issues must be resolved before the compiler can safely proceed.'
                : ($accepted ? 'The design intent has been accepted.' : 'The design intent is ready for human ratification.'),
            [
                'version_status' => $status,
                'initial_gate_status' => $initialGate['status'] ?? null,
            ],
            $initialGate['issues'] ?? [],
            [],
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function conceptSetSection(array $context): array
    {
        $assets = $this->assets($context);
        $concepts = $assets->filter(fn (array $asset): bool => in_array((string) ($asset['asset_type'] ?? ''), [
            'concept_set_draft',
            'imported_concept_set',
            'local_concept_set',
        ], true));
        $verified = $concepts->filter(fn (array $asset): bool => ($asset['verification_status'] ?? '') === 'verified');
        $materialized = $concepts->filter(fn (array $asset): bool => $this->text($this->object($asset['materialized'] ?? [])['id'] ?? '') !== '');
        $blocked = $concepts->filter(fn (array $asset): bool => ($asset['verification_status'] ?? '') === 'blocked');
        $unverified = $concepts->filter(fn (array $asset): bool => in_array((string) ($asset['verification_status'] ?? ''), ['', 'unverified'], true));
        $actions = [];

        if ($concepts->isEmpty()) {
            $actions[] = $this->action('draft_concept_sets', 'Draft protocol concept sets', 'high');
        }
        if ($unverified->isNotEmpty()) {
            $actions[] = $this->action('verify_concept_sets', 'Verify OMOP concept IDs', 'high', [
                'asset_ids' => $unverified->pluck('id')->values()->all(),
            ]);
        }
        if ($verified->isNotEmpty() && $materialized->count() < $verified->count()) {
            $actions[] = $this->action('materialize_concept_sets', 'Materialize verified concept sets', 'medium');
        }

        return $this->section(
            'concept_sets',
            'Concept Sets',
            $blocked->isNotEmpty() ? 'blocked' : ($materialized->isNotEmpty() ? 'complete' : ($concepts->isEmpty() ? 'pending' : 'needs_review')),
            $materialized->isNotEmpty()
                ? "{$materialized->count()} materialized concept set asset(s) are available."
                : ($concepts->isEmpty() ? 'No concept set drafts are available yet.' : 'Concept set drafts need vocabulary verification and materialization.'),
            [
                'total' => $concepts->count(),
                'verified' => $verified->count(),
                'materialized' => $materialized->count(),
                'blocked' => $blocked->count(),
            ],
            $this->assetIssues($blocked, 'blocked_concept_set', 'Concept set asset is blocked by vocabulary or verification issues.'),
            [],
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function cohortSection(array $context): array
    {
        $readiness = $this->object($this->object($context['readiness'] ?? [])['cohorts'] ?? []);
        $ready = ($readiness['ready'] ?? false) === true;
        $blockers = $this->listOfObjects($readiness['blockers'] ?? []);
        $warnings = $this->listOfObjects($readiness['warnings'] ?? []);
        $actions = $this->actionsFromTargets($readiness['action_targets'] ?? []);

        if ($actions === [] && ! $ready) {
            $actions[] = $this->action('draft_or_link_cohorts', 'Draft, materialize, or link required cohorts', 'high');
        }

        return $this->section(
            'cohorts',
            'Cohorts',
            $ready ? 'complete' : 'blocked',
            $ready ? 'Required cohorts are linked and ready for feasibility.' : 'Required study cohorts are missing, unlinked, or not yet verified.',
            [
                'ready_for_feasibility' => $readiness['ready_for_feasibility'] ?? false,
                'missing_roles' => $readiness['missing_roles'] ?? [],
                'present_roles' => $readiness['present_roles'] ?? [],
            ],
            $blockers,
            $warnings,
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function feasibilitySection(array $context): array
    {
        $package = $this->object($this->object($context['readiness'] ?? [])['package_lock'] ?? []);
        $cohorts = $this->object($this->object($context['readiness'] ?? [])['cohorts'] ?? []);
        $feasibilityReady = ($package['feasibility_ready'] ?? false) === true;
        $cohortReady = ($cohorts['ready_for_feasibility'] ?? false) === true;
        $actions = [];

        if (! $cohortReady) {
            $actions[] = $this->action('resolve_cohort_readiness', 'Link required cohorts before feasibility', 'blocking');
        } elseif (! $feasibilityReady) {
            $actions[] = $this->action('run_feasibility', 'Run source feasibility', 'high');
        }

        $blockers = $feasibilityReady ? [] : array_values(array_filter(
            $this->listOfObjects($package['blockers'] ?? []),
            fn (array $issue): bool => str_contains(strtolower((string) ($issue['message'] ?? '')), 'feasibility'),
        ));

        return $this->section(
            'feasibility',
            'Feasibility',
            $feasibilityReady ? 'complete' : ($cohortReady ? 'ready' : 'blocked'),
            $feasibilityReady ? 'Ready source feasibility evidence is present.' : ($cohortReady ? 'Cohorts are ready; run feasibility against selected sources.' : 'Feasibility is waiting on cohort readiness.'),
            [
                'feasibility_ready' => $feasibilityReady,
                'cohorts_ready_for_feasibility' => $cohortReady,
            ],
            $blockers,
            [],
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function analysisSection(array $context): array
    {
        $assets = $this->assets($context);
        $analysis = $assets->filter(fn (array $asset): bool => in_array((string) ($asset['asset_type'] ?? ''), [
            'analysis_plan',
            'imported_study_analysis',
        ], true));
        $verified = $analysis->filter(fn (array $asset): bool => ($asset['verification_status'] ?? '') === 'verified');
        $blocked = $analysis->filter(fn (array $asset): bool => ($asset['verification_status'] ?? '') === 'blocked');
        $materialized = $analysis->filter(fn (array $asset): bool => $this->text($this->object($asset['materialized'] ?? [])['id'] ?? '') !== '');
        $package = $this->object($this->object($context['readiness'] ?? [])['package_lock'] ?? []);
        $ready = ($package['analysis_plan_ready'] ?? false) === true;
        $actions = [];

        if ($analysis->isEmpty()) {
            $actions[] = $this->action('draft_analysis_plans', 'Draft analysis plans from accepted intent', 'high');
        }
        if ($blocked->isNotEmpty()) {
            $actions[] = $this->action('resolve_analysis_blockers', 'Resolve analysis blockers', 'blocking', [
                'asset_ids' => $blocked->pluck('id')->values()->all(),
            ]);
        }
        if ($verified->isNotEmpty() && $materialized->count() < $verified->count()) {
            $actions[] = $this->action('materialize_analysis_plans', 'Materialize verified analysis plans', 'medium');
        }

        return $this->section(
            'analysis_plans',
            'Analysis Plans',
            $ready ? 'complete' : ($blocked->isNotEmpty() ? 'blocked' : ($analysis->isEmpty() ? 'pending' : 'needs_review')),
            $ready ? 'At least one verified materialized analysis plan is ready.' : ($analysis->isEmpty() ? 'No analysis plans have been drafted yet.' : 'Analysis plans need verification, feasibility evidence, and materialization.'),
            [
                'total' => $analysis->count(),
                'verified' => $verified->count(),
                'materialized' => $materialized->count(),
                'blocked' => $blocked->count(),
            ],
            $this->assetIssues($blocked, 'blocked_analysis_plan', 'Analysis plan asset is blocked by HADES, feasibility, or parameter issues.'),
            [],
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function humanReviewSection(array $context): array
    {
        $assets = $this->assets($context);
        $needsReview = $assets->filter(fn (array $asset): bool => in_array((string) ($asset['status'] ?? ''), ['needs_review', 'draft', 'unreviewed'], true));
        $blocked = $assets->filter(fn (array $asset): bool => ($asset['verification_status'] ?? '') === 'blocked');
        $actions = [];

        if ($blocked->isNotEmpty()) {
            $actions[] = $this->action('repair_blocked_assets', 'Repair blocked compiler assets', 'blocking', [
                'asset_ids' => $blocked->pluck('id')->values()->all(),
            ]);
        }
        if ($needsReview->isNotEmpty()) {
            $actions[] = $this->action('review_assets', 'Accept, reject, or defer reviewable assets', 'high', [
                'asset_ids' => $needsReview->pluck('id')->take(20)->values()->all(),
            ]);
        }

        return $this->section(
            'human_review',
            'Human Review',
            $blocked->isNotEmpty() ? 'blocked' : ($needsReview->isEmpty() ? 'complete' : 'needs_review'),
            $needsReview->isEmpty()
                ? 'All visible compiler assets have review decisions.'
                : "{$needsReview->count()} compiler asset(s) still need a human review decision.",
            [
                'needs_review' => $needsReview->count(),
                'blocked' => $blocked->count(),
            ],
            $this->assetIssues($blocked, 'blocked_asset', 'Compiler asset is blocked and needs repair before acceptance.'),
            [],
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function packageLockSection(array $context): array
    {
        $package = $this->object($this->object($context['readiness'] ?? [])['package_lock'] ?? []);
        $ready = ($package['ready'] ?? false) === true;
        $locked = ($package['locked'] ?? false) === true;
        $blockers = $this->listOfObjects($package['blockers'] ?? []);
        $warnings = $this->listOfObjects($package['warnings'] ?? []);
        $actions = [];

        if ($ready && ! $locked) {
            $actions[] = $this->action('lock_version', 'Lock and package the Study Design version', 'high');
        } elseif (! $ready) {
            $actions[] = $this->action('resolve_lock_readiness', 'Resolve package lock checklist blockers', 'high');
        }

        return $this->section(
            'package_lock',
            'Package Lock',
            $locked ? 'complete' : ($ready ? 'ready' : 'blocked'),
            $locked ? 'The Study Design package is locked.' : ($ready ? 'Package lock is ready after final review.' : 'Package lock is blocked by checklist items.'),
            [
                'ready' => $ready,
                'can_lock' => $package['can_lock'] ?? false,
                'checklist' => $package['checklist'] ?? [],
                'summary' => $package['summary'] ?? [],
            ],
            $blockers,
            $warnings,
            $actions,
        );
    }

    /**
     * @param  array<string, mixed>  $context
     * @return Collection<int, array<string, mixed>>
     */
    private function assets(array $context): Collection
    {
        $assets = $this->object($context['assets'] ?? []);

        return collect($this->listOfObjects($assets['items'] ?? []))
            ->values();
    }

    /**
     * @param  list<array<string, mixed>>  $sections
     * @param  array<string, mixed>  $initialGate
     * @return list<array<string, mixed>>
     */
    private function nextBestActions(array $sections, array $initialGate): array
    {
        if ((int) ($initialGate['blocking_count'] ?? 0) > 0) {
            return [array_filter([
                ...$this->action('resolve_initial_gate', 'Resolve initial Study Design gate issues', 'blocking'),
                'issues' => $initialGate['issues'] ?? [],
            ])];
        }

        $priority = ['blocking' => 0, 'high' => 1, 'medium' => 2, 'low' => 3];
        $actions = collect($sections)
            ->flatMap(fn (array $section): array => collect($section['actions'] ?? [])
                ->map(fn (array $action): array => ['section' => $section['id'], ...$action])
                ->all())
            ->sortBy(fn (array $action): int => $priority[$action['priority'] ?? 'low'] ?? 9)
            ->values()
            ->take(5)
            ->all();

        return $actions;
    }

    /**
     * @return array<string, mixed>
     */
    private function section(string $id, string $label, string $status, string $summary, array $counts, array $blockers, array $warnings, array $actions): array
    {
        return [
            'id' => $id,
            'label' => $label,
            'status' => $status,
            'summary' => $summary,
            'counts' => $counts,
            'blockers' => $blockers,
            'warnings' => $warnings,
            'actions' => $actions,
        ];
    }

    /**
     * @param  array<string, mixed>  $details
     * @return array<string, mixed>
     */
    private function action(string $type, string $label, string $priority, array $details = []): array
    {
        return array_filter([
            'type' => $type,
            'label' => $label,
            'priority' => $priority,
            'details' => $details,
        ], fn (mixed $value): bool => $value !== [] && $value !== '');
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function actionsFromTargets(mixed $targets): array
    {
        return collect($this->listOfObjects($targets))
            ->map(function (array $target): array {
                $type = $this->text($target['type'] ?? 'resolve_readiness_target') ?: 'resolve_readiness_target';

                return $this->action($type, Str::headline(str_replace('_', ' ', $type)), 'high', $target);
            })
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $assets
     * @return list<array<string, mixed>>
     */
    private function assetIssues(Collection $assets, string $code, string $message): array
    {
        return $assets
            ->map(fn (array $asset): array => [
                'code' => $code,
                'severity' => 'blocking',
                'asset_id' => $asset['id'] ?? null,
                'asset_type' => $asset['asset_type'] ?? null,
                'role' => $asset['role'] ?? null,
                'message' => $message,
                'verification' => $asset['verification'] ?? [],
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $intent
     * @param  array<string, mixed>  $spec
     * @return list<array<string, mixed>>
     */
    private function missingIntentIssues(array $intent, array $spec): array
    {
        $pico = $this->object($intent['pico'] ?? $spec['pico'] ?? []);
        $issues = [];

        foreach ([
            'research_question' => ['label' => 'Research question', 'value' => $intent['research_question'] ?? $spec['study']['research_question'] ?? null],
            'primary_objective' => ['label' => 'Primary objective', 'value' => $intent['primary_objective'] ?? $spec['study']['primary_objective'] ?? null],
            'population' => ['label' => 'Population', 'value' => $pico['population'] ?? $spec['study']['target_population_summary'] ?? null],
            'exposure' => ['label' => 'Exposure or index event', 'value' => $pico['intervention'] ?? $pico['exposure'] ?? null],
            'outcome' => ['label' => 'Primary outcome', 'value' => $pico['outcome'] ?? null],
            'time_at_risk' => ['label' => 'Time at risk', 'value' => $pico['time_at_risk'] ?? null],
        ] as $field => $definition) {
            if ($this->isMissingProtocolValue($this->text($definition['value'] ?? ''))) {
                $issues[] = [
                    'field' => $field,
                    'severity' => 'blocking',
                    'message' => "{$definition['label']} is missing or not specific enough for compiler guidance.",
                    'source' => 'guidance_gate',
                ];
            }
        }

        return $issues;
    }

    /**
     * @param  list<array<string, mixed>>  $issues
     * @return list<array<string, mixed>>
     */
    private function dedupeIssues(array $issues): array
    {
        $seen = [];

        return array_values(array_filter($issues, function (array $issue) use (&$seen): bool {
            $field = $this->text($issue['field'] ?? '');
            $message = $this->text($issue['message'] ?? '');
            $key = $field !== '' ? $field : $message;
            if ($key === '') {
                return false;
            }
            if (isset($seen[$key])) {
                return false;
            }
            $seen[$key] = true;

            return true;
        }));
    }

    private function isMissingProtocolValue(string $value): bool
    {
        $normalized = strtolower(trim($value));

        return $normalized === ''
            || in_array($normalized, ['n/a', 'na', 'none', 'not applicable', 'not specified', 'unspecified', 'unknown', 'tbd', 'to be determined'], true)
            || strlen($normalized) < 4;
    }

    private function isBlockingSeverity(mixed $severity): bool
    {
        return in_array(strtolower($this->text($severity)), ['blocking', 'blocked', 'high', 'fail', 'failed', 'error'], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function object(mixed $value): array
    {
        return is_array($value) && ! array_is_list($value) ? $value : [];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function listOfObjects(mixed $value): array
    {
        return array_values(array_filter(is_array($value) ? $value : [], fn (mixed $item): bool => is_array($item)));
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }
}
