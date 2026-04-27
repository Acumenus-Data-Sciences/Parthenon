<?php

namespace App\Services\StudyDesign;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\PhenotypeLibraryEntry;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class StudyDesignToolRunner
{
    /**
     * @var list<string>
     */
    public const READ_ONLY_TOOLS = [
        'study_design_get_context',
        'study_design_readiness_check',
        'vocabulary_search_concepts',
        'vocabulary_validate_concepts',
        'phenotype_search_library',
        'local_concept_set_search',
        'local_cohort_search',
        'cohort_expression_validate',
        'data_source_profile',
        'draft_asset_patch',
        'hades_package_status',
    ];

    public function __construct(
        private readonly StudyDesignContextBuilder $contextBuilder,
        private readonly StudyCohortReadinessService $cohortReadinessService,
        private readonly StudyDesignReadinessService $readinessService,
    ) {}

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    public function run(string $tool, array $arguments = []): array
    {
        if (! in_array($tool, self::READ_ONLY_TOOLS, true)) {
            throw new InvalidArgumentException("Unsupported Study Design tool [{$tool}].");
        }

        return [
            'tool' => $tool,
            'ok' => true,
            'mode' => 'read_only',
            'data' => match ($tool) {
                'study_design_get_context' => $this->studyDesignContext($arguments),
                'study_design_readiness_check' => $this->studyDesignReadiness($arguments),
                'vocabulary_search_concepts' => $this->vocabularySearch($arguments),
                'vocabulary_validate_concepts' => $this->vocabularyValidate($arguments),
                'phenotype_search_library' => $this->phenotypeSearchLibrary($arguments),
                'local_concept_set_search' => $this->localConceptSetSearch($arguments),
                'local_cohort_search' => $this->localCohortSearch($arguments),
                'cohort_expression_validate' => $this->cohortExpressionValidate($arguments),
                'data_source_profile' => $this->dataSourceProfile($arguments),
                'draft_asset_patch' => $this->draftAssetPatch($arguments),
                'hades_package_status' => $this->hadesPackageStatus($arguments),
            },
        ];
    }

    /**
     * @return list<string>
     */
    public function tools(): array
    {
        return self::READ_ONLY_TOOLS;
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function studyDesignContext(array $arguments): array
    {
        [$study, $session, $version] = $this->resolveStudyDesignState($arguments);

        return $this->contextBuilder->build($study, $session, $version, [
            'max_assets' => $this->integerArgument($arguments, 'max_assets', 80, 1, 120),
            'max_ai_events' => $this->integerArgument($arguments, 'max_ai_events', 20, 1, 30),
            'max_artifacts' => $this->integerArgument($arguments, 'max_artifacts', 12, 1, 20),
        ]);
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function studyDesignReadiness(array $arguments): array
    {
        [$study, $session, $version] = $this->resolveStudyDesignState($arguments);

        if (! $version instanceof StudyDesignVersion) {
            throw new InvalidArgumentException('study_design_readiness_check requires a Study Design version.');
        }

        $cohorts = $this->cohortReadinessService->summarize($study, $session, $version);
        $package = $this->readinessService->lockReadiness($study, $session, $version);

        return [
            'cohorts' => $cohorts,
            'package_lock' => $package,
            'ready' => ($cohorts['ready'] ?? false) === true && ($package['ready'] ?? false) === true,
            'action_targets' => $this->actionTargets($cohorts, $package),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function vocabularySearch(array $arguments): array
    {
        $query = trim((string) ($arguments['query'] ?? $arguments['q'] ?? ''));
        if (mb_strlen($query) < 2) {
            throw new InvalidArgumentException('vocabulary_search_concepts requires a query of at least two characters.');
        }

        $limit = $this->integerArgument($arguments, 'limit', 10, 1, 25);
        $domain = trim((string) ($arguments['domain'] ?? ''));
        $vocabulary = trim((string) ($arguments['vocabulary'] ?? ''));
        $standard = $arguments['standard'] ?? true;

        $builder = DB::table('vocab.concept')
            ->select([
                'concept_id',
                'concept_name',
                'domain_id',
                'vocabulary_id',
                'concept_class_id',
                'standard_concept',
                'concept_code',
                'invalid_reason',
            ])
            ->whereRaw('concept_name ILIKE ?', ['%'.$query.'%']);

        if ($domain !== '') {
            $builder->where('domain_id', $domain);
        }
        if ($vocabulary !== '') {
            $builder->where('vocabulary_id', $vocabulary);
        }
        if ($standard !== '') {
            $builder->where('standard_concept', $this->truthy($standard) ? 'S' : (string) $standard);
        }

        $items = $builder
            ->orderByRaw('CASE WHEN concept_name ILIKE ? THEN 0 ELSE 1 END, concept_name', [$query.'%'])
            ->limit($limit)
            ->get()
            ->map(fn (object $concept): array => $this->conceptSummary($concept))
            ->values()
            ->all();

        return [
            'query' => $query,
            'count' => count($items),
            'items' => $items,
            'policy' => 'Vocabulary search proposes candidate OMOP concepts only; Study Designer verification must validate IDs before materialization.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function vocabularyValidate(array $arguments): array
    {
        $ids = collect($arguments['concept_ids'] ?? [])
            ->filter(fn (mixed $id): bool => is_numeric($id))
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            throw new InvalidArgumentException('vocabulary_validate_concepts requires at least one concept ID.');
        }

        $rows = DB::table('vocab.concept')
            ->select([
                'concept_id',
                'concept_name',
                'domain_id',
                'vocabulary_id',
                'concept_class_id',
                'standard_concept',
                'concept_code',
                'invalid_reason',
            ])
            ->whereIn('concept_id', $ids)
            ->get()
            ->keyBy('concept_id');

        $concepts = [];
        $issues = [];
        foreach ($ids as $id) {
            $row = $rows->get($id);
            if (! is_object($row)) {
                $issues[] = [
                    'concept_id' => $id,
                    'status' => 'missing',
                    'severity' => 'blocking',
                    'message' => "Concept {$id} was not found in vocab.concept.",
                ];

                continue;
            }

            $summary = $this->conceptSummary($row);
            $concepts[] = $summary;

            if (($summary['standard_concept'] ?? null) !== 'S') {
                $issues[] = [
                    'concept_id' => $id,
                    'status' => 'non_standard',
                    'severity' => 'warning',
                    'message' => "Concept {$id} is not a standard OMOP concept.",
                ];
            }
            if (($summary['invalid_reason'] ?? null) !== null && ($summary['invalid_reason'] ?? '') !== '') {
                $issues[] = [
                    'concept_id' => $id,
                    'status' => 'deprecated',
                    'severity' => 'blocking',
                    'message' => "Concept {$id} is deprecated or invalid.",
                ];
            }
        }

        return [
            'concept_ids' => $ids,
            'valid' => collect($issues)->where('severity', 'blocking')->isEmpty(),
            'concepts' => $concepts,
            'issues' => $issues,
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function phenotypeSearchLibrary(array $arguments): array
    {
        $query = $this->searchQuery($arguments, 'phenotype_search_library');
        $limit = $this->integerArgument($arguments, 'limit', 8, 1, 15);
        $domain = trim((string) ($arguments['domain'] ?? ''));

        $builder = PhenotypeLibraryEntry::query()
            ->where(function ($builder) use ($query): void {
                $like = '%'.$query.'%';
                $builder->where('cohort_name', 'ILIKE', $like)
                    ->orWhere('description', 'ILIKE', $like)
                    ->orWhere('logic_description', 'ILIKE', $like)
                    ->orWhereRaw('tags::text ILIKE ?', [$like]);
            });

        if ($domain !== '') {
            $builder->where('domain', 'ILIKE', $domain);
        }

        $items = $builder
            ->orderByRaw('CASE WHEN cohort_name ILIKE ? THEN 0 ELSE 1 END, cohort_name', [$query.'%'])
            ->limit($limit)
            ->get()
            ->map(fn (PhenotypeLibraryEntry $entry): array => $this->phenotypeSummary($entry, $query))
            ->values()
            ->all();

        return [
            'query' => $query,
            'count' => count($items),
            'items' => $items,
            'policy' => 'Phenotype Library hits are reusable candidates only; Abby must still route accepted choices through deterministic Study Designer verification.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function localConceptSetSearch(array $arguments): array
    {
        $query = $this->searchQuery($arguments, 'local_concept_set_search');
        $limit = $this->integerArgument($arguments, 'limit', 8, 1, 15);

        $items = ConceptSet::query()
            ->withCount('items')
            ->where(function ($builder) use ($query): void {
                $like = '%'.$query.'%';
                $builder->where('name', 'ILIKE', $like)
                    ->orWhere('description', 'ILIKE', $like)
                    ->orWhereRaw('tags::text ILIKE ?', [$like]);
            })
            ->orderByRaw('CASE WHEN name ILIKE ? THEN 0 ELSE 1 END, name', [$query.'%'])
            ->limit($limit)
            ->get()
            ->map(fn (ConceptSet $conceptSet): array => $this->conceptSetSummary($conceptSet))
            ->values()
            ->all();

        return [
            'query' => $query,
            'count' => count($items),
            'items' => $items,
            'policy' => 'Local concept set search returns reuse candidates only; Study Designer materialization and verification remain explicit user actions.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function localCohortSearch(array $arguments): array
    {
        $query = $this->searchQuery($arguments, 'local_cohort_search');
        $limit = $this->integerArgument($arguments, 'limit', 8, 1, 15);
        $qualityTier = trim((string) ($arguments['quality_tier'] ?? ''));

        $builder = CohortDefinition::query()
            ->withCount(['generations', 'studyCohorts'])
            ->where(function ($builder) use ($query): void {
                $like = '%'.$query.'%';
                $builder->where('name', 'ILIKE', $like)
                    ->orWhere('description', 'ILIKE', $like)
                    ->orWhereRaw('tags::text ILIKE ?', [$like]);
            });

        if ($qualityTier !== '') {
            $builder->where('quality_tier', $qualityTier);
        }

        $items = $builder
            ->orderByRaw('CASE WHEN name ILIKE ? THEN 0 ELSE 1 END, name', [$query.'%'])
            ->limit($limit)
            ->get()
            ->map(fn (CohortDefinition $cohort): array => $this->cohortSummary($cohort))
            ->values()
            ->all();

        return [
            'query' => $query,
            'count' => count($items),
            'items' => $items,
            'policy' => 'Local cohort search returns reusable cohort definitions only; linking to a study role stays user-reviewed.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function cohortExpressionValidate(array $arguments): array
    {
        $expression = $this->cohortExpressionFromArguments($arguments);
        $conceptSets = array_values(array_filter((array) ($expression['ConceptSets'] ?? []), 'is_array'));
        $primaryCriteria = is_array($expression['PrimaryCriteria'] ?? null) ? $expression['PrimaryCriteria'] : [];
        $criteriaList = array_values(array_filter((array) ($primaryCriteria['CriteriaList'] ?? []), 'is_array'));
        $observationWindow = is_array($primaryCriteria['ObservationWindow'] ?? null) ? $primaryCriteria['ObservationWindow'] : [];
        $codesetIds = collect($conceptSets)
            ->pluck('id')
            ->filter(fn (mixed $id): bool => is_numeric($id))
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->values()
            ->all();
        $referencedCodesetIds = $this->referencedCodesetIds($criteriaList);
        $missingReferencedCodesets = array_values(array_diff($referencedCodesetIds, $codesetIds));

        $checks = [
            'has_expression_concept_sets' => $conceptSets !== [],
            'has_primary_criteria' => $criteriaList !== [],
            'primary_criteria_references_codesets' => $referencedCodesetIds !== [] && $missingReferencedCodesets === [],
            'has_observation_window' => is_numeric($observationWindow['PriorDays'] ?? null)
                && (int) $observationWindow['PriorDays'] >= 0
                && is_numeric($observationWindow['PostDays'] ?? null)
                && (int) $observationWindow['PostDays'] >= 0,
            'has_primary_and_expression_limits' => is_array($primaryCriteria['PrimaryCriteriaLimit'] ?? null)
                && is_array($expression['QualifiedLimit'] ?? null)
                && is_array($expression['ExpressionLimit'] ?? null),
            'has_collapse_settings' => is_array($expression['CollapseSettings'] ?? null)
                && ! empty($expression['CollapseSettings']['CollapseType']),
        ];
        $issues = $this->cohortExpressionIssues($checks, $missingReferencedCodesets);
        $valid = collect($issues)->where('severity', 'blocking')->isEmpty();

        return [
            'valid' => $valid,
            'status' => $valid ? 'pass' : 'blocked',
            'checks' => $checks,
            'issues' => $issues,
            'codeset_ids' => $codesetIds,
            'referenced_codeset_ids' => $referencedCodesetIds,
            'missing_referenced_codeset_ids' => $missingReferencedCodesets,
            'policy' => 'This validates Circe-compatible shape only; cohort materialization still requires Study Designer draft verification and user acceptance.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function dataSourceProfile(array $arguments): array
    {
        $limit = $this->integerArgument($arguments, 'limit', 5, 1, 10);
        $query = trim((string) ($arguments['query'] ?? $arguments['q'] ?? ''));
        $sourceId = isset($arguments['source_id']) && is_numeric($arguments['source_id']) ? (int) $arguments['source_id'] : null;
        $sourceKey = trim((string) ($arguments['source_key'] ?? ''));

        $builder = Source::query()->with('daimons');
        if ($sourceId !== null) {
            $builder->where('id', $sourceId);
        } elseif ($sourceKey !== '') {
            $builder->where('source_key', $sourceKey);
        } elseif ($query !== '') {
            $like = '%'.$query.'%';
            $builder->where(function ($builder) use ($like): void {
                $builder->where('source_name', 'ILIKE', $like)
                    ->orWhere('source_key', 'ILIKE', $like)
                    ->orWhere('source_type', 'ILIKE', $like);
            });
        }

        $items = $builder
            ->orderByDesc('is_default')
            ->orderBy('source_name')
            ->limit($limit)
            ->get()
            ->map(fn (Source $source): array => $this->sourceSummary($source))
            ->values()
            ->all();

        return [
            'query' => $query !== '' ? $query : null,
            'count' => count($items),
            'items' => $items,
            'policy' => 'Source profile summaries omit connection strings, usernames, passwords, db options, and source row samples.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function draftAssetPatch(array $arguments): array
    {
        [$study, $session, $version] = $this->resolveStudyDesignState($arguments);
        if (! $version instanceof StudyDesignVersion) {
            throw new InvalidArgumentException('draft_asset_patch requires a Study Design version.');
        }
        $assetId = $this->requiredInteger($arguments, 'asset_id');
        $asset = StudyDesignAsset::query()->findOrFail($assetId);

        if ((int) $asset->session_id !== (int) $session->id || (int) $asset->version_id !== (int) $version->id) {
            throw new InvalidArgumentException('Draft asset does not belong to the requested Study Design version.');
        }

        $patch = $arguments['patch'] ?? $arguments['patch_proposal'] ?? [];
        if (! is_array($patch) || array_is_list($patch)) {
            throw new InvalidArgumentException('draft_asset_patch requires patch to be an object.');
        }

        $currentPayload = is_array($asset->draft_payload_json) ? $asset->draft_payload_json : [];
        $sanitizedPatch = $this->sanitizeDraftPatch($asset, $patch);
        $mergedPayload = $this->mergeDraftPayload($currentPayload, $sanitizedPatch);
        $validation = $this->validateDraftPatchProposal($asset, $mergedPayload, $sanitizedPatch);
        $blocking = collect($validation['issues'] ?? [])->where('severity', 'blocking')->isNotEmpty();

        return [
            'schema_version' => 'draft-asset-patch.v1',
            'study' => [
                'id' => $study->id,
                'slug' => $study->slug,
            ],
            'session_id' => $session->id,
            'version_id' => $version->id,
            'asset' => [
                'id' => $asset->id,
                'asset_type' => $asset->asset_type,
                'role' => $asset->role,
                'status' => $this->enumValue($asset->status),
                'verification_status' => $this->enumValue($asset->verification_status),
            ],
            'patch' => $sanitizedPatch,
            'merged_payload_preview' => $this->safePayloadValue($mergedPayload),
            'validation' => $validation,
            'can_apply_after_user_review' => ! $blocking,
            'write_performed' => false,
            'policy' => 'draft_asset_patch validates and previews a draft payload patch only. It never writes canonical records or mutates the draft asset; the user must apply approved patches through the Study Designer UI/API.',
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function hadesPackageStatus(array $arguments): array
    {
        $requested = collect($arguments['packages'] ?? [])
            ->filter(fn (mixed $package): bool => is_scalar($package) && trim((string) $package) !== '')
            ->map(fn (mixed $package): string => trim((string) $package))
            ->unique()
            ->values()
            ->all();
        $inventory = $this->hadesInventory();
        $packages = collect($inventory['packages'] ?? [])
            ->filter(fn (mixed $package): bool => is_array($package))
            ->values();
        $selected = $requested === []
            ? $packages
            : $packages->filter(fn (array $package): bool => in_array((string) ($package['package'] ?? ''), $requested, true))->values();
        $foundNames = $selected->map(fn (array $package): string => (string) ($package['package'] ?? ''))->filter()->values()->all();

        foreach (array_values(array_diff($requested, $foundNames)) as $missing) {
            $selected->push([
                'package' => $missing,
                'installed' => false,
                'version' => null,
                'status' => 'missing_from_inventory',
            ]);
        }

        return [
            'status' => $inventory['status'] ?? 'unknown',
            'package_count' => $packages->count(),
            'installed_count' => $packages->filter(fn (array $package): bool => (bool) ($package['installed'] ?? false))->count(),
            'packages' => $selected
                ->map(fn (array $package): array => [
                    'package' => (string) ($package['package'] ?? ''),
                    'installed' => (bool) ($package['installed'] ?? false),
                    'version' => $package['version'] ?? null,
                    'surface' => $package['surface'] ?? null,
                    'priority' => $package['priority'] ?? null,
                    'status' => $package['status'] ?? ((bool) ($package['installed'] ?? false) ? 'installed' : 'not_installed'),
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array{Study, StudyDesignSession, StudyDesignVersion|null}
     */
    private function resolveStudyDesignState(array $arguments): array
    {
        $study = $this->resolveStudy($arguments);
        $sessionId = $this->requiredInteger($arguments, 'session_id');
        $session = StudyDesignSession::query()->findOrFail($sessionId);

        if ((int) $session->study_id !== (int) $study->id) {
            throw new InvalidArgumentException('Study Design session does not belong to the requested study.');
        }

        $versionId = isset($arguments['version_id']) && is_numeric($arguments['version_id'])
            ? (int) $arguments['version_id']
            : null;
        $version = $versionId
            ? StudyDesignVersion::query()->findOrFail($versionId)
            : $session->activeVersion()->first();

        if ($version instanceof StudyDesignVersion && (int) $version->session_id !== (int) $session->id) {
            throw new InvalidArgumentException('Study Design version does not belong to the requested session.');
        }

        return [$study, $session, $version];
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    private function resolveStudy(array $arguments): Study
    {
        if (isset($arguments['study_id']) && is_numeric($arguments['study_id'])) {
            return Study::query()->findOrFail((int) $arguments['study_id']);
        }

        $slug = trim((string) ($arguments['study_slug'] ?? $arguments['slug'] ?? ''));
        if ($slug === '') {
            throw new InvalidArgumentException('Study Design tools require study_id or study_slug.');
        }

        return Study::query()->where('slug', $slug)->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function hadesInventory(): array
    {
        $url = rtrim((string) config('services.darkstar.url', 'http://darkstar:8787'), '/');

        try {
            $payload = Http::timeout(8)->get("{$url}/hades/packages")->json();

            return is_array($payload) ? $payload : ['status' => 'malformed', 'packages' => []];
        } catch (\Throwable $exception) {
            Log::warning('Study Design tool runner could not retrieve HADES package inventory', [
                'message' => $exception->getMessage(),
            ]);

            return ['status' => 'unavailable', 'packages' => []];
        }
    }

    /**
     * @param  array<string, mixed>  $cohorts
     * @param  array<string, mixed>  $package
     * @return list<array<string, mixed>>
     */
    private function actionTargets(array $cohorts, array $package): array
    {
        $targets = [];
        foreach ([$cohorts, $package] as $payload) {
            foreach ($this->collectActionTargets($payload) as $target) {
                $targets[] = $target;
            }
        }

        return collect($targets)
            ->unique(fn (array $target): string => json_encode($target, JSON_THROW_ON_ERROR))
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function collectActionTargets(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $targets = [];
        if (isset($value['action']) && is_array($value['action'])) {
            $targets[] = $value['action'];
        }
        if (isset($value['action_targets']) && is_array($value['action_targets'])) {
            foreach ($value['action_targets'] as $target) {
                if (is_array($target)) {
                    $targets[] = $target;
                }
            }
        }

        foreach ($value as $nested) {
            if (is_array($nested)) {
                array_push($targets, ...$this->collectActionTargets($nested));
            }
        }

        return $targets;
    }

    private function requiredInteger(array $arguments, string $key): int
    {
        if (! isset($arguments[$key]) || ! is_numeric($arguments[$key])) {
            throw new InvalidArgumentException("Study Design tools require {$key}.");
        }

        return (int) $arguments[$key];
    }

    private function integerArgument(array $arguments, string $key, int $default, int $min, int $max): int
    {
        $value = isset($arguments[$key]) && is_numeric($arguments[$key]) ? (int) $arguments[$key] : $default;

        return max($min, min($max, $value));
    }

    /**
     * @return array<string, mixed>
     */
    private function conceptSummary(object $concept): array
    {
        return [
            'concept_id' => (int) $concept->concept_id,
            'concept_name' => (string) $concept->concept_name,
            'domain_id' => $concept->domain_id,
            'vocabulary_id' => $concept->vocabulary_id,
            'concept_class_id' => $concept->concept_class_id,
            'standard_concept' => $concept->standard_concept,
            'concept_code' => $concept->concept_code,
            'invalid_reason' => $concept->invalid_reason,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function phenotypeSummary(PhenotypeLibraryEntry $entry, string $query): array
    {
        $expression = is_array($entry->expression_json) ? $entry->expression_json : [];

        return [
            'phenotype_library_entry_id' => $entry->id,
            'cohort_id' => $entry->cohort_id,
            'cohort_name' => $entry->cohort_name,
            'domain' => $entry->domain,
            'severity' => $entry->severity,
            'tags' => array_values((array) ($entry->tags ?? [])),
            'is_imported' => (bool) $entry->is_imported,
            'imported_cohort_id' => $entry->imported_cohort_id,
            'has_expression' => $expression !== [],
            'expression_concept_set_count' => count((array) ($expression['ConceptSets'] ?? [])),
            'matched_fields' => $this->matchedFields($query, [
                'cohort_name' => $entry->cohort_name,
                'description' => $entry->description,
                'logic_description' => $entry->logic_description,
                'tags' => implode(' ', (array) ($entry->tags ?? [])),
            ]),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function conceptSetSummary(ConceptSet $conceptSet): array
    {
        $expression = is_array($conceptSet->expression_json) ? $conceptSet->expression_json : [];
        $items = array_values(array_filter((array) ($expression['items'] ?? $expression['Items'] ?? []), 'is_array'));
        $conceptIds = collect($items)
            ->map(fn (array $item): mixed => $item['concept_id'] ?? $item['concept']['CONCEPT_ID'] ?? $item['concept']['concept_id'] ?? null)
            ->filter(fn (mixed $id): bool => is_numeric($id))
            ->map(fn (mixed $id): int => (int) $id)
            ->unique()
            ->take(20)
            ->values()
            ->all();

        return [
            'concept_set_id' => $conceptSet->id,
            'name' => $conceptSet->name,
            'description' => $conceptSet->description,
            'is_public' => (bool) $conceptSet->is_public,
            'tags' => array_values((array) ($conceptSet->tags ?? [])),
            'item_count' => (int) ($conceptSet->items_count ?? count($items)),
            'expression_item_count' => count($items),
            'concept_id_preview' => $conceptIds,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function cohortSummary(CohortDefinition $cohort): array
    {
        $expressionPayload = $cohort->getAttribute('expression_json');
        $expression = is_array($expressionPayload) ? $expressionPayload : [];
        $conceptSets = array_values(array_filter((array) ($expression['ConceptSets'] ?? []), 'is_array'));
        $primaryCriteria = is_array($expression['PrimaryCriteria'] ?? null) ? $expression['PrimaryCriteria'] : [];

        return [
            'cohort_definition_id' => $cohort->id,
            'name' => $cohort->name,
            'description' => $cohort->description,
            'domain' => $this->enumValue($cohort->domain),
            'quality_tier' => $cohort->quality_tier,
            'is_public' => (bool) $cohort->is_public,
            'deprecated' => $cohort->deprecated_at !== null,
            'tags' => array_values((array) ($cohort->tags ?? [])),
            'generation_count' => (int) ($cohort->generations_count ?? 0),
            'study_use_count' => (int) ($cohort->study_cohorts_count ?? 0),
            'expression_summary' => [
                'has_expression' => $expression !== [],
                'concept_set_count' => count($conceptSets),
                'has_primary_criteria' => ! empty($primaryCriteria['CriteriaList'] ?? []),
                'has_observation_window' => is_array($primaryCriteria['ObservationWindow'] ?? null),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function sourceSummary(Source $source): array
    {
        $latestProfile = $source->sourceProfiles()->latest('id')->first();
        $latestRelease = $source->releases()->latest('created_at')->first();

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'source_key' => $source->source_key,
            'source_type' => $source->source_type,
            'source_dialect' => $source->source_dialect,
            'is_default' => (bool) $source->is_default,
            'is_cache_enabled' => (bool) $source->is_cache_enabled,
            'schemas' => $source->daimons
                ->map(fn (object $daimon): array => [
                    'daimon_type' => $this->enumValue($daimon->daimon_type),
                    'table_qualifier' => $daimon->table_qualifier,
                    'priority' => $daimon->priority,
                ])
                ->values()
                ->all(),
            'latest_profile' => $latestProfile ? [
                'scan_type' => $latestProfile->scan_type,
                'overall_grade' => $latestProfile->overall_grade,
                'table_count' => $latestProfile->table_count,
                'total_rows' => $latestProfile->total_rows,
                'row_count' => $latestProfile->row_count,
                'column_count' => $latestProfile->column_count,
                'updated_at' => optional($latestProfile->updated_at)->toISOString(),
            ] : null,
            'latest_release' => $latestRelease ? [
                'release_key' => $latestRelease->release_key,
                'release_name' => $latestRelease->release_name,
                'cdm_version' => $latestRelease->cdm_version,
                'vocabulary_version' => $latestRelease->vocabulary_version,
                'person_count' => $latestRelease->person_count,
                'record_count' => $latestRelease->record_count,
                'created_at' => optional($latestRelease->created_at)->toISOString(),
            ] : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $patch
     * @return array<string, mixed>
     */
    private function sanitizeDraftPatch(StudyDesignAsset $asset, array $patch): array
    {
        $allowed = $this->allowedDraftPatchKeys((string) $asset->asset_type);
        $sanitized = [];

        foreach ($patch as $key => $value) {
            if (! is_string($key) || ! in_array($key, $allowed, true)) {
                continue;
            }
            if (in_array($key, ['raw_protocol_text', 'protocol_text', 'source_rows', 'row_samples'], true)) {
                continue;
            }
            $sanitized[$key] = $this->safePayloadValue($value);
        }

        return $sanitized;
    }

    /**
     * @return list<string>
     */
    private function allowedDraftPatchKeys(string $assetType): array
    {
        return match ($assetType) {
            'concept_set_draft' => [
                'title',
                'role',
                'domain',
                'clinical_rationale',
                'search_terms',
                'source_references',
                'concepts',
            ],
            'cohort_draft' => [
                'title',
                'role',
                'description',
                'logic_description',
                'concept_set_ids',
                'concept_set_asset_ids',
                'source_asset_ids',
                'expression_json',
                'entry_event',
                'exit_strategy',
                'observation_window',
                'collapse_settings',
                'role_link',
            ],
            'analysis_plan' => [
                'title',
                'analysis_type',
                'description',
                'rationale',
                'hades_package',
                'required_roles',
                'cohort_role_map',
                'design_json',
                'feasibility',
                'blockers',
                'warnings',
                'parameters',
            ],
            default => [
                'title',
                'role',
                'description',
                'notes',
            ],
        };
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $patch
     * @return array<string, mixed>
     */
    private function mergeDraftPayload(array $payload, array $patch): array
    {
        foreach ($patch as $key => $value) {
            $existing = $payload[$key] ?? null;
            if (is_array($existing) && is_array($value) && ! array_is_list($existing) && ! array_is_list($value)) {
                $payload[$key] = $this->mergeDraftPayload($existing, $value);

                continue;
            }
            $payload[$key] = $value;
        }

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $mergedPayload
     * @param  array<string, mixed>  $patch
     * @return array<string, mixed>
     */
    private function validateDraftPatchProposal(StudyDesignAsset $asset, array $mergedPayload, array $patch): array
    {
        $issues = [];

        if ($patch === []) {
            $issues[] = [
                'severity' => 'blocking',
                'code' => 'empty_patch',
                'message' => 'No supported draft payload fields were present in the patch proposal.',
            ];
        }

        $assetType = (string) $asset->asset_type;
        if ($assetType === 'concept_set_draft') {
            array_push($issues, ...$this->validateConceptSetPatch($mergedPayload));
        } elseif ($assetType === 'cohort_draft') {
            $expression = is_array($mergedPayload['expression_json'] ?? null) ? $mergedPayload['expression_json'] : [];
            if ($expression !== []) {
                $cohortValidation = $this->cohortExpressionValidate(['expression_json' => $expression]);
                foreach ($cohortValidation['issues'] as $issue) {
                    $issues[] = [
                        'severity' => $issue['severity'] ?? 'blocking',
                        'code' => $issue['check'] ?? 'cohort_expression',
                        'message' => $issue['message'] ?? 'Cohort expression validation failed.',
                    ];
                }
            }
            if ($this->textValue($mergedPayload['role'] ?? '') === '') {
                $issues[] = [
                    'severity' => 'warning',
                    'code' => 'missing_role',
                    'message' => 'Cohort draft role is empty; the user will need to select a target, comparator, outcome, or other study role.',
                ];
            }
        } elseif ($assetType === 'analysis_plan') {
            array_push($issues, ...$this->validateAnalysisPlanPatch($mergedPayload));
        }

        return [
            'status' => collect($issues)->where('severity', 'blocking')->isEmpty() ? 'review_ready' : 'blocked',
            'issues' => $issues,
            'warnings' => collect($issues)->where('severity', 'warning')->values()->all(),
            'requires_user_review' => true,
            'requires_deterministic_verification' => true,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    private function validateConceptSetPatch(array $payload): array
    {
        $issues = [];

        if (array_key_exists('search_terms', $payload) && ! is_array($payload['search_terms'])) {
            $issues[] = [
                'severity' => 'blocking',
                'code' => 'search_terms_not_array',
                'message' => 'Concept set search terms must be an array.',
            ];
        }

        $conceptIds = $this->conceptIdsFromPayload($payload['concepts'] ?? []);
        if ($conceptIds !== []) {
            $rows = DB::table('vocab.concept')
                ->select(['concept_id', 'standard_concept', 'invalid_reason'])
                ->whereIn('concept_id', $conceptIds)
                ->get()
                ->keyBy('concept_id');

            foreach ($conceptIds as $conceptId) {
                $row = $rows->get($conceptId);
                if (! is_object($row)) {
                    $issues[] = [
                        'severity' => 'blocking',
                        'code' => 'concept_missing',
                        'concept_id' => $conceptId,
                        'message' => "Concept {$conceptId} was not found in vocab.concept.",
                    ];

                    continue;
                }
                if (($row->invalid_reason ?? null) !== null && ($row->invalid_reason ?? '') !== '') {
                    $issues[] = [
                        'severity' => 'blocking',
                        'code' => 'concept_invalid',
                        'concept_id' => $conceptId,
                        'message' => "Concept {$conceptId} is deprecated or invalid.",
                    ];
                }
                if (($row->standard_concept ?? null) !== 'S') {
                    $issues[] = [
                        'severity' => 'warning',
                        'code' => 'concept_non_standard',
                        'concept_id' => $conceptId,
                        'message' => "Concept {$conceptId} is not a standard OMOP concept.",
                    ];
                }
            }
        }

        return $issues;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array<string, mixed>>
     */
    private function validateAnalysisPlanPatch(array $payload): array
    {
        $issues = [];
        if ($this->textValue($payload['analysis_type'] ?? '') === '') {
            $issues[] = [
                'severity' => 'blocking',
                'code' => 'missing_analysis_type',
                'message' => 'Analysis plan patches must include or preserve an analysis_type.',
            ];
        }
        if (array_key_exists('required_roles', $payload) && ! is_array($payload['required_roles'])) {
            $issues[] = [
                'severity' => 'blocking',
                'code' => 'required_roles_not_array',
                'message' => 'Analysis plan required_roles must be an array.',
            ];
        }
        if (array_key_exists('design_json', $payload) && (! is_array($payload['design_json']) || array_is_list($payload['design_json']))) {
            $issues[] = [
                'severity' => 'blocking',
                'code' => 'design_json_not_object',
                'message' => 'Analysis plan design_json must be an object.',
            ];
        }

        return $issues;
    }

    /**
     * @return list<int>
     */
    private function conceptIdsFromPayload(mixed $concepts): array
    {
        if (! is_array($concepts)) {
            return [];
        }

        $ids = [];
        array_walk_recursive($concepts, function (mixed $value, mixed $key) use (&$ids): void {
            if (in_array($key, ['concept_id', 'CONCEPT_ID'], true) && is_numeric($value)) {
                $ids[] = (int) $value;
            }
        });

        return collect($ids)->unique()->values()->all();
    }

    /**
     * @param  array<string, mixed>  $arguments
     * @return array<string, mixed>
     */
    private function cohortExpressionFromArguments(array $arguments): array
    {
        if (isset($arguments['cohort_definition_id']) && is_numeric($arguments['cohort_definition_id'])) {
            $cohort = CohortDefinition::findOrFail((int) $arguments['cohort_definition_id']);

            $expressionPayload = $cohort->getAttribute('expression_json');

            return is_array($expressionPayload) ? $expressionPayload : [];
        }

        if (isset($arguments['asset_id']) && is_numeric($arguments['asset_id'])) {
            $asset = StudyDesignAsset::findOrFail((int) $arguments['asset_id']);
            $payload = is_array($asset->getAttribute('draft_payload_json')) ? $asset->getAttribute('draft_payload_json') : [];
            $expressionPayload = $payload['expression_json'] ?? null;

            return is_array($expressionPayload) ? $expressionPayload : [];
        }

        $expression = $arguments['expression_json'] ?? $arguments['expression'] ?? null;
        if (is_string($expression)) {
            $decoded = json_decode($expression, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }
        if (is_array($expression)) {
            return $expression;
        }

        throw new InvalidArgumentException('cohort_expression_validate requires expression_json, expression, cohort_definition_id, or asset_id.');
    }

    /**
     * @param  list<array<string, mixed>>  $criteriaList
     * @return list<int>
     */
    private function referencedCodesetIds(array $criteriaList): array
    {
        $ids = [];
        array_walk_recursive($criteriaList, function (mixed $value, mixed $key) use (&$ids): void {
            if ($key === 'CodesetId' && is_numeric($value)) {
                $ids[] = (int) $value;
            }
        });

        return collect($ids)->unique()->values()->all();
    }

    /**
     * @param  array<string, bool>  $checks
     * @param  list<int>  $missingReferencedCodesets
     * @return list<array<string, mixed>>
     */
    private function cohortExpressionIssues(array $checks, array $missingReferencedCodesets): array
    {
        $messages = [
            'has_expression_concept_sets' => 'The cohort expression must include at least one Circe ConceptSets entry.',
            'has_primary_criteria' => 'The cohort expression must include a non-empty PrimaryCriteria CriteriaList.',
            'primary_criteria_references_codesets' => 'Primary criteria must reference an available ConceptSets codeset ID.',
            'has_observation_window' => 'Primary criteria must include numeric PriorDays and PostDays observation-window settings.',
            'has_primary_and_expression_limits' => 'Primary, qualified, and expression limits must be present.',
            'has_collapse_settings' => 'Collapse settings must be present.',
        ];
        $issues = [];
        foreach ($checks as $check => $passed) {
            if (! $passed) {
                $issues[] = [
                    'check' => $check,
                    'severity' => 'blocking',
                    'message' => $messages[$check] ?? "Cohort expression check {$check} failed.",
                ];
            }
        }
        if ($missingReferencedCodesets !== []) {
            $issues[] = [
                'check' => 'missing_referenced_codesets',
                'severity' => 'blocking',
                'message' => 'Primary criteria reference missing ConceptSets IDs: '.implode(', ', $missingReferencedCodesets).'.',
                'codeset_ids' => $missingReferencedCodesets,
            ];
        }

        return $issues;
    }

    /**
     * @param  array<string, mixed>  $arguments
     */
    private function searchQuery(array $arguments, string $tool): string
    {
        $query = trim((string) ($arguments['query'] ?? $arguments['q'] ?? ''));
        if (mb_strlen($query) < 2) {
            throw new InvalidArgumentException("{$tool} requires a query of at least two characters.");
        }

        return $query;
    }

    /**
     * @param  array<string, string|null>  $fields
     * @return list<string>
     */
    private function matchedFields(string $query, array $fields): array
    {
        $needle = mb_strtolower($query);

        return collect($fields)
            ->filter(fn (?string $value): bool => $value !== null && str_contains(mb_strtolower($value), $needle))
            ->keys()
            ->values()
            ->all();
    }

    private function textValue(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    private function safePayloadValue(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $safe = [];
        foreach ($value as $key => $item) {
            if (in_array($key, ['protocol_text', 'raw_protocol_text', 'source_rows', 'row_samples'], true)) {
                continue;
            }
            $safe[$key] = $this->safePayloadValue($item);
        }

        return $safe;
    }

    private function enumValue(mixed $value): mixed
    {
        return $value instanceof \BackedEnum ? $value->value : $value;
    }

    private function truthy(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 's', 'standard'], true);
    }
}
