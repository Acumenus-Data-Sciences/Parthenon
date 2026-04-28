<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\StudyDesignAssetStatus;
use App\Enums\StudyDesignVerificationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StudyDesign\DraftStudyCohortsRequest;
use App\Http\Requests\StudyDesign\LinkStudyCohortRequest;
use App\Http\Requests\StudyDesign\LockStudyDesignVersionRequest;
use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignSession;
use App\Models\App\StudyDesignVersion;
use App\Services\StudyDesign\StudyAnalysisPlanMaterializer;
use App\Services\StudyDesign\StudyAnalysisPlanService;
use App\Services\StudyDesign\StudyAnalysisPlanVerifier;
use App\Services\StudyDesign\StudyCohortDraftService;
use App\Services\StudyDesign\StudyCohortDraftVerifier;
use App\Services\StudyDesign\StudyCohortMaterializer;
use App\Services\StudyDesign\StudyCohortReadinessService;
use App\Services\StudyDesign\StudyCohortRoleLinker;
use App\Services\StudyDesign\StudyConceptSetDraftService;
use App\Services\StudyDesign\StudyConceptSetDraftVerifier;
use App\Services\StudyDesign\StudyConceptSetMaterializer;
use App\Services\StudyDesign\StudyDesignGuidanceService;
use App\Services\StudyDesign\StudyDesignLockService;
use App\Services\StudyDesign\StudyDesignProtocolGateException;
use App\Services\StudyDesign\StudyDesignProtocolImportService;
use App\Services\StudyDesign\StudyFeasibilityService;
use App\Services\StudyDesign\StudyPhenotypeRecommendationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * @group Study Design
 */
class StudyDesignController extends Controller
{
    public function __construct(
        private readonly StudyConceptSetDraftVerifier $conceptSetVerifier,
        private readonly StudyCohortDraftVerifier $cohortVerifier,
        private readonly StudyCohortDraftService $cohortDraftService,
        private readonly StudyCohortMaterializer $cohortMaterializer,
        private readonly StudyCohortRoleLinker $cohortRoleLinker,
        private readonly StudyFeasibilityService $feasibilityService,
        private readonly StudyAnalysisPlanService $analysisPlanService,
        private readonly StudyAnalysisPlanVerifier $analysisPlanVerifier,
        private readonly StudyAnalysisPlanMaterializer $analysisPlanMaterializer,
        private readonly StudyConceptSetMaterializer $conceptSetMaterializer,
        private readonly StudyDesignLockService $lockService,
        private readonly StudyCohortReadinessService $cohortReadinessService,
        private readonly StudyDesignProtocolImportService $protocolImportService,
        private readonly StudyDesignGuidanceService $guidanceService,
        private readonly StudyPhenotypeRecommendationService $phenotypeRecommendationService,
        private readonly StudyConceptSetDraftService $conceptSetDraftService,
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

    public function assets(Request $request, Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);
        $versionId = $request->integer('version_id') ?: null;

        return response()->json([
            'data' => $session->assets()
                ->when($versionId, fn ($query) => $query->where('version_id', $versionId))
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

    public function importProtocol(Request $request, Study $study, StudyDesignSession $session): JsonResponse
    {
        $this->authorizeSession($study, $session);

        $validated = $request->validate([
            'protocol' => ['required', 'file', 'max:20480'],
        ]);
        $file = $validated['protocol'];

        if (! $file instanceof UploadedFile) {
            return response()->json(['message' => 'Protocol upload was not readable.'], 422);
        }

        try {
            $result = $this->protocolImportService->import(
                $study,
                $session,
                $file,
                $request->user()->id,
            );
        } catch (StudyDesignProtocolGateException $exception) {
            Log::info('Study design protocol failed initial gates', [
                'study_id' => $study->id,
                'study_slug' => $study->slug,
                'session_id' => $session->id,
                'filename' => $file->getClientOriginalName(),
                'issue_count' => count($exception->issues()),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
                'gate' => 'initial_protocol_gate',
                'issues' => $exception->issues(),
                'summary' => $exception->summary(),
            ], 422);
        } catch (\Throwable $exception) {
            Log::warning('Study design protocol import failed', [
                'study_id' => $study->id,
                'study_slug' => $study->slug,
                'session_id' => $session->id,
                'filename' => $file->getClientOriginalName(),
                'message' => $exception->getMessage(),
            ]);

            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'data' => $result['version']->load('assets'),
            'extracted' => $result['extracted'],
            'metadata' => $result['metadata'],
        ], 201);
    }

    public function importProtocolAsStudy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'protocol' => ['required', 'file', 'max:20480'],
        ]);
        $file = $validated['protocol'];

        if (! $file instanceof UploadedFile) {
            return response()->json(['message' => 'Protocol upload was not readable.'], 422);
        }

        try {
            $result = DB::transaction(function () use ($request, $file): array {
                $study = Study::create([
                    'title' => $this->initialProtocolStudyTitle($file),
                    'short_title' => $this->shortTitleFromFilename($file),
                    'description' => 'Imported from protocol upload.',
                    'study_type' => 'characterization',
                    'status' => 'draft',
                    'created_by' => $request->user()->id,
                    'metadata' => [
                        'created_from' => 'protocol_upload',
                        'protocol_import_pending' => true,
                    ],
                ]);

                $session = $study->designSessions()->create([
                    'created_by' => $request->user()->id,
                    'title' => "{$study->title} Study Design",
                    'source_mode' => 'protocol_upload',
                ]);

                $import = $this->protocolImportService->import(
                    $study,
                    $session,
                    $file,
                    $request->user()->id,
                );

                $this->applyProtocolExtractionToStudy($study, $import['extracted'], $import['metadata']);

                return [
                    'study' => $study->fresh(['author:id,name,email', 'principalInvestigator:id,name,email']),
                    'session' => $session->fresh('activeVersion'),
                    'version' => $import['version']->load('assets'),
                    'extracted' => $import['extracted'],
                    'metadata' => $import['metadata'],
                ];
            });
        } catch (StudyDesignProtocolGateException $exception) {
            Log::info('Study design protocol-to-study import failed initial gates', [
                'filename' => $file->getClientOriginalName(),
                'issue_count' => count($exception->issues()),
            ]);

            return response()->json([
                'message' => $exception->getMessage(),
                'gate' => 'initial_protocol_gate',
                'issues' => $exception->issues(),
                'summary' => $exception->summary(),
            ], 422);
        } catch (\Throwable $exception) {
            Log::warning('Study design protocol-to-study import failed', [
                'filename' => $file->getClientOriginalName(),
                'message' => $exception->getMessage(),
            ]);

            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => $result], 201);
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
                'status' => StudyDesignAssetStatus::ACCEPTED->value,
                'canonical_type' => CohortDefinition::class,
                'canonical_id' => $definition?->id,
                'materialized_type' => CohortDefinition::class,
                'materialized_id' => $definition?->id,
                'materialized_at' => $definition ? now() : null,
                'verification_status' => $deprecated ? StudyDesignVerificationStatus::BLOCKED->value : StudyDesignVerificationStatus::VERIFIED->value,
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
                'status' => StudyDesignAssetStatus::ACCEPTED->value,
                'verification_status' => StudyDesignVerificationStatus::VERIFIED->value,
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
            'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
            'verification_status' => StudyDesignVerificationStatus::VERIFIED->value,
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

        $assets = $this->phenotypeRecommendationService->recommend($session, $version, $request->user()->id);

        return response()->json(['data' => $assets], 201);
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

        $assets = $this->conceptSetDraftService->draft($session, $version, $validated);

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

        if ($validated['decision'] === 'accept' && $this->requiresVerifiedAcceptance($asset) && $this->verificationValue($asset) !== StudyDesignVerificationStatus::VERIFIED->value) {
            return response()->json([
                'message' => 'Only deterministically verified Study Design assets can be accepted.',
            ], 422);
        }

        $asset->update([
            'status' => match ($validated['decision']) {
                'accept' => StudyDesignAssetStatus::ACCEPTED->value,
                'reject' => StudyDesignAssetStatus::REJECTED->value,
                default => StudyDesignAssetStatus::DEFERRED->value,
            },
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        return response()->json(['data' => $asset->fresh()]);
    }

    public function verifyConceptSetDrafts(Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $assets = $this->conceptSetDraftService->verifyDrafts($session, $version);

        return response()->json(['data' => $assets]);
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
            'verification_status' => StudyDesignVerificationStatus::UNVERIFIED->value,
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
        $this->guardAccepted($asset);
        $conceptSet = $this->conceptSetMaterializer->materialize($asset, $request->user()->id);

        return response()->json(['data' => $asset->fresh(), 'materialized' => $conceptSet->load('items')], 201);
    }

    public function draftCohorts(DraftStudyCohortsRequest $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $assets = $this->cohortDraftService->draft($session, $version, $request->validated());

        return response()->json(['data' => $assets], 201);
    }

    public function verifyCohortDraft(Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $asset->update($this->cohortVerifier->verify($asset));

        return response()->json(['data' => $asset->fresh()]);
    }

    public function updateCohortDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'string', 'max:80'],
            'logic_description' => ['nullable', 'string', 'max:5000'],
            'concept_set_ids' => ['nullable', 'array'],
            'concept_set_ids.*' => ['integer'],
            'concept_set_asset_ids' => ['nullable', 'array'],
            'concept_set_asset_ids.*' => ['integer'],
            'source_asset_ids' => ['nullable', 'array'],
            'source_asset_ids.*' => ['integer'],
            'entry_event' => ['nullable', 'array'],
            'observation_window' => ['nullable', 'array'],
            'inclusion_rules' => ['nullable', 'array'],
            'censoring_criteria' => ['nullable', 'array'],
            'exit_strategy' => ['nullable', 'string', 'max:5000'],
            'collapse_settings' => ['nullable', 'array'],
            'role_link' => ['nullable', 'array'],
            'expression_json' => ['required', 'array'],
        ]);

        $asset->update([
            'role' => $validated['role'] ?? $asset->role,
            'draft_payload_json' => $validated,
            'verification_status' => StudyDesignVerificationStatus::UNVERIFIED->value,
            'verification_json' => null,
            'verified_at' => null,
        ]);

        return response()->json(['data' => $asset->fresh()]);
    }

    public function materializeCohortDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $cohort = $this->cohortMaterializer->materialize($asset, $request->user()->id);

        return response()->json(['data' => $asset->fresh(), 'materialized' => $cohort], 201);
    }

    public function linkCohortDraft(LinkStudyCohortRequest $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        $studyCohort = $this->cohortRoleLinker->link($study, $asset, $request->validated());

        return response()->json(['data' => $studyCohort->load('cohortDefinition')], 201);
    }

    public function cohortReadiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);

        return response()->json(['data' => $this->cohortReadinessService->summarize($study, $session, $version)]);
    }

    public function runFeasibility(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);
        $validated = $request->validate([
            'source_ids' => ['required', 'array', 'min:1'],
            'source_ids.*' => ['integer', 'exists:sources,id'],
            'min_cell_count' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ]);

        $cohortReadiness = $this->cohortReadinessService->summarize($study, $session, $version);
        if (($cohortReadiness['ready_for_feasibility'] ?? false) !== true) {
            return response()->json([
                'message' => 'Required study cohorts must be linked before source feasibility can run.',
                'data' => [
                    'cohorts' => $cohortReadiness,
                ],
            ], 422);
        }

        $result = $this->feasibilityService->run(
            $study,
            $session,
            $version,
            array_values(array_map('intval', $validated['source_ids'])),
            (int) ($validated['min_cell_count'] ?? 5),
        );

        return response()->json(['data' => $result['asset'], 'result' => $result['result']], 201);
    }

    public function draftAnalysisPlans(Request $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);
        $validated = $request->validate([
            'analysis_type' => ['nullable', 'string', 'max:80'],
            'analysis_types' => ['nullable', 'array'],
            'analysis_types.*' => ['string', 'max:80'],
        ]);
        $types = $validated['analysis_types'] ?? [];
        if (($validated['analysis_type'] ?? null) !== null) {
            $types[] = $validated['analysis_type'];
        }

        $assets = $this->analysisPlanService->draft($study, $session, $version, $request->user()->id, [
            'analysis_types' => array_values(array_unique($types)),
        ]);

        return response()->json(['data' => $assets], 201);
    }

    public function verifyAnalysisPlanDraft(Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);

        return response()->json(['data' => $this->analysisPlanVerifier->verify($asset)]);
    }

    public function materializeAnalysisPlanDraft(Request $request, Study $study, StudyDesignSession $session, StudyDesignAsset $asset): JsonResponse
    {
        $this->authorizeAsset($study, $session, $asset);
        $this->guardUnlocked($asset->version);
        $materialized = $this->analysisPlanMaterializer->materialize($asset, $request->user()->id);

        return response()->json(['data' => $asset->fresh(), 'materialized' => $materialized], 201);
    }

    public function lockReadiness(Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);

        return response()->json(['data' => $this->lockService->readiness($study, $session, $version)]);
    }

    public function guidance(Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);

        return response()->json(['data' => $this->guidanceService->build($study, $session, $version)]);
    }

    public function lockVersion(LockStudyDesignVersionRequest $request, Study $study, StudyDesignSession $session, StudyDesignVersion $version): JsonResponse
    {
        $this->authorizeVersion($study, $session, $version);
        $this->guardUnlocked($version);

        $readiness = $this->lockService->readiness($study, $session, $version);
        if (! $readiness['ready']) {
            return response()->json(['message' => 'Design package is not ready to lock.', 'data' => $readiness], 422);
        }

        // Optimistic concurrency control: if the client supplied an
        // if_unmodified_since precondition, refuse the lock when the version
        // has been mutated since they loaded it. This is OPTIONAL today to
        // preserve back-compat with no-body legacy callers; future hardening
        // can flip it to required.
        $precondition = $request->input('if_unmodified_since');
        if ($precondition !== null && $precondition !== '') {
            $expected = CarbonImmutable::parse($precondition);
            if (! $version->updated_at->equalTo($expected)) {
                return response()->json([
                    'message' => 'Study design version was modified since you loaded it.',
                    'current_updated_at' => $version->updated_at->toIso8601String(),
                ], 409);
            }
        }

        return response()->json($this->lockService->lock($study, $session, $version, $request->user()->id));
    }

    private function initialProtocolStudyTitle(UploadedFile $file): string
    {
        $title = $this->shortTitleFromFilename($file);

        return $title !== '' ? $title : 'Imported Protocol Study';
    }

    private function shortTitleFromFilename(UploadedFile $file): string
    {
        $basename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $title = Str::headline((string) preg_replace('/[_-]+/', ' ', $basename));

        return $this->limitText($title, 100);
    }

    /**
     * @param  array<string, mixed>  $extracted
     * @param  array<string, mixed>  $metadata
     */
    private function applyProtocolExtractionToStudy(Study $study, array $extracted, array $metadata): void
    {
        $title = $this->firstText(
            $extracted['primary_objective'] ?? null,
            $extracted['research_question'] ?? null,
            $study->title,
        );
        $title = $this->limitText($title, 500) ?: $study->title;

        $study->update([
            'title' => $title,
            'short_title' => $this->limitText($title, 100),
            'slug' => $this->uniqueStudySlug($title, $study),
            'description' => $this->nullableText($extracted['research_question'] ?? null),
            'study_type' => $this->limitText($this->text($extracted['study_type'] ?? '') ?: 'characterization', 100),
            'study_design' => $this->nullableText($this->limitText($this->text($extracted['study_design'] ?? ''), 50)),
            'scientific_rationale' => $this->nullableText($extracted['scientific_rationale'] ?? null),
            'hypothesis' => $this->nullableText($extracted['hypothesis'] ?? null),
            'primary_objective' => $this->nullableText($extracted['primary_objective'] ?? $extracted['research_question'] ?? null),
            'metadata' => array_merge($study->metadata ?? [], [
                'created_from' => 'protocol_upload',
                'protocol_import_pending' => false,
                'protocol_file' => $metadata,
            ]),
        ]);
    }

    private function uniqueStudySlug(string $title, Study $study): string
    {
        $base = Str::slug($title) ?: 'imported-protocol-study';
        $slug = $base;
        $counter = 1;

        while (Study::withTrashed()
            ->where('slug', $slug)
            ->whereKeyNot($study->id)
            ->exists()
        ) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    private function firstText(mixed ...$values): string
    {
        foreach ($values as $value) {
            $text = $this->text($value);
            if ($text !== '') {
                return $text;
            }
        }

        return '';
    }

    private function nullableText(mixed $value): ?string
    {
        $text = $this->text($value);

        return $text !== '' ? $text : null;
    }

    private function text(mixed $value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }

    private function limitText(string $value, int $limit): string
    {
        return trim(Str::limit($value, $limit, ''));
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
        abort_if($this->verificationValue($asset) !== StudyDesignVerificationStatus::VERIFIED->value, 422, 'Asset must be verified before materialization.');
    }

    private function guardAccepted(StudyDesignAsset $asset): void
    {
        abort_if($this->assetStatusValue($asset) !== StudyDesignAssetStatus::ACCEPTED->value, 422, 'Asset must be accepted before materialization.');
    }

    private function requiresVerifiedAcceptance(StudyDesignAsset $asset): bool
    {
        return in_array($asset->asset_type, [
            'phenotype_recommendation',
            'local_cohort',
            'local_concept_set',
            'concept_set_draft',
            'cohort_draft',
            'analysis_plan',
        ], true);
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
            'status' => StudyDesignAssetStatus::NEEDS_REVIEW->value,
            'verification_status' => StudyDesignVerificationStatus::UNVERIFIED->value,
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

    private function assetStatusValue(StudyDesignAsset $asset): string
    {
        $status = $asset->status;

        return $status instanceof StudyDesignAssetStatus ? $status->value : (string) $status;
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
