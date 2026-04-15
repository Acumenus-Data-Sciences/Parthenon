<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Http\Controllers\Controller;
use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use App\Services\StudyDesign\StudyCohortDraftVerifier;
use App\Services\StudyDesign\StudyConceptSetDraftVerifier;
use App\Services\StudyDesign\StudyDesignReadinessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * @group Study Design
 */
class StudyDesignController extends Controller
{
    public function __construct(
        private readonly StudyConceptSetDraftVerifier $conceptSetVerifier,
        private readonly StudyCohortDraftVerifier $cohortVerifier,
        private readonly StudyDesignReadinessService $readinessService,
    ) {}

    public function index(Study $study): JsonResponse
    {
        return response()->json([
            'data' => $study->designSessions()
                ->with('activeVersion')
                ->latest()
                ->get(),
        ]);
    }

    public function store(Request $request, Study $study): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:255'],
            'source_mode' => ['nullable', 'string', 'max:80'],
            'settings_json' => ['nullable', 'array'],
        ]);

        $session = $study->designSessions()->create([
            'created_by' => $request->user()->id,
            'title' => $validated['title'] ?? "{$study->title} Study Design",
            'source_mode' => $validated['source_mode'] ?? 'study_designer',
            'settings_json' => $validated['settings_json'] ?? null,
        ]);

        return response()->json(['data' => $session], 201);
    }

    public function show(Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);

        return response()->json([
            'data' => $session->load(['activeVersion', 'versions' => fn ($query) => $query->latest('version_number')]),
        ]);
    }

    public function versions(Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);

        return response()->json([
            'data' => $session->versions()->latest('version_number')->get(),
        ]);
    }

    public function assets(Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);

        return response()->json([
            'data' => $session->assets()
                ->with('reviewer:id,name,email')
                ->orderByDesc('rank_score')
                ->latest()
                ->get(),
        ]);
    }

    public function generateIntent(Request $request, Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);

        $validated = $request->validate([
            'research_question' => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        $intent = $this->normalizeIntent($study, $validated['research_question']);
        $version = $this->createVersion($session, [
            'status' => 'draft',
            'intent_json' => $intent,
            'normalized_spec_json' => [
                'pico' => $intent['pico'],
                'analysis_family' => $intent['analysis_family'],
                'standards' => ['OMOP CDM', 'OHDSI ATLAS/Circe cohort conventions', 'HADES package manifest'],
            ],
            'provenance_json' => [
                'source' => 'study_design_intent_compiler',
                'assistance_mode' => 'deterministic_guardrailed',
                'requires_human_review' => true,
                'created_at' => now()->toISOString(),
            ],
        ]);

        $session->update(['active_version_id' => $version->id, 'status' => 'draft']);
        $this->recordAiEvent($request, $session, $version, 'intent_generation', $validated, $intent);

        return response()->json(['data' => $version], 201);
    }

    public function importExistingStudy(Request $request, Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);

        $cohorts = $study->cohorts()->with('cohortDefinition')->orderBy('sort_order')->get();
        $analyses = $study->analyses()->get();

        $version = $this->createVersion($session, [
            'status' => 'draft',
            'intent_json' => [
                'research_question' => $study->primary_objective ?: $study->description ?: $study->title,
                'source' => 'existing_study_import',
                'pico' => [
                    'population' => $cohorts->firstWhere('role', 'population')?->label,
                    'intervention' => $cohorts->firstWhere('role', 'target')?->label ?? $cohorts->firstWhere('role', 'exposure')?->label,
                    'comparator' => $cohorts->firstWhere('role', 'comparator')?->label,
                    'outcome' => $cohorts->firstWhere('role', 'outcome')?->label,
                ],
            ],
            'normalized_spec_json' => [
                'imported' => true,
                'cohort_count' => $cohorts->count(),
                'analysis_count' => $analyses->count(),
                'bottom_up_compatibility' => 'imported_as_reviewable_assets_without_mutating_canonical_records',
            ],
            'provenance_json' => [
                'source' => 'bottom_up_existing_study',
                'study_id' => $study->id,
                'created_at' => now()->toISOString(),
            ],
        ]);

        foreach ($cohorts as $studyCohort) {
            $definition = $studyCohort->cohortDefinition;
            $deprecated = $definition instanceof CohortDefinition && $definition->deprecated_at !== null;
            $this->createAsset($session, $version, [
                'asset_type' => 'imported_study_cohort',
                'role' => $studyCohort->role,
                'status' => StudyDesignAssetStatus::Accepted->value,
                'canonical_type' => CohortDefinition::class,
                'canonical_id' => $definition?->id,
                'materialized_type' => CohortDefinition::class,
                'materialized_id' => $definition?->id,
                'materialized_at' => $definition ? now() : null,
                'verification_status' => $deprecated ? StudyDesignVerificationStatus::Blocked->value : StudyDesignVerificationStatus::Verified->value,
                'verified_at' => $deprecated ? null : now(),
                'draft_payload_json' => [
                    'title' => $studyCohort->label ?? $definition?->name,
                    'description' => $studyCohort->description ?? $definition?->description,
                    'role' => $studyCohort->role,
                    'cohort_definition_id' => $definition?->id,
                    'expression_json' => $definition?->expression_json,
                ],
                'verification_json' => [
                    'checks' => [
                        'canonical_cohort_exists' => $definition !== null,
                        'deprecated' => $deprecated,
                    ],
                    'messages' => $deprecated ? ['Imported cohort is deprecated and must be replaced before lock.'] : [],
                ],
                'provenance_json' => ['source' => 'study_cohorts', 'study_cohort_id' => $studyCohort->id],
            ]);
        }

        foreach ($analyses as $analysis) {
            $this->createAsset($session, $version, [
                'asset_type' => 'imported_study_analysis',
                'role' => 'analysis',
                'status' => StudyDesignAssetStatus::Accepted->value,
                'verification_status' => StudyDesignVerificationStatus::Verified->value,
                'verified_at' => now(),
                'materialized_type' => StudyAnalysis::class,
                'materialized_id' => $analysis->id,
                'materialized_at' => now(),
                'draft_payload_json' => [
                    'analysis_type' => $analysis->analysis_type,
                    'analysis_id' => $analysis->analysis_id,
                ],
                'verification_json' => ['checks' => ['study_analysis_exists' => true], 'messages' => []],
                'provenance_json' => ['source' => 'study_analyses', 'study_analysis_id' => $analysis->id],
            ]);
        }

        $session->update(['active_version_id' => $version->id]);
        $this->recordAiEvent($request, $session, $version, 'bottom_up_import', ['study_id' => $study->id], $version->normalized_spec_json ?? []);

        return response()->json(['data' => $version->load('assets')], 201);
    }

    public function critiqueVersion(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $locked = $this->isLocked($version);

        if ($locked) {
            return response()->json(['message' => 'Locked design versions cannot be critiqued in place. Generate a new draft version first.'], 409);
        }

        $findings = $this->critiqueFindings($study, $version);
        $assets = collect($findings)->map(fn (array $finding) => $this->createAsset($session, $version, [
            'asset_type' => 'design_critique',
            'role' => $finding['role'],
            'status' => StudyDesignAssetStatus::NeedsReview->value,
            'verification_status' => StudyDesignVerificationStatus::Verified->value,
            'verified_at' => now(),
            'rank_score' => $finding['severity'] === 'high' ? 0.95 : 0.65,
            'draft_payload_json' => $finding,
            'verification_json' => ['checks' => ['deterministic_rule' => true], 'messages' => []],
            'provenance_json' => ['source' => 'deterministic_design_critique'],
        ]))->values();

        $this->recordAiEvent($request, $session, $version, 'design_critique', $version->normalized_spec_json ?? [], ['findings' => $findings]);

        return response()->json(['data' => $assets]);
    }

    public function recommendPhenotypes(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $intent = $version->intent_json ?? [];
        $asset = $this->createAsset($session, $version, [
            'asset_type' => 'phenotype_recommendation',
            'role' => 'population',
            'status' => StudyDesignAssetStatus::NeedsReview->value,
            'verification_status' => StudyDesignVerificationStatus::Unverified->value,
            'rank_score' => 0.7,
            'draft_payload_json' => [
                'title' => $intent['pico']['population'] ?? $study->title,
                'rationale' => 'Candidate phenotype generated from the accepted study intent. Review and verify against local cohort/concept evidence before materialization.',
                'canonical_source_required' => true,
            ],
            'provenance_json' => ['source' => 'intent_phenotype_recommender'],
        ]);

        $this->recordAiEvent($request, $session, $version, 'phenotype_recommendation', $intent, $asset->draft_payload_json ?? []);

        return response()->json(['data' => [$asset]], 201);
    }

    public function draftConceptSets(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $validated = $request->validate([
            'role' => ['nullable', Rule::in(['population', 'exposure', 'intervention', 'comparator', 'outcome', 'exclusion', 'subgroup'])],
            'drafts' => ['nullable', 'array'],
            'drafts.*.title' => ['required_with:drafts', 'string', 'max:255'],
            'drafts.*.role' => ['nullable', 'string', 'max:80'],
            'drafts.*.domain' => ['nullable', 'string', 'max:64'],
            'drafts.*.clinical_rationale' => ['nullable', 'string', 'max:5000'],
            'drafts.*.search_terms' => ['nullable', 'array'],
            'drafts.*.search_terms.*' => ['string', 'max:255'],
            'drafts.*.concepts' => ['required_with:drafts', 'array', 'min:1'],
            'drafts.*.concepts.*.concept_id' => ['required', 'integer'],
            'drafts.*.concepts.*.is_excluded' => ['nullable', 'boolean'],
            'drafts.*.concepts.*.include_descendants' => ['nullable', 'boolean'],
            'drafts.*.concepts.*.include_mapped' => ['nullable', 'boolean'],
        ]);

        $drafts = $validated['drafts'] ?? [[
            'title' => ($version->intent_json['pico']['population'] ?? $study->title).' Concept Set',
            'role' => $validated['role'] ?? 'population',
            'domain' => 'Condition',
            'clinical_rationale' => 'Seed draft generated from study intent; add verified OMOP concept IDs before materialization.',
            'search_terms' => [$study->title],
            'concepts' => [],
        ]];

        $assets = collect($drafts)->map(fn (array $draft) => $this->createAsset($session, $version, [
            'asset_type' => 'concept_set_draft',
            'role' => $draft['role'] ?? $validated['role'] ?? 'population',
            'status' => StudyDesignAssetStatus::NeedsReview->value,
            'verification_status' => StudyDesignVerificationStatus::Unverified->value,
            'draft_payload_json' => $draft,
            'provenance_json' => ['source' => 'study_design_concept_set_draft'],
        ]))->values();

        return response()->json(['data' => $assets], 201);
    }

    public function updateVersion(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $validated = $request->validate([
            'intent_json' => ['nullable', 'array'],
            'normalized_spec_json' => ['nullable', 'array'],
            'provenance_json' => ['nullable', 'array'],
            'status' => ['nullable', Rule::in(['draft', 'review_ready'])],
        ]);

        $version->update($validated);

        return response()->json(['data' => $version->fresh()]);
    }

    public function acceptVersion(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $intent = $version->intent_json ?? [];
        if (empty($intent['research_question'])) {
            return response()->json(['message' => 'A research question is required before accepting the design intent.'], 422);
        }

        $version->update([
            'status' => 'accepted',
            'accepted_by' => $request->user()->id,
            'accepted_at' => now(),
        ]);
        $session->update(['active_version_id' => $version->id]);

        return response()->json(['data' => $version->fresh()]);
    }

    public function reviewAsset(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['accept', 'reject', 'defer'])],
            'review_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $asset->update([
            'status' => match ($validated['decision']) {
                'accept' => StudyDesignAssetStatus::Accepted->value,
                'reject' => StudyDesignAssetStatus::Rejected->value,
                default => StudyDesignAssetStatus::Deferred->value,
            },
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['data' => $asset->fresh()]);
    }

    public function verifyConceptSetDraft(Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $asset->update($this->conceptSetVerifier->verify($asset->draft_payload_json ?? []));

        return response()->json(['data' => $asset->fresh()]);
    }

    public function updateConceptSetDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:80'],
            'domain' => ['nullable', 'string', 'max:64'],
            'clinical_rationale' => ['nullable', 'string', 'max:5000'],
            'search_terms' => ['nullable', 'array'],
            'source_concept_set_references' => ['nullable', 'array'],
            'concepts' => ['required', 'array'],
            'concepts.*.concept_id' => ['required', 'integer'],
            'concepts.*.is_excluded' => ['nullable', 'boolean'],
            'concepts.*.include_descendants' => ['nullable', 'boolean'],
            'concepts.*.include_mapped' => ['nullable', 'boolean'],
        ]);

        $asset->update([
            'role' => $validated['role'] ?? $asset->role,
            'draft_payload_json' => $validated,
            'verification_status' => StudyDesignVerificationStatus::Unverified->value,
            'verification_json' => null,
            'verified_at' => null,
        ]);

        return response()->json(['data' => $asset->fresh()]);
    }

    public function materializeConceptSetDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);
        $this->guardVerified($asset);

        $payload = $asset->draft_payload_json ?? [];
        $conceptSet = ConceptSet::create([
            'name' => $payload['title'] ?? 'Study Designer Concept Set',
            'description' => $payload['clinical_rationale'] ?? null,
            'expression_json' => ['items' => $payload['concepts'] ?? [], 'source' => 'study_designer'],
            'author_id' => $request->user()->id,
            'is_public' => false,
            'tags' => ['study-designer', $asset->role],
        ]);

        foreach (($payload['concepts'] ?? []) as $concept) {
            ConceptSetItem::create([
                'concept_set_id' => $conceptSet->id,
                'concept_id' => $concept['concept_id'],
                'is_excluded' => $concept['is_excluded'] ?? false,
                'include_descendants' => $concept['include_descendants'] ?? true,
                'include_mapped' => $concept['include_mapped'] ?? false,
            ]);
        }

        $asset->update([
            'status' => StudyDesignAssetStatus::Accepted->value,
            'materialized_type' => ConceptSet::class,
            'materialized_id' => $conceptSet->id,
            'materialized_at' => now(),
        ]);

        return response()->json(['data' => $asset->fresh(), 'materialized' => $conceptSet->load('items')], 201);
    }

    public function draftCohorts(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $validated = $request->validate([
            'role' => ['nullable', 'string', 'max:80'],
        ]);

        $conceptAssets = $session->assets()
            ->where('version_id', $version->id)
            ->where('asset_type', 'concept_set_draft')
            ->whereNotNull('materialized_id')
            ->get();

        $assets = $conceptAssets->map(fn (StudyDesignAsset $conceptAsset) => $this->createAsset($session, $version, [
            'asset_type' => 'cohort_draft',
            'role' => $validated['role'] ?? $conceptAsset->role ?? 'target',
            'status' => StudyDesignAssetStatus::NeedsReview->value,
            'verification_status' => StudyDesignVerificationStatus::Unverified->value,
            'draft_payload_json' => [
                'title' => ($conceptAsset->draft_payload_json['title'] ?? 'Study Designer').' Cohort',
                'role' => $validated['role'] ?? $conceptAsset->role ?? 'target',
                'concept_set_asset_ids' => [$conceptAsset->id],
                'concept_set_ids' => [$conceptAsset->materialized_id],
                'entry_event' => 'first qualifying event',
                'exit_strategy' => 'event end or observation period end',
            ],
            'provenance_json' => ['source' => 'study_design_cohort_draft', 'concept_set_asset_id' => $conceptAsset->id],
        ]))->values();

        if ($assets->isEmpty()) {
            $assets->push($this->createAsset($session, $version, [
                'asset_type' => 'cohort_draft',
                'role' => $validated['role'] ?? 'target',
                'status' => StudyDesignAssetStatus::NeedsReview->value,
                'verification_status' => StudyDesignVerificationStatus::Blocked->value,
                'draft_payload_json' => ['title' => "{$study->title} Cohort", 'role' => $validated['role'] ?? 'target'],
                'verification_json' => ['messages' => ['Materialized concept sets are required before cohort draft verification.']],
                'provenance_json' => ['source' => 'study_design_cohort_draft'],
            ]));
        }

        return response()->json(['data' => $assets], 201);
    }

    public function verifyCohortDraft(Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $asset->update($this->cohortVerifier->verify($asset));

        return response()->json(['data' => $asset->fresh()]);
    }

    public function materializeCohortDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);
        $this->guardVerified($asset);

        $payload = $asset->draft_payload_json ?? [];
        $cohort = CohortDefinition::create([
            'name' => $payload['title'] ?? 'Study Designer Cohort',
            'description' => $payload['description'] ?? 'Materialized from Study Designer verified cohort draft.',
            'expression_json' => [
                'ConceptSets' => $payload['concept_set_ids'] ?? [],
                'PrimaryCriteria' => ['CriteriaList' => []],
                'source' => 'study_designer',
            ],
            'author_id' => $request->user()->id,
            'is_public' => false,
            'tags' => ['study-designer', $asset->role],
        ]);

        $asset->update([
            'status' => StudyDesignAssetStatus::Accepted->value,
            'materialized_type' => CohortDefinition::class,
            'materialized_id' => $cohort->id,
            'materialized_at' => now(),
        ]);

        return response()->json(['data' => $asset->fresh(), 'materialized' => $cohort], 201);
    }

    public function linkCohortDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        if ($asset->materialized_type !== CohortDefinition::class || ! $asset->materialized_id) {
            return response()->json(['message' => 'Materialize the cohort draft before linking it to the study.'], 422);
        }

        $validated = $request->validate([
            'role' => ['nullable', 'string', 'max:80'],
            'label' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $studyCohort = StudyCohort::create([
            'study_id' => $study->id,
            'cohort_definition_id' => $asset->materialized_id,
            'role' => $validated['role'] ?? $asset->role ?? 'target',
            'label' => $validated['label'] ?? ($asset->draft_payload_json['title'] ?? null),
            'description' => $validated['description'] ?? null,
            'concept_set_ids' => $asset->draft_payload_json['concept_set_ids'] ?? [],
            'sort_order' => $study->cohorts()->max('sort_order') + 1,
        ]);

        return response()->json(['data' => $studyCohort->load('cohortDefinition')], 201);
    }

    public function cohortReadiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);

        return response()->json(['data' => $this->readinessService->cohortReadiness($session, $version)]);
    }

    public function runFeasibility(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);
        $readiness = $this->readinessService->cohortReadiness($session, $version);
        $blocked = ! $readiness['ready'];

        $asset = $this->createAsset($session, $version, [
            'asset_type' => 'feasibility_evidence',
            'role' => 'feasibility',
            'status' => StudyDesignAssetStatus::Accepted->value,
            'verification_status' => $blocked ? StudyDesignVerificationStatus::Blocked->value : StudyDesignVerificationStatus::Verified->value,
            'verified_at' => $blocked ? null : now(),
            'draft_payload_json' => [
                'source' => 'local_database',
                'cohort_readiness' => $readiness,
                'result' => $blocked ? 'blocked' : 'ready_for_network_feasibility',
            ],
            'verification_json' => [
                'checks' => ['cohorts_ready' => $readiness['ready']],
                'messages' => $blocked ? ['Verified materialized cohorts are required before feasibility evidence is ready.'] : [],
            ],
            'provenance_json' => ['source' => 'study_design_feasibility'],
        ]);

        return response()->json(['data' => $asset], 201);
    }

    public function draftAnalysisPlans(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);
        $validated = $request->validate([
            'analysis_type' => ['nullable', 'string', 'max:80'],
        ]);

        $asset = $this->createAsset($session, $version, [
            'asset_type' => 'analysis_plan_draft',
            'role' => 'analysis',
            'status' => StudyDesignAssetStatus::NeedsReview->value,
            'verification_status' => StudyDesignVerificationStatus::Unverified->value,
            'draft_payload_json' => [
                'analysis_type' => $validated['analysis_type'] ?? 'characterization',
                'title' => "{$study->title} Analysis Plan",
                'hades_package' => match ($validated['analysis_type'] ?? 'characterization') {
                    'estimation', 'population_level_estimation' => 'PatientLevelPrediction',
                    'incidence_rate' => 'IncidencePrevalence',
                    default => 'FeatureExtraction',
                },
                'required_roles' => ['target'],
            ],
            'provenance_json' => ['source' => 'study_design_analysis_plan'],
        ]);

        return response()->json(['data' => [$asset]], 201);
    }

    public function verifyAnalysisPlanDraft(Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);
        $readiness = $this->readinessService->cohortReadiness($session, $asset->version);
        $blocked = ! $readiness['ready'];

        $asset->update([
            'verification_status' => $blocked ? StudyDesignVerificationStatus::Blocked->value : StudyDesignVerificationStatus::Verified->value,
            'verified_at' => $blocked ? null : now(),
            'verification_json' => [
                'checks' => [
                    'cohorts_ready' => $readiness['ready'],
                    'hades_manifest_named' => ! empty($asset->draft_payload_json['hades_package']),
                ],
                'messages' => $blocked ? ['Analysis plans require ready cohorts before materialization.'] : [],
            ],
        ]);

        return response()->json(['data' => $asset->fresh()]);
    }

    public function materializeAnalysisPlanDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);
        $this->guardVerified($asset);

        $payload = $asset->draft_payload_json ?? [];
        $analysis = Characterization::create([
            'name' => $payload['title'] ?? "{$study->title} Characterization",
            'description' => 'Materialized from Study Designer verified HADES analysis plan.',
            'design_json' => $payload,
            'author_id' => $request->user()->id,
        ]);

        $studyAnalysis = StudyAnalysis::create([
            'study_id' => $study->id,
            'analysis_type' => Characterization::class,
            'analysis_id' => $analysis->id,
        ]);

        $asset->update([
            'status' => StudyDesignAssetStatus::Accepted->value,
            'materialized_type' => StudyAnalysis::class,
            'materialized_id' => $studyAnalysis->id,
            'materialized_at' => now(),
        ]);

        return response()->json(['data' => $asset->fresh(), 'materialized' => $studyAnalysis], 201);
    }

    public function lockReadiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);

        return response()->json(['data' => $this->readinessService->lockReadiness($study, $session, $version)]);
    }

    public function lockVersion(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $readiness = $this->readinessService->lockReadiness($study, $session, $version);
        if (! $readiness['ready']) {
            return response()->json(['message' => 'Design package is not ready to lock.', 'data' => $readiness], 422);
        }

        $manifest = [
            'study' => ['id' => $study->id, 'slug' => $study->slug, 'title' => $study->title],
            'session' => $session->only(['id', 'title', 'source_mode']),
            'version' => $version->only(['id', 'version_number', 'intent_json', 'normalized_spec_json']),
            'assets' => $session->assets()->where('version_id', $version->id)->get()->toArray(),
            'locked_at' => now()->toISOString(),
            'standards' => ['OMOP CDM', 'OHDSI ATLAS/Circe', 'HADES'],
        ];
        $json = json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        $sha = hash('sha256', (string) $json);
        $path = "study-packages/{$study->slug}/design-session-{$session->id}-version-{$version->id}.json";
        Storage::disk('local')->put($path, (string) $json);

        $artifact = StudyArtifact::create([
            'study_id' => $study->id,
            'artifact_type' => 'study_design_package',
            'title' => "Study Design Package v{$version->version_number}",
            'description' => 'Locked OHDSI-aligned Study Designer package manifest.',
            'version' => (string) $version->version_number,
            'file_path' => $path,
            'file_size_bytes' => strlen((string) $json),
            'mime_type' => 'application/json',
            'url' => "/api/v1/studies/{$study->slug}/artifacts/{artifact}/download",
            'metadata' => ['sha256' => $sha, 'version_id' => $version->id, 'session_id' => $session->id],
            'uploaded_by' => $request->user()->id,
            'is_current' => true,
        ]);
        $artifact->update(['url' => "/api/v1/studies/{$study->slug}/artifacts/{$artifact->id}/download"]);

        $version->update([
            'status' => 'locked',
            'locked_at' => now(),
            'provenance_json' => array_merge($version->provenance_json ?? [], [
                'package_manifest_sha256' => $sha,
                'package_artifact_id' => $artifact->id,
            ]),
        ]);
        $session->update(['status' => 'locked', 'active_version_id' => $version->id]);

        return response()->json([
            'data' => $version->fresh(),
            'package_artifact' => $artifact->fresh(),
            'readiness' => $this->readinessService->lockReadiness($study, $session->fresh(), $version->fresh()),
        ]);
    }

    private function authorizeSession(Study $study, StudyDesignSession $session): void
    {
        abort_if((int) $session->study_id !== (int) $study->id, 404);
    }

    private function authorizeVersion(Study $study, StudyDesignSession $session, StudyDesignVersion $version): void
    {
        $this->authorizeSession($study, $session);
        abort_if((int) $version->session_id !== (int) $session->id, 404);
    }

    private function authorizeAsset(Study $study, StudyDesignSession $session, StudyDesignAsset $asset): void
    {
        $this->authorizeSession($study, $session);
        abort_if((int) $asset->session_id !== (int) $session->id, 404);
    }

    private function guardUnlocked(?StudyDesignVersion $version): void
    {
        abort_if($version && $this->isLocked($version), 409, 'Locked design versions cannot be modified.');
    }

    private function guardVerified(StudyDesignAsset $asset): void
    {
        abort_if($this->verificationValue($asset) !== StudyDesignVerificationStatus::Verified->value, 422, 'Asset must be verified before materialization.');
    }

    private function isLocked(StudyDesignVersion $version): bool
    {
        return $version->status === 'locked' || $version->locked_at !== null;
    }

    private function createVersion(StudyDesignSession $session, array $attributes): StudyDesignVersion
    {
        $number = ((int) $session->versions()->max('version_number')) + 1;

        return $session->versions()->create(array_merge(['version_number' => $number], $attributes));
    }

    private function createAsset(StudyDesignSession $session, StudyDesignVersion $version, array $attributes): StudyDesignAsset
    {
        return $session->assets()->create(array_merge([
            'version_id' => $version->id,
            'status' => StudyDesignAssetStatus::NeedsReview->value,
            'verification_status' => StudyDesignVerificationStatus::Unverified->value,
        ], $attributes));
    }

    private function normalizeIntent(Study $study, string $question): array
    {
        return [
            'research_question' => $question,
            'study_title' => $study->title,
            'analysis_family' => $study->study_type ?: 'characterization',
            'pico' => [
                'population' => $study->primary_objective ?: $study->description ?: $study->title,
                'intervention' => null,
                'comparator' => null,
                'outcome' => null,
                'time_at_risk' => null,
            ],
            'known_gaps' => ['AI-derived fields require review and canonical OHDSI asset verification.'],
        ];
    }

    private function recordAiEvent(Request $request, StudyDesignSession $session, ?StudyDesignVersion $version, string $type, array $input, array $output): void
    {
        StudyDesignAiEvent::create([
            'session_id' => $session->id,
            'version_id' => $version?->id,
            'event_type' => $type,
            'provider' => 'deterministic',
            'model' => 'local-rules',
            'prompt_sha256' => hash('sha256', $type.json_encode($input)),
            'input_json' => $input,
            'output_json' => $output,
            'safety_json' => ['no_patient_data' => true, 'requires_human_review' => true],
            'created_by' => $request->user()?->id,
        ]);
    }

    private function verificationValue(StudyDesignAsset $asset): string
    {
        $status = $asset->verification_status;

        return $status instanceof StudyDesignVerificationStatus ? $status->value : (string) $status;
    }

    private function critiqueFindings(Study $study, StudyDesignVersion $version): array
    {
        $intent = $version->intent_json ?? [];
        $pico = $intent['pico'] ?? [];
        $findings = [];

        foreach (['population', 'intervention', 'comparator', 'outcome'] as $role) {
            if (empty($pico[$role])) {
                $findings[] = [
                    'severity' => in_array($role, ['population', 'outcome'], true) ? 'high' : 'medium',
                    'role' => $role,
                    'title' => ucfirst($role).' requires explicit definition',
                    'recommendation' => 'Define this PICO element with reviewable concept sets or imported canonical cohorts.',
                ];
            }
        }

        if ($study->cohorts()->whereHas('cohortDefinition', fn ($query) => $query->whereNotNull('deprecated_at'))->exists()) {
            $findings[] = [
                'severity' => 'high',
                'role' => 'cohort',
                'title' => 'Deprecated cohort is linked to the study',
                'recommendation' => 'Replace deprecated cohorts before locking the Study Designer package.',
            ];
        }

        if ($findings === []) {
            $findings[] = [
                'severity' => 'low',
                'role' => 'design',
                'title' => 'No blocking deterministic critique findings',
                'recommendation' => 'Proceed with evidence verification and package lock when all materialized assets are ready.',
            ];
        }

        return $findings;
    }
}
