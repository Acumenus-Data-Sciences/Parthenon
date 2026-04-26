<?php

use App\Models\App\AiProviderSetting;
use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAsset;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function () {
    ensureStudyDesignVocabularyTable();

    $this->seed(RolePermissionSeeder::class);

    $this->user = User::factory()->create();
    $this->user->assignRole('researcher');

    $this->study = Study::factory()->create([
        'title' => 'OHDSI Study Designer Test',
        'description' => 'A comparative effectiveness study for Study Designer tests.',
        'primary_objective' => 'Compare outcomes between target and comparator cohorts.',
        'study_type' => 'characterization',
        'created_by' => $this->user->id,
    ]);
});

function ensureStudyDesignVocabularyTable(): void
{
    DB::statement('CREATE SCHEMA IF NOT EXISTS vocab');
    DB::statement('CREATE TABLE IF NOT EXISTS vocab.concept (
        concept_id INTEGER PRIMARY KEY,
        concept_name VARCHAR(255),
        domain_id VARCHAR(20),
        vocabulary_id VARCHAR(20),
        concept_class_id VARCHAR(20),
        standard_concept CHAR(1),
        concept_code VARCHAR(50),
        valid_start_date DATE,
        valid_end_date DATE,
        invalid_reason VARCHAR(1)
    )');
    DB::statement('TRUNCATE TABLE vocab.concept');
}

function seedStudyDesignVocabularyConcept(int $conceptId, ?string $invalidReason = null): void
{
    DB::table('vocab.concept')->updateOrInsert(
        ['concept_id' => $conceptId],
        [
            'concept_name' => "Study Design Test Concept {$conceptId}",
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => 'S',
            'concept_code' => (string) $conceptId,
            'valid_start_date' => '1970-01-01',
            'valid_end_date' => '2099-12-31',
            'invalid_reason' => $invalidReason,
        ],
    );
}

function createStudyDesignSessionAndVersion(object $test): array
{
    $sessionId = $test->actingAs($test->user)
        ->postJson("/api/v1/studies/{$test->study->slug}/design-sessions", [
            'title' => 'Verifier hardening pass',
        ])
        ->assertCreated()
        ->json('data.id');

    $versionId = $test->actingAs($test->user)
        ->postJson("/api/v1/studies/{$test->study->slug}/design-sessions/{$sessionId}/intent", [
            'research_question' => 'Among adults with diabetes, does treatment improve outcomes compared with usual care?',
        ])
        ->assertCreated()
        ->json('data.id');

    return [$sessionId, $versionId];
}

it('imports bottom-up study assets and records deterministic critique assets', function () {
    $cohort = CohortDefinition::create([
        'name' => 'Active Target Cohort',
        'description' => 'An active target cohort.',
        'expression_json' => ['ConceptSets' => [1]],
        'author_id' => $this->user->id,
        'is_public' => false,
    ]);

    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $cohort->id,
        'role' => 'target',
        'label' => 'Target cohort',
        'sort_order' => 0,
    ]);

    $analysis = Characterization::create([
        'name' => 'Existing Characterization',
        'description' => 'Existing analysis.',
        'design_json' => ['source' => 'test'],
        'author_id' => $this->user->id,
    ]);
    StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Bottom-up compatibility pass',
        ])
        ->assertCreated()
        ->json('data.id');

    $versionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/import-existing")
        ->assertCreated()
        ->assertJsonPath('data.normalized_spec_json.imported', true)
        ->json('data.id');

    $this->assertDatabaseHas('study_design_assets', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'imported_study_cohort',
        'verification_status' => 'verified',
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/critique")
        ->assertOk()
        ->assertJsonPath('data.0.asset_type', 'design_critique');

    expect(StudyDesignAsset::where('asset_type', 'design_critique')->count())->toBeGreaterThan(0);
});

it('imports a markdown protocol through Claude and creates reviewable design drafts', function () {
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'text',
                'text' => json_encode([
                    'research_question' => 'Among adults with diabetes, does metformin reduce kidney failure compared with usual care?',
                    'primary_objective' => 'Estimate kidney failure risk after metformin exposure.',
                    'population' => 'Adults with type 2 diabetes',
                    'exposure' => 'Metformin initiation',
                    'comparator' => 'Usual care without metformin initiation',
                    'outcome' => 'Kidney failure',
                    'time_at_risk' => 'One year after index date',
                    'study_type' => 'comparative_effectiveness',
                    'study_design' => 'retrospective cohort',
                    'hypothesis' => 'Metformin is associated with lower kidney failure risk.',
                    'scientific_rationale' => 'Protocol rationale',
                    'concept_set_drafts' => [[
                        'title' => 'Type 2 diabetes',
                        'role' => 'population',
                        'domain' => 'Condition',
                        'clinical_rationale' => 'Defines the eligible population.',
                        'search_terms' => ['type 2 diabetes'],
                    ]],
                    'cohort_definition_drafts' => [[
                        'title' => 'Metformin initiators',
                        'role' => 'target',
                        'description' => 'New metformin users.',
                        'entry_event' => 'first metformin exposure',
                        'exit_strategy' => 'one year after index',
                    ]],
                    'analysis_plan' => [[
                        'title' => 'Comparative effectiveness analysis',
                        'analysis_type' => 'estimation',
                        'hades_package' => 'CohortMethod',
                        'rationale' => 'Compare target and comparator cohorts.',
                    ]],
                    'feasibility_plan' => ['summary' => 'Run cohort counts.', 'minimum_cell_count' => 11, 'source_requirements' => []],
                    'validation_plan' => ['summary' => 'Review attrition.', 'checks' => []],
                    'publication_plan' => ['summary' => 'Protocol appendix.', 'outputs' => []],
                    'open_questions' => [],
                    'risk_notes' => [],
                ]),
            ]],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Protocol upload pass',
        ])
        ->assertCreated()
        ->json('data.id');

    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, "# Protocol\n\nEvaluate metformin and kidney failure.");
    $file = new UploadedFile($path, 'protocol.md', 'text/markdown', null, true);

    $versionId = $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => $file,
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'review_ready')
        ->assertJsonPath('data.intent_json.pico.population', 'Adults with type 2 diabetes')
        ->assertJsonPath('data.intent_json.pico.outcome', 'Kidney failure')
        ->json('data.id');

    $this->assertDatabaseHas('study_design_ai_events', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'event_type' => 'protocol_import',
        'provider' => 'anthropic',
        'model' => 'claude-test',
    ]);

    $this->assertDatabaseHas('study_design_assets', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'concept_set_draft',
        'role' => 'population',
    ]);
    $this->assertDatabaseHas('study_design_assets', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'cohort_draft',
        'role' => 'target',
    ]);
    $this->assertDatabaseHas('study_design_assets', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'analysis_plan_draft',
        'role' => 'analysis',
    ]);
});

it('creates a new study when importing a standalone protocol document', function () {
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'tool_use',
                'name' => 'extract_protocol',
                'input' => [
                    'research_question' => 'Does pathogen class predict clinical deterioration among adults hospitalized with pneumonia?',
                    'primary_objective' => 'Evaluate pneumonia outcomes by pathogen class.',
                    'population' => 'Adults hospitalized with pneumonia',
                    'exposure' => 'Pathogen class',
                    'comparator' => 'Alternative pathogen classes',
                    'outcome' => 'Clinical deterioration',
                    'time_at_risk' => '30 days after admission',
                    'study_type' => 'patient_level_prediction',
                    'study_design' => 'retrospective cohort',
                    'hypothesis' => 'Pathogen class predicts clinical deterioration.',
                    'scientific_rationale' => 'Protocol rationale',
                    'concept_set_drafts' => [],
                    'cohort_definition_drafts' => [],
                    'analysis_plan' => [],
                    'feasibility_plan' => ['summary' => '', 'minimum_cell_count' => null, 'source_requirements' => []],
                    'validation_plan' => ['summary' => '', 'checks' => []],
                    'publication_plan' => ['summary' => '', 'outputs' => []],
                    'open_questions' => [],
                    'risk_notes' => [],
                ],
            ]],
        ]),
    ]);

    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, "# Protocol\n\nEvaluate pathogen class prediction in pneumonia.");
    $file = new UploadedFile($path, 'pneumonia-protocol.md', 'text/markdown', null, true);

    $response = $this->actingAs($this->user)
        ->post('/api/v1/studies/protocol-import', [
            'protocol' => $file,
        ])
        ->assertCreated()
        ->assertJsonPath('data.study.title', 'Evaluate pneumonia outcomes by pathogen class.')
        ->assertJsonPath('data.study.study_type', 'patient_level_prediction')
        ->assertJsonPath('data.version.status', 'review_ready');

    $newStudyId = $response->json('data.study.id');
    $sessionId = $response->json('data.session.id');
    $versionId = $response->json('data.version.id');

    expect($newStudyId)->not->toBe($this->study->id);

    $this->assertDatabaseHas('studies', [
        'id' => $newStudyId,
        'created_by' => $this->user->id,
        'primary_objective' => 'Evaluate pneumonia outcomes by pathogen class.',
    ]);
    $this->assertDatabaseHas('study_design_sessions', [
        'id' => $sessionId,
        'study_id' => $newStudyId,
        'source_mode' => 'protocol_upload',
    ]);
    $this->assertDatabaseHas('study_design_ai_events', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'event_type' => 'protocol_import',
        'model' => 'claude-test',
    ]);
});

it('prefers configured Anthropic provider settings for protocol imports', function () {
    config()->set('services.anthropic.key', 'invalid-env-key');
    config()->set('services.anthropic.model', 'invalid-env-model');

    AiProviderSetting::create([
        'provider_type' => 'anthropic',
        'display_name' => 'Anthropic',
        'is_enabled' => true,
        'is_active' => true,
        'model' => 'claude-provider-model',
        'settings' => ['api_key' => 'provider-anthropic-key'],
        'updated_by' => $this->user->id,
    ]);

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'tool_use',
                'name' => 'extract_protocol',
                'input' => [
                    'research_question' => 'Among adults with pneumonia, does pathogen class predict outcomes?',
                    'primary_objective' => 'Evaluate pneumonia outcomes by pathogen class.',
                    'population' => 'Adults with pneumonia',
                    'exposure' => 'Pathogen class',
                    'comparator' => 'Other pathogen classes',
                    'outcome' => 'Clinical deterioration',
                    'study_type' => 'patient_level_prediction',
                    'study_design' => 'retrospective cohort',
                    'concept_set_drafts' => [],
                    'cohort_definition_drafts' => [],
                    'analysis_plan' => [],
                    'feasibility_plan' => ['summary' => '', 'minimum_cell_count' => null, 'source_requirements' => []],
                    'validation_plan' => ['summary' => '', 'checks' => []],
                    'publication_plan' => ['summary' => '', 'outputs' => []],
                    'open_questions' => [],
                    'risk_notes' => [],
                ],
            ]],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Provider-backed upload',
        ])
        ->assertCreated()
        ->json('data.id');

    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, "# Protocol\n\nEvaluate pathogen class prediction in pneumonia.");
    $file = new UploadedFile($path, 'protocol.md', 'text/markdown', null, true);

    $versionId = $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => $file,
        ])
        ->assertCreated()
        ->json('data.id');

    Http::assertSent(function ($request) {
        return ($request->header('x-api-key')[0] ?? null) === 'provider-anthropic-key'
            && ($request->data()['model'] ?? null) === 'claude-provider-model'
            && ($request->data()['tool_choice']['name'] ?? null) === 'extract_protocol'
            && ($request->data()['tools'][0]['name'] ?? null) === 'extract_protocol'
            && ! array_key_exists('temperature', $request->data());
    });

    $this->assertDatabaseHas('study_design_ai_events', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'event_type' => 'protocol_import',
        'provider' => 'anthropic',
        'model' => 'claude-provider-model',
    ]);
});

it('locks a ready imported design and exposes a downloadable package artifact', function () {
    Storage::fake('local');

    $cohort = CohortDefinition::create([
        'name' => 'Ready Target Cohort',
        'description' => 'A ready target cohort.',
        'expression_json' => ['ConceptSets' => [1]],
        'author_id' => $this->user->id,
        'is_public' => false,
    ]);
    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $cohort->id,
        'role' => 'target',
        'label' => 'Target cohort',
        'sort_order' => 0,
    ]);

    $analysis = Characterization::create([
        'name' => 'Ready Characterization',
        'description' => 'Ready analysis.',
        'design_json' => ['source' => 'test'],
        'author_id' => $this->user->id,
    ]);
    StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions")
        ->assertCreated()
        ->json('data.id');

    $versionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/import-existing")
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run")
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'verified');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/accept")
        ->assertOk()
        ->assertJsonPath('data.status', 'accepted');

    $artifactId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock")
        ->assertOk()
        ->assertJsonPath('data.status', 'locked')
        ->assertJsonPath('readiness.ready', true)
        ->json('package_artifact.id');

    $this->actingAs($this->user)
        ->get("/api/v1/studies/{$this->study->slug}/artifacts/{$artifactId}/download")
        ->assertOk();
});

it('blocks concept set drafts with missing or deprecated OMOP concept IDs before materialization', function () {
    seedStudyDesignVocabularyConcept(201826, 'D');
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);

    $assetId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/concept-sets/draft", [
            'drafts' => [[
                'title' => 'Unsafe concept set',
                'role' => 'target',
                'domain' => 'Condition',
                'concepts' => [
                    ['concept_id' => 201826, 'include_descendants' => true],
                    ['concept_id' => 999999999, 'include_descendants' => true],
                ],
            ]],
        ])
        ->assertCreated()
        ->json('data.0.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/concept-sets/verify")
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'blocked')
        ->assertJsonPath('data.verification_json.checks.all_concepts_exist_in_vocab_concept', false)
        ->assertJsonPath('data.verification_json.checks.all_concepts_are_current', false);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/concept-sets/materialize")
        ->assertStatus(422);
});

it('materializes only verified current OMOP concept set drafts', function () {
    seedStudyDesignVocabularyConcept(201826);
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);

    $assetId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/concept-sets/draft", [
            'drafts' => [[
                'title' => 'Verified diabetes concept set',
                'role' => 'target',
                'domain' => 'Condition',
                'clinical_rationale' => 'Known OMOP concept seeded for verifier test.',
                'concepts' => [
                    ['concept_id' => 201826, 'include_descendants' => true, 'include_mapped' => false],
                ],
            ]],
        ])
        ->assertCreated()
        ->json('data.0.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/concept-sets/verify")
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'verified');

    $materializedId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/concept-sets/materialize")
        ->assertCreated()
        ->assertJsonPath('data.materialized_type', ConceptSet::class)
        ->json('materialized.id');

    $this->assertDatabaseHas('concept_set_items', [
        'concept_set_id' => $materializedId,
        'concept_id' => 201826,
    ]);
});

it('blocks imported deprecated cohorts from feasibility readiness and package lock', function () {
    Storage::fake('local');

    $deprecated = CohortDefinition::create([
        'name' => 'Deprecated Target Cohort',
        'description' => 'A deprecated target cohort.',
        'expression_json' => ['ConceptSets' => [1]],
        'author_id' => $this->user->id,
        'is_public' => false,
        'deprecated_at' => now(),
    ]);
    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $deprecated->id,
        'role' => 'target',
        'label' => 'Deprecated target cohort',
        'sort_order' => 0,
    ]);

    $analysis = Characterization::create([
        'name' => 'Ready Characterization',
        'description' => 'Ready analysis.',
        'design_json' => ['source' => 'test'],
        'author_id' => $this->user->id,
    ]);
    StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions")
        ->assertCreated()
        ->json('data.id');

    $versionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/import-existing")
        ->assertCreated()
        ->json('data.id');

    $this->assertDatabaseHas('study_design_assets', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'imported_study_cohort',
        'verification_status' => 'blocked',
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run")
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'blocked');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/accept")
        ->assertOk();

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock")
        ->assertStatus(422)
        ->assertJsonPath('data.cohorts.ready', false);
});

it('rejects locked version edits and cross-study package downloads', function () {
    Storage::fake('local');

    $cohort = CohortDefinition::create([
        'name' => 'Ready Target Cohort',
        'description' => 'A ready target cohort.',
        'expression_json' => ['ConceptSets' => [1]],
        'author_id' => $this->user->id,
        'is_public' => false,
    ]);
    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $cohort->id,
        'role' => 'target',
        'label' => 'Target cohort',
        'sort_order' => 0,
    ]);

    $analysis = Characterization::create([
        'name' => 'Ready Characterization',
        'description' => 'Ready analysis.',
        'design_json' => ['source' => 'test'],
        'author_id' => $this->user->id,
    ]);
    StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions")
        ->assertCreated()
        ->json('data.id');
    $versionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/import-existing")
        ->assertCreated()
        ->json('data.id');
    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run")
        ->assertCreated();
    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/accept")
        ->assertOk();
    $artifactId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock")
        ->assertOk()
        ->json('package_artifact.id');

    $this->actingAs($this->user)
        ->putJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}", [
            'status' => 'review_ready',
        ])
        ->assertStatus(409);

    $cohortAssetId = StudyDesignAsset::where('session_id', $sessionId)
        ->where('version_id', $versionId)
        ->where('asset_type', 'imported_study_cohort')
        ->value('id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAssetId}/cohorts/verify")
        ->assertStatus(409);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run")
        ->assertStatus(409);

    $otherStudy = Study::factory()->create(['created_by' => $this->user->id]);

    $this->actingAs($this->user)
        ->get("/api/v1/studies/{$otherStudy->slug}/artifacts/{$artifactId}/download")
        ->assertNotFound();

    expect(StudyArtifact::find($artifactId)?->metadata['sha256'] ?? null)->not->toBeNull();
});
