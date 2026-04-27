<?php

use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AiProviderSetting;
use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\PhenotypeLibraryEntry;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\App\SourceProfile;
use App\Models\App\SourceRelease;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyDesignAiEvent;
use App\Models\App\StudyDesignAsset;
use App\Models\App\StudyDesignVersion;
use App\Models\User;
use App\Services\StudyDesign\StudyDesignAbbyOrchestrator;
use App\Services\StudyDesign\StudyDesignContextBuilder;
use App\Services\StudyDesign\StudyDesignGuidanceService;
use App\Services\StudyDesign\StudyDesignOllamaClient;
use App\Services\StudyDesign\StudyDesignStructuredOutputSchemas;
use App\Services\StudyDesign\StudyDesignToolRunner;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
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

function makeStudyDesignProtocolUpload(string $body = "# Protocol\n\nEvaluate pathogen class prediction in pneumonia."): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, $body);

    return new UploadedFile($path, 'protocol.md', 'text/markdown', null, true);
}

function assertNoProtocolImportDraftsPersisted(int $sessionId, int $versionCount): void
{
    expect(StudyDesignVersion::where('session_id', $sessionId)->count())->toBe($versionCount);
    expect(StudyDesignAsset::where('session_id', $sessionId)->count())->toBe(0);
    expect(StudyDesignAiEvent::where('session_id', $sessionId)->where('event_type', 'protocol_import')->count())->toBe(0);
}

/**
 * @param  list<int>  $completedCohortDefinitionIds
 */
function createStudyDesignFeasibilitySource(array $completedCohortDefinitionIds = []): Source
{
    DB::statement('CREATE SCHEMA IF NOT EXISTS cdm');
    DB::statement('CREATE TABLE IF NOT EXISTS cdm.person (person_id INTEGER PRIMARY KEY)');
    DB::statement('CREATE TABLE IF NOT EXISTS cdm.observation_period (
        observation_period_id INTEGER PRIMARY KEY,
        person_id INTEGER NOT NULL,
        observation_period_start_date DATE NOT NULL,
        observation_period_end_date DATE NOT NULL
    )');
    foreach ([
        'condition_occurrence',
        'drug_exposure',
        'procedure_occurrence',
        'measurement',
        'observation',
        'visit_occurrence',
        'death',
    ] as $tableName) {
        DB::statement("CREATE TABLE IF NOT EXISTS cdm.{$tableName} (id INTEGER PRIMARY KEY)");
    }
    DB::statement('TRUNCATE TABLE cdm.death, cdm.visit_occurrence, cdm.observation, cdm.measurement, cdm.procedure_occurrence, cdm.drug_exposure, cdm.condition_occurrence, cdm.observation_period, cdm.person');
    DB::table('cdm.person')->insert([['person_id' => 1], ['person_id' => 2], ['person_id' => 3], ['person_id' => 4], ['person_id' => 5]]);
    DB::table('cdm.observation_period')->insert([
        ['observation_period_id' => 1, 'person_id' => 1, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 2, 'person_id' => 2, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 3, 'person_id' => 3, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 4, 'person_id' => 4, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
        ['observation_period_id' => 5, 'person_id' => 5, 'observation_period_start_date' => '2020-01-01', 'observation_period_end_date' => '2020-12-31'],
    ]);

    $source = Source::factory()->create([
        'source_connection' => 'pgsql',
    ]);

    SourceDaimon::create([
        'source_id' => $source->id,
        'daimon_type' => DaimonType::CDM->value,
        'table_qualifier' => 'cdm',
        'priority' => 1,
    ]);
    SourceRelease::factory()->create([
        'source_id' => $source->id,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    foreach ($completedCohortDefinitionIds as $cohortDefinitionId) {
        CohortGeneration::create([
            'cohort_definition_id' => $cohortDefinitionId,
            'source_id' => $source->id,
            'status' => ExecutionStatus::Completed->value,
            'started_at' => now()->subMinutes(3),
            'completed_at' => now(),
            'person_count' => 50,
        ]);
    }

    return $source;
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

it('builds canonical Abby context for Study Design tools without raw protocol text', function () {
    $conceptSet = ConceptSet::create([
        'name' => 'Context hypertension concept set',
        'description' => 'Context builder concept set.',
        'expression_json' => ['items' => [['concept_id' => 201826]]],
        'author_id' => $this->user->id,
        'is_public' => false,
        'tags' => ['study-designer'],
    ]);
    $cohort = CohortDefinition::create([
        'name' => 'Context Target Cohort',
        'description' => 'Context target cohort.',
        'expression_json' => ['ConceptSets' => [$conceptSet->id]],
        'author_id' => $this->user->id,
        'is_public' => false,
    ]);
    $studyCohort = StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $cohort->id,
        'role' => 'target',
        'label' => 'Target context cohort',
        'concept_set_ids' => [$conceptSet->id],
        'sort_order' => 0,
    ]);
    $analysis = Characterization::create([
        'name' => 'Context Characterization',
        'description' => 'Context analysis.',
        'design_json' => ['source' => 'test'],
        'author_id' => $this->user->id,
    ]);
    $studyAnalysis = StudyAnalysis::create([
        'study_id' => $this->study->id,
        'analysis_type' => Characterization::class,
        'analysis_id' => $analysis->id,
    ]);
    $session = $this->study->designSessions()->create([
        'created_by' => $this->user->id,
        'title' => 'Abby context pass',
        'source_mode' => 'protocol_upload',
        'status' => 'reviewing',
    ]);
    $version = $session->versions()->create([
        'version_number' => 1,
        'status' => 'accepted',
        'intent_json' => [
            'research_question' => 'Among adults with hypertension, what are downstream outcomes?',
            'pico' => [
                'population' => 'Adults with hypertension',
                'intervention' => 'Hypertension diagnosis',
                'outcome' => 'Stroke',
                'time_at_risk' => 'Index through 365 days',
            ],
        ],
        'normalized_spec_json' => [
            'study' => [
                'study_type' => 'characterization',
                'research_question' => 'Among adults with hypertension, what are downstream outcomes?',
            ],
            'pico' => [
                'population' => ['summary' => 'Adults with hypertension'],
                'outcomes' => [],
            ],
        ],
        'provenance_json' => ['source' => 'protocol_upload_abby'],
    ]);
    $session->update(['active_version_id' => $version->id]);

    StudyDesignAsset::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'asset_type' => 'concept_set_draft',
        'role' => 'target',
        'status' => 'materialized',
        'verification_status' => 'verified',
        'draft_payload_json' => [
            'title' => 'Context hypertension concept set',
            'raw_protocol_text' => 'secret raw protocol text that must not leak',
            'concepts' => [['concept_id' => 201826]],
        ],
        'materialized_type' => ConceptSet::class,
        'materialized_id' => $conceptSet->id,
        'materialized_at' => now(),
        'verified_at' => now(),
    ]);
    StudyDesignAsset::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'asset_type' => 'cohort_draft',
        'role' => 'target',
        'status' => 'materialized',
        'verification_status' => 'verified',
        'draft_payload_json' => [
            'title' => 'Context Target Cohort',
            'concept_set_ids' => [$conceptSet->id],
        ],
        'materialized_type' => CohortDefinition::class,
        'materialized_id' => $cohort->id,
        'materialized_at' => now(),
        'verified_at' => now(),
        'provenance_json' => ['study_cohort_id' => $studyCohort->id],
    ]);
    StudyDesignAsset::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'asset_type' => 'imported_study_analysis',
        'role' => 'analysis',
        'status' => 'accepted',
        'verification_status' => 'verified',
        'draft_payload_json' => ['analysis_type' => Characterization::class, 'analysis_id' => $studyAnalysis->id],
        'materialized_type' => StudyAnalysis::class,
        'materialized_id' => $studyAnalysis->id,
        'materialized_at' => now(),
        'verified_at' => now(),
    ]);
    StudyArtifact::create([
        'study_id' => $this->study->id,
        'artifact_type' => 'study_design_package',
        'title' => 'Context package',
        'version' => '1',
        'file_path' => 'study-packages/context.json',
        'file_size_bytes' => 128,
        'mime_type' => 'application/json',
        'url' => '/api/v1/studies/context/artifacts/1/download',
        'metadata' => ['sha256' => str_repeat('a', 64)],
        'uploaded_by' => $this->user->id,
        'is_current' => true,
    ]);
    StudyDesignAiEvent::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'event_type' => 'protocol_import',
        'provider' => 'anthropic',
        'model' => 'claude-test',
        'prompt_sha256' => str_repeat('b', 64),
        'input_json' => [
            'raw_protocol_text_stored' => false,
            'protocol_text' => 'secret raw protocol text that must not leak',
        ],
        'output_json' => ['extracted' => ['research_question' => 'Context question']],
        'safety_json' => ['raw_document_not_persisted' => true],
        'created_by' => $this->user->id,
    ]);

    $context = app(StudyDesignContextBuilder::class)->build($this->study, $session->fresh(), $version->fresh());
    $orchestrated = app(StudyDesignAbbyOrchestrator::class)->studyDesignContext($this->study, $session->fresh(), $version->fresh());

    expect($context['schema_version'])->toBe('study-design-context.v1')
        ->and($orchestrated['schema_version'])->toBe('study-design-context.v1')
        ->and($context['study']['id'])->toBe($this->study->id)
        ->and($context['session']['id'])->toBe($session->id)
        ->and($context['version']['id'])->toBe($version->id)
        ->and($context['assets']['summary']['by_type']['concept_set_draft'])->toBe(1)
        ->and($context['assets']['summary']['by_type']['cohort_draft'])->toBe(1)
        ->and($context['native']['cohorts'][0]['cohort_definition_id'])->toBe($cohort->id)
        ->and($context['native']['analyses'][0]['analysis_type'])->toBe('characterization')
        ->and($context['readiness']['cohorts']['ready'])->toBeTrue()
        ->and($context['readiness']['package_lock']['status'])->toBe('blocked')
        ->and($context['provenance']['ai_events'][0]['event_type'])->toBe('protocol_import');

    expect(json_encode($context, JSON_THROW_ON_ERROR))->not->toContain('secret raw protocol text that must not leak');
});

it('runs read-only Abby Study Design tools with bounded vocabulary and HADES outputs', function () {
    DB::table('vocab.concept')->insert([
        [
            'concept_id' => 201826,
            'concept_name' => 'Hypertension',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => 'S',
            'concept_code' => '201826',
            'valid_start_date' => '1970-01-01',
            'valid_end_date' => '2099-12-31',
            'invalid_reason' => null,
        ],
        [
            'concept_id' => 999001,
            'concept_name' => 'Deprecated hypertension code',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => 'S',
            'concept_code' => '999001',
            'valid_start_date' => '1970-01-01',
            'valid_end_date' => '2099-12-31',
            'invalid_reason' => 'D',
        ],
        [
            'concept_id' => 999002,
            'concept_name' => 'Hypertension source code',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'ICD10CM',
            'concept_class_id' => 'Clinical Finding',
            'standard_concept' => null,
            'concept_code' => 'I10',
            'valid_start_date' => '1970-01-01',
            'valid_end_date' => '2099-12-31',
            'invalid_reason' => null,
        ],
    ]);

    Http::fake([
        'http://darkstar:8787/hades/packages' => Http::response([
            'status' => 'ready',
            'packages' => [
                ['package' => 'CohortMethod', 'installed' => true, 'version' => '6.0.0', 'priority' => 'required'],
                ['package' => 'Characterization', 'installed' => false, 'version' => null, 'priority' => 'required'],
            ],
        ]),
    ]);

    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);
    $conceptDraftAsset = StudyDesignAsset::create([
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'concept_set_draft',
        'role' => 'target',
        'status' => 'needs_review',
        'verification_status' => 'unverified',
        'draft_payload_json' => [
            'title' => 'Hypertension concept draft',
            'raw_protocol_text' => 'tool runner secret protocol text',
            'concepts' => [['concept_id' => 201826]],
        ],
    ]);
    $localConceptSet = ConceptSet::create([
        'name' => 'Hypertension local concept set',
        'description' => 'Reusable hypertension local concept set for Abby tool tests.',
        'expression_json' => ['items' => [['concept_id' => 201826]]],
        'author_id' => $this->user->id,
        'is_public' => true,
        'tags' => ['hypertension', 'study-design'],
    ]);
    $cohortExpression = [
        'ConceptSets' => [[
            'id' => 0,
            'name' => 'Hypertension',
            'expression' => [
                'items' => [[
                    'concept' => [
                        'CONCEPT_ID' => 201826,
                        'DOMAIN_ID' => 'Condition',
                    ],
                    'isExcluded' => false,
                    'includeDescendants' => true,
                    'includeMapped' => false,
                ]],
            ],
        ]],
        'PrimaryCriteria' => [
            'CriteriaList' => [[
                'ConditionOccurrence' => [
                    'CodesetId' => 0,
                    'First' => true,
                ],
            ]],
            'ObservationWindow' => [
                'PriorDays' => 365,
                'PostDays' => 0,
            ],
            'PrimaryCriteriaLimit' => ['Type' => 'First'],
        ],
        'QualifiedLimit' => ['Type' => 'First'],
        'ExpressionLimit' => ['Type' => 'First'],
        'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
    ];
    $localCohort = CohortDefinition::create([
        'name' => 'Hypertension validated target cohort',
        'description' => 'Reusable hypertension cohort for Abby tool tests.',
        'expression_json' => $cohortExpression,
        'author_id' => $this->user->id,
        'is_public' => true,
        'quality_tier' => 'validated',
        'tags' => ['hypertension', 'reuse'],
    ]);
    PhenotypeLibraryEntry::create([
        'cohort_id' => 880001,
        'cohort_name' => 'Hypertension Phenotype Library entry',
        'description' => 'Library phenotype for hypertension.',
        'expression_json' => $cohortExpression,
        'logic_description' => 'First hypertension condition occurrence.',
        'tags' => ['hypertension'],
        'domain' => 'Condition',
        'severity' => 'validated',
        'is_imported' => true,
        'imported_cohort_id' => $localCohort->id,
    ]);
    $source = Source::factory()->create([
        'source_name' => 'Hypertension CDM',
        'source_key' => 'HYPERTENSION_CDM',
        'source_connection' => 'jdbc:postgresql://example.invalid/private',
        'is_default' => true,
    ]);
    SourceDaimon::create([
        'source_id' => $source->id,
        'daimon_type' => DaimonType::CDM->value,
        'table_qualifier' => 'omop',
        'priority' => 1,
    ]);
    SourceDaimon::create([
        'source_id' => $source->id,
        'daimon_type' => DaimonType::Results->value,
        'table_qualifier' => 'results',
        'priority' => 1,
    ]);
    SourceProfile::create([
        'source_id' => $source->id,
        'scan_type' => 'whiterabbit',
        'overall_grade' => 'A',
        'table_count' => 37,
        'total_rows' => 100000,
        'row_count' => 100000,
        'column_count' => 250,
        'summary_json' => ['source_rows_sample' => 'must not be emitted'],
    ]);
    SourceRelease::factory()->create([
        'source_id' => $source->id,
        'release_key' => 'hypertension-2026q2',
        'release_name' => 'Hypertension 2026 Q2',
        'person_count' => 1000,
        'record_count' => 100000,
    ]);

    $runner = app(StudyDesignToolRunner::class);
    $context = $runner->run('study_design_get_context', [
        'study_id' => $this->study->id,
        'session_id' => $sessionId,
        'version_id' => $versionId,
    ]);
    $readiness = $runner->run('study_design_readiness_check', [
        'study_slug' => $this->study->slug,
        'session_id' => $sessionId,
        'version_id' => $versionId,
    ]);
    $search = $runner->run('vocabulary_search_concepts', [
        'query' => 'Hypertension',
        'limit' => 5,
    ]);
    $validation = $runner->run('vocabulary_validate_concepts', [
        'concept_ids' => [201826, 999001, 999002, 123456789],
    ]);
    $phenotypes = $runner->run('phenotype_search_library', [
        'query' => 'Hypertension',
        'limit' => 3,
    ]);
    $conceptSets = $runner->run('local_concept_set_search', [
        'query' => 'Hypertension',
        'limit' => 3,
    ]);
    $cohorts = $runner->run('local_cohort_search', [
        'query' => 'Hypertension',
        'limit' => 3,
    ]);
    $cohortExpressionValidation = $runner->run('cohort_expression_validate', [
        'cohort_definition_id' => $localCohort->id,
    ]);
    $sourceProfile = $runner->run('data_source_profile', [
        'source_key' => 'HYPERTENSION_CDM',
    ]);
    $draftPatch = $runner->run('draft_asset_patch', [
        'study_id' => $this->study->id,
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_id' => $conceptDraftAsset->id,
        'patch' => [
            'search_terms' => ['hypertension'],
            'concepts' => [
                ['concept_id' => 201826],
                ['concept_id' => 123456789],
            ],
            'raw_protocol_text' => 'patch secret protocol text',
        ],
    ]);
    $hades = $runner->run('hades_package_status', [
        'packages' => ['CohortMethod', 'MissingPackage'],
    ]);
    $orchestratedSearch = app(StudyDesignAbbyOrchestrator::class)->runTool('vocabulary_search_concepts', [
        'query' => 'Hypertension',
        'limit' => 1,
    ]);

    expect($runner->tools())->toContain('study_design_get_context', 'vocabulary_validate_concepts', 'phenotype_search_library', 'local_concept_set_search', 'local_cohort_search', 'cohort_expression_validate', 'data_source_profile', 'draft_asset_patch', 'hades_package_status')
        ->and($context['tool'])->toBe('study_design_get_context')
        ->and($context['data']['schema_version'])->toBe('study-design-context.v1')
        ->and(json_encode($context, JSON_THROW_ON_ERROR))->not->toContain('tool runner secret protocol text')
        ->and($readiness['data']['cohorts']['ready'])->toBeFalse()
        ->and($search['data']['items'][0]['concept_id'])->toBe(201826)
        ->and($validation['data']['valid'])->toBeFalse()
        ->and(collect($validation['data']['issues'])->pluck('status')->all())->toContain('deprecated', 'non_standard', 'missing')
        ->and($phenotypes['data']['items'][0]['cohort_name'])->toBe('Hypertension Phenotype Library entry')
        ->and($conceptSets['data']['items'][0]['concept_set_id'])->toBe($localConceptSet->id)
        ->and($cohorts['data']['items'][0]['cohort_definition_id'])->toBe($localCohort->id)
        ->and($cohortExpressionValidation['data']['valid'])->toBeTrue()
        ->and($sourceProfile['data']['items'][0]['source_key'])->toBe('HYPERTENSION_CDM')
        ->and($sourceProfile['data']['items'][0]['latest_profile']['overall_grade'])->toBe('A')
        ->and(json_encode($sourceProfile, JSON_THROW_ON_ERROR))->not->toContain('jdbc:postgresql', 'must not be emitted')
        ->and($draftPatch['data']['schema_version'])->toBe('draft-asset-patch.v1')
        ->and($draftPatch['data']['write_performed'])->toBeFalse()
        ->and($draftPatch['data']['can_apply_after_user_review'])->toBeFalse()
        ->and(collect($draftPatch['data']['validation']['issues'])->pluck('code')->all())->toContain('concept_missing')
        ->and(json_encode($draftPatch, JSON_THROW_ON_ERROR))->not->toContain('patch secret protocol text')
        ->and($conceptDraftAsset->fresh()->draft_payload_json['search_terms'] ?? null)->toBeNull()
        ->and($hades['data']['packages'][0]['package'])->toBe('CohortMethod')
        ->and($hades['data']['packages'][0]['installed'])->toBeTrue()
        ->and($hades['data']['packages'][1]['status'])->toBe('missing_from_inventory')
        ->and($orchestratedSearch['data']['count'])->toBe(1);
});

it('builds Abby compiler guidance across remaining Study Design entries without leaking protocol text', function () {
    $conceptSet = ConceptSet::create([
        'name' => 'Guidance hypertension concept set',
        'description' => 'Guidance concept set.',
        'expression_json' => ['items' => [['concept_id' => 201826]]],
        'author_id' => $this->user->id,
        'is_public' => false,
        'tags' => ['study-designer'],
    ]);
    $cohort = CohortDefinition::create([
        'name' => 'Guidance target cohort',
        'description' => 'Guidance target cohort.',
        'expression_json' => ['ConceptSets' => [$conceptSet->id]],
        'author_id' => $this->user->id,
        'is_public' => false,
    ]);
    $session = $this->study->designSessions()->create([
        'created_by' => $this->user->id,
        'title' => 'Abby guidance pass',
        'source_mode' => 'protocol_upload',
        'status' => 'reviewing',
    ]);
    $version = $session->versions()->create([
        'version_number' => 1,
        'status' => 'review_ready',
        'intent_json' => [
            'research_question' => 'Among adults with hypertension, does treatment reduce stroke compared with usual care?',
            'primary_objective' => 'Estimate stroke reduction after treatment.',
            'pico' => [
                'population' => 'Adults with hypertension',
                'intervention' => 'Treatment initiation',
                'comparator' => 'Usual care',
                'outcome' => 'Stroke',
                'time_at_risk' => 'Index date through 365 days after cohort entry',
            ],
            'initial_gate' => [
                'status' => 'ready',
                'summary' => 'Protocol contains enough detail for Study Design review.',
                'issues' => [[
                    'field' => 'comparator',
                    'severity' => 'review',
                    'message' => 'Confirm usual care is computable in the selected data sources.',
                ]],
            ],
        ],
        'normalized_spec_json' => [
            'study' => [
                'study_type' => 'comparative_effectiveness',
                'research_question' => 'Among adults with hypertension, does treatment reduce stroke compared with usual care?',
                'primary_objective' => 'Estimate stroke reduction after treatment.',
            ],
            'pico' => [
                'population' => 'Adults with hypertension',
                'intervention' => 'Treatment initiation',
                'comparator' => ['summary' => 'Usual care'],
                'outcomes' => [['summary' => 'Stroke']],
                'outcome' => 'Stroke',
                'time_at_risk' => 'Index date through 365 days after cohort entry',
            ],
        ],
        'provenance_json' => ['source' => 'protocol_upload_abby'],
    ]);
    $session->update(['active_version_id' => $version->id]);

    StudyDesignAsset::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'asset_type' => 'concept_set_draft',
        'role' => 'target',
        'status' => 'needs_review',
        'verification_status' => 'unverified',
        'draft_payload_json' => [
            'title' => 'Guidance hypertension draft',
            'raw_protocol_text' => 'guidance secret protocol text',
            'concepts' => [['concept_id' => 201826]],
        ],
    ]);
    StudyDesignAsset::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'asset_type' => 'cohort_draft',
        'role' => 'target',
        'status' => 'materialized',
        'verification_status' => 'verified',
        'draft_payload_json' => ['title' => 'Guidance materialized cohort', 'role' => 'target'],
        'materialized_type' => CohortDefinition::class,
        'materialized_id' => $cohort->id,
        'materialized_at' => now(),
        'verified_at' => now(),
    ]);
    StudyDesignAsset::create([
        'session_id' => $session->id,
        'version_id' => $version->id,
        'asset_type' => 'analysis_plan',
        'role' => null,
        'status' => 'needs_review',
        'verification_status' => 'blocked',
        'draft_payload_json' => [
            'title' => 'Guidance estimation plan',
            'analysis_type' => 'estimation',
            'blockers' => [['code' => 'missing_hades_package']],
        ],
        'verification_json' => [
            'messages' => ['CohortMethod is not installed.'],
        ],
    ]);

    $response = $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$session->id}/versions/{$version->id}/guidance")
        ->assertOk()
        ->assertJsonPath('data.schema_version', 'study-design-guidance.v1')
        ->assertJsonPath('data.mode', 'abby_compiler_harness')
        ->assertJsonPath('data.initial_gate.status', 'ready')
        ->assertJsonPath('data.initial_gate.blocking_count', 0)
        ->assertJsonPath('data.sections.0.id', 'intent')
        ->assertJsonPath('data.sections.0.status', 'ready')
        ->assertJsonPath('data.sections.1.id', 'concept_sets')
        ->assertJsonPath('data.sections.1.status', 'needs_review')
        ->assertJsonPath('data.sections.2.id', 'cohorts')
        ->assertJsonPath('data.sections.2.status', 'blocked')
        ->assertJsonPath('data.sections.4.id', 'analysis_plans')
        ->assertJsonPath('data.sections.4.status', 'blocked')
        ->assertJsonPath('data.next_best_actions.0.priority', 'blocking');

    $guidance = $response->json('data');
    $serviceGuidance = app(StudyDesignGuidanceService::class)->build($this->study, $session->fresh(), $version->fresh());
    $orchestrated = app(StudyDesignAbbyOrchestrator::class)->studyDesignGuidance($this->study, $session->fresh(), $version->fresh());

    expect($serviceGuidance['schema_version'])->toBe('study-design-guidance.v1')
        ->and($orchestrated['schema_version'])->toBe('study-design-guidance.v1')
        ->and(collect($guidance['sections'])->pluck('id')->all())->toBe([
            'intent',
            'concept_sets',
            'cohorts',
            'feasibility',
            'analysis_plans',
            'human_review',
            'package_lock',
        ])
        ->and(collect($guidance['sections'][2]['actions'])->pluck('type')->all())->toContain('link_materialized_cohort')
        ->and(collect($guidance['next_best_actions'])->pluck('type')->all())->toContain('resolve_analysis_blockers')
        ->and(json_encode($guidance, JSON_THROW_ON_ERROR))->not->toContain('guidance secret protocol text');
});

it('runs Study Design Abby harness tasks through local MedGemma on Ollama only', function () {
    config()->set('services.abby.ollama_url', 'http://ollama.test');
    config()->set('services.abby.ollama_model', 'puyangwang/medgemma-27b-it:q4_0');
    config()->set('services.abby.ollama_timeout', 33);

    Http::fake([
        'http://ollama.test/api/chat' => Http::response([
            'message' => [
                'content' => json_encode([
                    'summary' => 'Use the compiler readiness checklist before package lock.',
                    'actions' => [['type' => 'review_assets', 'priority' => 'high']],
                    'warnings' => ['Harness output is advisory only.'],
                ]),
            ],
            'prompt_eval_count' => 12,
            'eval_count' => 24,
            'total_duration' => 123456,
        ]),
        'https://api.anthropic.com/*' => Http::response(['unexpected' => true], 500),
    ]);

    $result = app(StudyDesignAbbyOrchestrator::class)->runLocalHarness('compiler_guidance_summary', [
        'guidance' => ['schema_version' => 'study-design-guidance.v1'],
        'raw_protocol_text' => 'local harness secret protocol text',
        'nested' => [
            'source_rows' => [['person_id' => 1]],
        ],
    ]);
    $metadata = app(StudyDesignOllamaClient::class)->metadata();

    expect($result['provider'])->toBe('ollama')
        ->and($result['model'])->toBe('puyangwang/medgemma-27b-it:q4_0')
        ->and($result['harness_role'])->toBe('local_control_plane')
        ->and($result['output']['summary'])->toBe('Use the compiler readiness checklist before package lock.')
        ->and($result['safety']['deep_protocol_evaluation_allowed'])->toBeFalse()
        ->and($metadata['base_url'])->toBe('http://ollama.test')
        ->and($metadata['model'])->toBe('puyangwang/medgemma-27b-it:q4_0');

    Http::assertSent(function ($request) {
        $body = json_encode($request->data(), JSON_THROW_ON_ERROR);

        return $request->url() === 'http://ollama.test/api/chat'
            && ($request->data()['model'] ?? null) === 'puyangwang/medgemma-27b-it:q4_0'
            && ($request->data()['format'] ?? null) === 'json'
            && str_contains($body, 'compiler_guidance_summary')
            && ! str_contains($body, 'local harness secret protocol text')
            && ! str_contains($body, 'person_id');
    });
    Http::assertNotSent(fn ($request): bool => str_contains($request->url(), 'api.anthropic.com'));
});

it('rejects malformed local Abby harness structured output before orchestration can use it', function () {
    config()->set('services.abby.ollama_url', 'http://ollama.test');
    config()->set('services.abby.ollama_model', 'puyangwang/medgemma-27b-it:q4_0');

    Http::fake([
        'http://ollama.test/api/chat' => Http::response([
            'message' => [
                'content' => json_encode([
                    'actions' => [['priority' => 'high', 'canonical_write' => true]],
                    'warnings' => 'not-an-array',
                    'draft_payload_json' => ['title' => 'Unsafe write shape'],
                ]),
            ],
        ]),
    ]);

    expect(fn () => app(StudyDesignAbbyOrchestrator::class)->runLocalHarness('compiler_guidance_summary', [
        'guidance' => ['schema_version' => 'study-design-guidance.v1'],
    ]))->toThrow(
        RuntimeException::class,
        'Local Abby harness returned invalid structured output for compiler_guidance_summary: summary is required; actions.0.type is required; actions.0.canonical_write must not be true; warnings must be an array; draft_payload_json is not allowed in local harness output.'
    );
});

it('exposes named structured output schemas for every Study Design Compiler stage', function () {
    $catalog = app(StudyDesignStructuredOutputSchemas::class)->catalog();
    $orchestratorCatalog = app(StudyDesignAbbyOrchestrator::class)->structuredOutputSchemas();

    expect(array_keys($catalog))->toBe([
        'protocol_extraction',
        'compiler_guidance',
        'phenotype_recommendation',
        'concept_set_draft',
        'cohort_draft',
        'analysis_plan_draft',
        'asset_repair_suggestion',
        'package_manifest_review',
    ])
        ->and($orchestratorCatalog['concept_set_draft']['name'])->toBe('ConceptSetDraftSchema')
        ->and($catalog['protocol_extraction']['name'])->toBe('ProtocolExtractionSchema')
        ->and($catalog['protocol_extraction']['json_schema']['properties'])->toHaveKeys([
            'evidence_spans',
            'confidence',
            'uncertainty',
            'design_assumptions',
        ])
        ->and($catalog['phenotype_recommendation']['json_schema']['properties'])->toHaveKey('recommendations')
        ->and($catalog['package_manifest_review']['json_schema']['properties'])->toHaveKeys([
            'lock_ready',
            'manifest_preview',
            'unresolved_risks',
            'provenance_summary',
        ]);
});

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

it('routes phenotype recommendations through the reuse service and ranks verified local assets', function () {
    Http::fake([
        'http://python-ai:8000/study-agent/recommend-phenotypes' => Http::response(['recommendations' => []]),
        '*' => Http::response([], 404),
    ]);

    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);
    $version = StudyDesignVersion::findOrFail($versionId);
    $version->update([
        'normalized_spec_json' => [
            'study' => [
                'research_question' => 'Among adults with diabetes, does treatment improve cardiovascular outcomes?',
                'primary_objective' => 'Evaluate diabetes treatment outcomes.',
            ],
            'pico' => [
                'population' => ['summary' => 'Adults with diabetes'],
                'intervention_or_exposure' => ['summary' => 'Diabetes treatment initiation'],
                'comparator' => ['summary' => 'Usual care'],
                'outcomes' => [['summary' => 'Cardiovascular outcomes', 'primary' => true]],
                'time' => ['summary' => 'Index date through 365 days follow-up'],
            ],
        ],
    ]);

    PhenotypeLibraryEntry::create([
        'cohort_id' => 9001,
        'cohort_name' => 'Diabetes treatment phenotype',
        'description' => 'Reusable phenotype for adults with diabetes receiving treatment.',
        'expression_json' => ['ConceptSets' => [['name' => 'Diabetes']]],
        'logic_description' => 'Adults with diabetes and treatment exposure.',
        'domain' => 'Condition',
        'is_imported' => false,
    ]);
    CohortDefinition::factory()->create([
        'name' => 'Diabetes treatment target cohort',
        'description' => 'Local cohort for adults with diabetes treatment initiation.',
        'author_id' => $this->user->id,
    ]);
    ConceptSet::factory()->create([
        'name' => 'Diabetes concept set',
        'description' => 'Local concept set for diabetes concepts.',
        'expression_json' => ['items' => [['concept_id' => 201826]]],
        'author_id' => $this->user->id,
    ]);

    $response = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/phenotypes/recommend")
        ->assertCreated()
        ->assertJsonPath('data.0.asset_type', 'local_cohort');

    $assets = collect($response->json('data'));

    expect($assets->pluck('asset_type')->all())
        ->toContain('phenotype_recommendation', 'local_cohort', 'local_concept_set')
        ->and($assets->pluck('verification_status')->unique()->all())->toBe(['verified'])
        ->and($assets->pluck('rank_score')->filter()->count())->toBeGreaterThanOrEqual(3)
        ->and($assets->pluck('draft_payload_json.canonical_source_required')->filter()->count())->toBe(0);

    $this->assertDatabaseHas('study_design_ai_events', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'event_type' => 'phenotype_recommend',
        'provider' => 'abby',
        'model' => 'deterministic-reuse-ranker',
    ]);
});

it('imports a markdown protocol through Abby-orchestrated Claude evaluation and creates reviewable design drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.abby.ollama_model', 'puyangwang/medgemma-27b-it:q4_0');
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
                    'evidence_spans' => [[
                        'field' => 'population',
                        'quote' => 'Adults with type 2 diabetes',
                        'section' => 'Eligibility',
                        'confidence' => 0.91,
                    ], [
                        'field' => 'time_at_risk',
                        'quote' => 'One year after index date',
                        'section' => 'Follow-up',
                        'confidence' => 0.78,
                    ]],
                    'confidence' => [
                        'overall' => 0.86,
                        'population' => 0.91,
                        'time_at_risk' => 0.78,
                    ],
                    'uncertainty' => [[
                        'field' => 'comparator',
                        'severity' => 'review',
                        'message' => 'Usual care needs operational confirmation.',
                        'evidence' => 'Usual care without metformin initiation',
                    ]],
                    'design_assumptions' => [[
                        'field' => 'comparator',
                        'severity' => 'review',
                        'message' => 'Treat usual care as eligible non-metformin initiators until reviewed.',
                    ]],
                    'concept_set_drafts' => [[
                        'title' => 'Type 2 diabetes',
                        'role' => 'population',
                        'domain' => 'Condition',
                        'clinical_rationale' => 'Defines the eligible population.',
                        'search_terms' => ['type 2 diabetes'],
                        'evidence_spans' => [[
                            'field' => 'population',
                            'quote' => 'Adults with type 2 diabetes',
                            'confidence' => 0.91,
                        ]],
                    ]],
                    'cohort_definition_drafts' => [[
                        'title' => 'Metformin initiators',
                        'role' => 'target',
                        'description' => 'New metformin users.',
                        'entry_event' => 'first metformin exposure',
                        'exit_strategy' => 'one year after index',
                        'evidence_spans' => [[
                            'field' => 'exposure',
                            'quote' => 'Metformin initiation',
                            'confidence' => 0.88,
                        ]],
                    ]],
                    'analysis_plan' => [[
                        'title' => 'Comparative effectiveness analysis',
                        'analysis_type' => 'estimation',
                        'hades_package' => 'CohortMethod',
                        'rationale' => 'Compare target and comparator cohorts.',
                        'evidence_spans' => [[
                            'field' => 'analysis_plan',
                            'quote' => 'compared with usual care',
                            'confidence' => 0.8,
                        ]],
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

    $rawProtocolText = "# Protocol\n\nEvaluate metformin and kidney failure.";
    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, $rawProtocolText);
    $file = new UploadedFile($path, 'protocol.md', 'text/markdown', null, true);

    $versionId = $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => $file,
        ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'review_ready')
        ->assertJsonPath('data.provenance_json.source', 'protocol_upload_abby')
        ->assertJsonPath('data.provenance_json.orchestrator', 'abby')
        ->assertJsonPath('data.provenance_json.harness_model', 'puyangwang/medgemma-27b-it:q4_0')
        ->assertJsonPath('data.provenance_json.evaluator_provider', 'anthropic')
        ->assertJsonPath('data.provenance_json.evaluator_model', 'claude-test')
        ->assertJsonPath('data.intent_json.pico.population', 'Adults with type 2 diabetes')
        ->assertJsonPath('data.intent_json.pico.outcome', 'Kidney failure')
        ->assertJsonPath('data.intent_json.evidence_spans.0.quote', 'Adults with type 2 diabetes')
        ->assertJsonPath('data.intent_json.confidence.overall', 0.86)
        ->assertJsonPath('data.normalized_spec_json.uncertainty.0.message', 'Usual care needs operational confirmation.')
        ->json('data.id');

    $this->assertDatabaseHas('study_design_ai_events', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'event_type' => 'protocol_import',
        'provider' => 'anthropic',
        'model' => 'claude-test',
    ]);

    $event = StudyDesignAiEvent::where('session_id', $sessionId)
        ->where('version_id', $versionId)
        ->where('event_type', 'protocol_import')
        ->firstOrFail();

    expect($event->input_json['orchestrator'])->toBe('abby')
        ->and($event->input_json['harness_provider'])->toBe('ollama')
        ->and($event->input_json['harness_model'])->toBe('puyangwang/medgemma-27b-it:q4_0')
        ->and($event->input_json['evaluator_provider'])->toBe('anthropic')
        ->and($event->input_json['evaluator_model'])->toBe('claude-test')
        ->and($event->input_json['cloud_scope'])->toBe('study_design_protocol_import')
        ->and($event->output_json['extracted']['evidence_spans'][0]['field'])->toBe('population')
        ->and($event->output_json['normalized_spec']['design_assumptions'][0]['field'])->toBe('comparator')
        ->and($event->safety_json['cloud_evaluation_scoped_to_protocol_import'])->toBeTrue()
        ->and($event->safety_json['ordinary_abby_chat_stays_local'])->toBeTrue();

    $version = StudyDesignVersion::with('assets')->findOrFail($versionId);
    $persistedJsonPayloads = [
        $version->intent_json,
        $version->normalized_spec_json,
        $version->provenance_json,
        $event->input_json,
        $event->output_json,
        $event->safety_json,
        ...$version->assets->flatMap(fn (StudyDesignAsset $asset): array => [
            $asset->draft_payload_json,
            $asset->provenance_json,
            $asset->verification_json,
            $asset->rank_score_json,
        ])->all(),
    ];

    foreach ($persistedJsonPayloads as $payload) {
        expect(json_encode($payload))->not->toContain($rawProtocolText);
    }

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
        'asset_type' => 'analysis_plan',
    ]);

    $analysisPlan = StudyDesignAsset::query()
        ->where('session_id', $sessionId)
        ->where('version_id', $versionId)
        ->where('asset_type', 'analysis_plan')
        ->get()
        ->first(fn (StudyDesignAsset $asset): bool => ($asset->draft_payload_json['analysis_type'] ?? null) === 'estimation');

    expect($analysisPlan)->not->toBeNull()
        ->and($analysisPlan->draft_payload_json['hades_package'])->toBe('CohortMethod')
        ->and($analysisPlan->draft_payload_json['evidence_spans'][0]['field'])->toBe('analysis_plan')
        ->and($analysisPlan->provenance_json['source'])->toBe('protocol_upload_abby')
        ->and($analysisPlan->provenance_json['orchestrator'])->toBe('abby')
        ->and($analysisPlan->rank_score_json['source'])->toBe('protocol_upload_abby')
        ->and($analysisPlan->draft_payload_json['design_json'])->toBeArray();
});

it('creates a new study when importing a standalone protocol document', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
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
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
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
                    'time_at_risk' => '30 days after admission index date',
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
            && str_contains((string) ($request->data()['system'] ?? ''), "Abby's research-grade protocol evaluator")
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

it('adds optional remote prompt caching to protocol evaluation requests when enabled', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.abby.protocol_prompt_caching_enabled', true);
    config()->set('services.abby.protocol_prompt_cache_ttl', '1h');
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

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
                    'time_at_risk' => '30 days after admission index date',
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
                    'evidence_spans' => [[
                        'field' => 'population',
                        'quote' => 'Adults with pneumonia',
                        'confidence' => 0.9,
                    ]],
                    'confidence' => ['overall' => 0.9],
                ],
            ]],
            'usage' => [
                'cache_creation_input_tokens' => 2048,
                'cache_read_input_tokens' => 0,
            ],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Prompt cached protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertCreated();

    Http::assertSent(function ($request) {
        return ($request->data()['cache_control']['type'] ?? null) === 'ephemeral'
            && ($request->data()['cache_control']['ttl'] ?? null) === '1h';
    });

    $event = StudyDesignAiEvent::where('session_id', $sessionId)
        ->where('event_type', 'protocol_import')
        ->firstOrFail();

    expect($event->safety_json['protocol_prompt_caching_enabled'])->toBeTrue();
});

it('blocks protocol cloud evaluation when the Abby-scoped compiler flag is disabled', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', false);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response(['unexpected' => true], 200),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Disabled protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');

    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, "# Protocol\n\nEvaluate pathogen class prediction in pneumonia.");
    $file = new UploadedFile($path, 'protocol.md', 'text/markdown', null, true);

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => $file,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol cloud evaluation is disabled. Set ABBY_PROTOCOL_CLOUD_EVALUATION_ENABLED=true to allow research-grade evaluation of uploaded protocols while ordinary Abby chat remains local.');

    Http::assertNothingSent();
});

it('fails protocol imports cleanly when the scoped protocol evaluator is not configured', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', null);
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response(['unexpected' => true], 200),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Misconfigured protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $path = tempnam(sys_get_temp_dir(), 'protocol-');
    file_put_contents($path, "# Protocol\n\nEvaluate pathogen class prediction in pneumonia.");
    $file = new UploadedFile($path, 'protocol.md', 'text/markdown', null, true);

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => $file,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol evaluator is not configured. Add a protocol evaluator API key in System Health > AI Providers.');

    expect(StudyDesignVersion::where('session_id', $sessionId)->count())->toBe($versionCount);
    $this->assertDatabaseMissing('study_design_ai_events', [
        'session_id' => $sessionId,
        'event_type' => 'protocol_import',
    ]);
    Http::assertNothingSent();
});

it('rejects malformed protocol extraction output before persisting drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'tool_use',
                'name' => 'extract_protocol',
                'input' => [
                    'population' => 'Adults with pneumonia',
                    'outcome' => 'Clinical deterioration',
                    'concept_set_drafts' => 'not-an-array',
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
            'title' => 'Malformed protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol evaluator returned invalid structured output: research_question is required; concept_set_drafts must be an array.');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
});

it('rejects protocol draft asset output that includes unvalidated OMOP concept IDs before persistence', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'tool_use',
                'name' => 'extract_protocol',
                'input' => [
                    'research_question' => 'Among adults with hypertension, does treatment reduce stroke?',
                    'primary_objective' => 'Estimate treatment effect.',
                    'population' => 'Adults with hypertension',
                    'exposure' => 'Treatment initiation',
                    'comparator' => 'Usual care',
                    'outcome' => 'Stroke',
                    'time_at_risk' => 'Index through 365 days',
                    'study_type' => 'comparative_effectiveness',
                    'study_design' => 'retrospective cohort',
                    'concept_set_drafts' => [[
                        'title' => 'Hypertension concept set',
                        'role' => 'target',
                        'domain' => 'Condition',
                        'search_terms' => ['hypertension'],
                        'concepts' => [['concept_id' => 201826]],
                    ]],
                    'cohort_definition_drafts' => [],
                    'analysis_plan' => [],
                    'feasibility_plan' => ['summary' => '', 'minimum_cell_count' => null, 'source_requirements' => []],
                    'validation_plan' => ['summary' => '', 'checks' => []],
                    'publication_plan' => ['summary' => '', 'outputs' => []],
                    'open_questions' => [],
                    'risk_notes' => [],
                    'initial_gate' => ['status' => 'ready', 'issues' => []],
                ],
            ]],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Unsafe model concept output',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby draft asset schema validation failed before persistence: concept_set_drafts.0 must not include OMOP concept IDs before vocabulary validation.');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
});

it('rejects under-specified protocols with detailed initial gate issues before persisting drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'tool_use',
                'name' => 'extract_protocol',
                'input' => [
                    'research_question' => 'Does treatment improve hypertension outcomes?',
                    'primary_objective' => 'Evaluate treatment effect.',
                    'population' => 'Adults with hypertension',
                    'exposure' => '',
                    'comparator' => 'usual care',
                    'outcome' => 'Blood pressure control',
                    'time_at_risk' => '',
                    'study_type' => 'comparative_effectiveness',
                    'study_design' => 'retrospective cohort',
                    'concept_set_drafts' => [],
                    'cohort_definition_drafts' => [],
                    'analysis_plan' => [],
                    'feasibility_plan' => ['summary' => '', 'minimum_cell_count' => null, 'source_requirements' => []],
                    'validation_plan' => ['summary' => '', 'checks' => []],
                    'publication_plan' => ['summary' => '', 'outputs' => []],
                    'initial_gate' => [
                        'status' => 'fail',
                        'summary' => 'Protocol lacks the exposure and time-at-risk parameters needed for initial compilation.',
                        'issues' => [[
                            'field' => 'exposure',
                            'severity' => 'blocking',
                            'message' => 'The protocol does not identify the treatment or index event.',
                            'evidence' => '',
                        ]],
                    ],
                    'open_questions' => [],
                    'risk_notes' => [],
                ],
            ]],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Under-specified protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('gate', 'initial_protocol_gate')
        ->assertJsonPath('issues.0.field', 'exposure')
        ->assertJsonPath('issues.0.message', 'The protocol does not identify the treatment or index event.')
        ->assertJsonPath('issues.1.field', 'time_at_risk')
        ->assertJsonPath('summary.status', 'failed');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
});

it('rejects protocol evaluator refusals before persisting drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'content' => [[
                'type' => 'text',
                'text' => 'I cannot comply with that protocol extraction request.',
            ]],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Refused protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol evaluator refused the protocol extraction request.');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
});

it('rejects truncated protocol evaluator extraction before persisting drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'stop_reason' => 'max_tokens',
            'content' => [[
                'type' => 'text',
                'text' => '{"research_question":"partial"',
            ]],
        ]),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Truncated protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol evaluator was truncated before structured output completed.');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
});

it('handles protocol evaluator provider failures before persisting protocol drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => Http::response([
            'error' => ['message' => 'upstream unavailable'],
        ], 503),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Provider failure protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol evaluator returned HTTP 503: upstream unavailable');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
});

it('handles protocol evaluator request timeouts before persisting protocol drafts', function () {
    config()->set('services.abby.protocol_cloud_evaluation_enabled', true);
    config()->set('services.anthropic.key', 'test-anthropic-key');
    config()->set('services.anthropic.model', 'claude-test');

    Http::fake([
        'https://api.anthropic.com/*' => fn () => throw new ConnectionException('cURL error 28: Operation timed out'),
    ]);

    $sessionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions", [
            'title' => 'Timeout protocol upload',
        ])
        ->assertCreated()
        ->json('data.id');
    $versionCount = StudyDesignVersion::where('session_id', $sessionId)->count();

    $this->actingAs($this->user)
        ->post("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/protocol-import", [
            'protocol' => makeStudyDesignProtocolUpload(),
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Abby protocol evaluator request failed: cURL error 28: Operation timed out');

    assertNoProtocolImportDraftsPersisted($sessionId, $versionCount);
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
    $source = createStudyDesignFeasibilitySource([$cohort->id]);

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
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
        ])
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'verified');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/accept")
        ->assertOk()
        ->assertJsonPath('data.status', 'accepted');

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock-readiness")
        ->assertOk()
        ->assertJsonPath('data.ready', true)
        ->assertJsonPath('data.status', 'ready')
        ->assertJsonPath('data.can_lock', true)
        ->assertJsonPath('data.checklist.0.id', 'intent')
        ->assertJsonPath('data.checklist.6.id', 'package')
        ->assertJsonPath('data.abby_final_review.status', 'ready')
        ->assertJsonPath('data.manifest_preview.schema_version', 'study-package.v1')
        ->assertJsonPath('data.manifest_preview.artifact', null)
        ->assertJsonPath('data.provenance_summary.package_manifest_sha256', null);

    $artifactId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/lock")
        ->assertOk()
        ->assertJsonPath('data.status', 'locked')
        ->assertJsonPath('readiness.ready', true)
        ->assertJsonPath('readiness.status', 'locked')
        ->assertJsonPath('readiness.checklist.0.id', 'intent')
        ->assertJsonPath('readiness.checklist.6.id', 'package')
        ->assertJsonPath('readiness.abby_final_review.status', 'ready')
        ->assertJsonPath('readiness.manifest_preview.contents.analysis_plans', 1)
        ->assertJsonPath('readiness.manifest_preview.artifact.url', fn (string $url): bool => str_contains($url, '/download'))
        ->assertJsonPath('readiness.provenance_summary.package_manifest_sha256', fn (?string $hash): bool => is_string($hash) && strlen($hash) === 64)
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
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/concept-sets/verify")
        ->assertOk()
        ->assertJsonPath('data.0.verification_status', 'blocked')
        ->assertJsonPath('data.0.verification_json.checks.all_concepts_exist_in_vocab_concept', false)
        ->assertJsonPath('data.0.verification_json.checks.all_concepts_are_current', false)
        ->assertJsonPath('data.0.verification_json.repair_suggestions.0.code', 'remove_unverified_concepts');

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

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/concept-sets/materialize")
        ->assertStatus(422)
        ->assertJsonPath('message', 'Asset must be accepted before materialization.');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/review", [
            'decision' => 'accept',
            'review_notes' => 'Vocabulary verified and ready for native materialization.',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'accepted');

    $materializedId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/concept-sets/materialize")
        ->assertCreated()
        ->assertJsonPath('data.status', 'materialized')
        ->assertJsonPath('data.materialized_type', ConceptSet::class)
        ->json('materialized.id');

    $this->assertDatabaseHas('concept_set_items', [
        'concept_set_id' => $materializedId,
        'concept_id' => 201826,
    ]);
});

it('drafts verifies materializes and links cohort drafts from materialized concept sets', function () {
    seedStudyDesignVocabularyConcept(201826);
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);

    $conceptAssetId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/concept-sets/draft", [
            'drafts' => [[
                'title' => 'Verified hypertension concept set',
                'role' => 'target',
                'domain' => 'Condition',
                'clinical_rationale' => 'Known OMOP concept seeded for cohort compiler test.',
                'concepts' => [
                    ['concept_id' => 201826, 'include_descendants' => true, 'include_mapped' => false],
                ],
            ]],
        ])
        ->assertCreated()
        ->json('data.0.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$conceptAssetId}/concept-sets/verify")
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'verified');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$conceptAssetId}/review", [
            'decision' => 'accept',
        ])
        ->assertOk();

    $conceptSetId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$conceptAssetId}/concept-sets/materialize")
        ->assertCreated()
        ->json('materialized.id');

    $cohortAssetId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/cohorts/draft")
        ->assertCreated()
        ->assertJsonPath('data.0.verification_status', 'verified')
        ->assertJsonPath('data.0.draft_payload_json.concept_set_ids.0', $conceptSetId)
        ->assertJsonPath('data.0.draft_payload_json.expression_json.PrimaryCriteria.CriteriaList.0.ConditionOccurrence.CodesetId', 0)
        ->assertJsonPath('data.0.verification_json.checks.has_primary_criteria', true)
        ->assertJsonPath('data.0.verification_json.checks.has_observation_window', true)
        ->json('data.0.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAssetId}/cohorts/materialize")
        ->assertStatus(422);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAssetId}/review", [
            'decision' => 'accept',
            'review_notes' => 'Cohort expression verified and ready for native materialization.',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'accepted');

    $cohortDefinitionId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAssetId}/cohorts/materialize")
        ->assertCreated()
        ->assertJsonPath('data.status', 'materialized')
        ->assertJsonPath('data.materialized_type', CohortDefinition::class)
        ->json('materialized.id');

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/cohorts/readiness")
        ->assertOk()
        ->assertJsonPath('data.status', 'blocked')
        ->assertJsonPath('data.ready_for_feasibility', false)
        ->assertJsonPath('data.missing_roles.0', 'target')
        ->assertJsonPath('data.blockers.0.code', 'missing_target_cohort')
        ->assertJsonPath('data.blockers.0.action.type', 'link_materialized_cohort')
        ->assertJsonPath('data.blockers.0.action.role', 'target')
        ->assertJsonPath('data.blockers.0.action.asset_id', $cohortAssetId)
        ->assertJsonPath('data.action_targets.0.type', 'link_materialized_cohort')
        ->assertJsonPath('data.materialized_unlinked_assets.0.id', $cohortAssetId);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAssetId}/cohorts/link-to-study")
        ->assertCreated()
        ->assertJsonPath('data.role', 'target')
        ->assertJsonPath('data.cohort_definition_id', $cohortDefinitionId);

    $this->actingAs($this->user)
        ->getJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/cohorts/readiness")
        ->assertOk()
        ->assertJsonPath('data.status', 'ready')
        ->assertJsonPath('data.ready_for_feasibility', true)
        ->assertJsonPath('data.present_roles.target', 1)
        ->assertJsonPath('data.drafts.linked', 1);

    $this->assertDatabaseHas('study_cohorts', [
        'study_id' => $this->study->id,
        'cohort_definition_id' => $cohortDefinitionId,
        'role' => 'target',
    ]);
});

it('does not create fallback cohort drafts before concept sets are materialized', function () {
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/cohorts/draft")
        ->assertStatus(422)
        ->assertJsonPath('errors.cohorts.0', 'Materialized, verified concept set drafts are required before Abby can compile cohort drafts.');

    $this->assertDatabaseMissing('study_design_assets', [
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'cohort_draft',
    ]);
});

it('blocks incomplete cohort drafts and accepts Abby repair patches before materialization', function () {
    seedStudyDesignVocabularyConcept(201826);
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);

    $conceptSet = ConceptSet::create([
        'name' => 'Repairable hypertension concept set',
        'description' => 'Concept set used by repair test.',
        'expression_json' => ['items' => [['concept_id' => 201826]]],
        'author_id' => $this->user->id,
        'is_public' => false,
        'tags' => ['study-designer'],
    ]);
    $conceptSet->items()->create([
        'concept_id' => 201826,
        'is_excluded' => false,
        'include_descendants' => true,
        'include_mapped' => false,
    ]);

    $sourceAsset = StudyDesignAsset::create([
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'concept_set_draft',
        'role' => 'target',
        'status' => 'materialized',
        'verification_status' => 'verified',
        'verified_at' => now(),
        'draft_payload_json' => ['title' => 'Repairable hypertension concept set', 'role' => 'target'],
        'materialized_type' => ConceptSet::class,
        'materialized_id' => $conceptSet->id,
        'materialized_at' => now(),
    ]);

    $cohortAsset = StudyDesignAsset::create([
        'session_id' => $sessionId,
        'version_id' => $versionId,
        'asset_type' => 'cohort_draft',
        'role' => 'target',
        'status' => 'needs_review',
        'verification_status' => 'unverified',
        'draft_payload_json' => [
            'title' => 'Repairable target cohort',
            'role' => 'target',
            'logic_description' => 'Intentionally missing primary criteria.',
            'concept_set_ids' => [$conceptSet->id],
            'concept_set_asset_ids' => [$sourceAsset->id],
            'source_asset_ids' => [$sourceAsset->id],
            'expression_json' => [
                'ConceptSets' => [[
                    'id' => 0,
                    'name' => $conceptSet->name,
                    'expression' => [
                        'items' => [[
                            'concept' => [
                                'CONCEPT_ID' => 201826,
                                'DOMAIN_ID' => 'Condition',
                            ],
                            'isExcluded' => false,
                            'includeDescendants' => true,
                            'includeMapped' => false,
                        ]],
                    ],
                ]],
                'PrimaryCriteria' => ['CriteriaList' => []],
            ],
        ],
        'provenance_json' => ['source' => 'test_incomplete_cohort_draft'],
    ]);

    $patch = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAsset->id}/cohorts/verify")
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'blocked')
        ->assertJsonPath('data.verification_json.checks.has_primary_criteria', false)
        ->assertJsonPath('data.verification_json.repair_suggestions.0.code', 'add_primary_criteria')
        ->json('data.verification_json.repair_suggestions.0.patch');

    $this->actingAs($this->user)
        ->putJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAsset->id}/cohorts/draft", array_merge($cohortAsset->draft_payload_json, $patch))
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'unverified');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$cohortAsset->id}/cohorts/verify")
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'verified')
        ->assertJsonPath('data.verification_json.checks.has_primary_criteria', true);
});

it('blocks feasibility until required cohorts are linked and preserves rerun thresholds', function () {
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);
    $source = createStudyDesignFeasibilitySource();

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
            'min_cell_count' => 11,
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Required study cohorts must be linked before source feasibility can run.')
        ->assertJsonPath('data.cohorts.ready_for_feasibility', false)
        ->assertJsonPath('data.cohorts.blockers.0.code', 'missing_target_cohort');

    expect(StudyDesignAsset::where('session_id', $sessionId)
        ->where('version_id', $versionId)
        ->where('asset_type', 'feasibility_result')
        ->count())->toBe(0);

    $cohort = CohortDefinition::create([
        'name' => 'Runnable Target Cohort',
        'description' => 'A target cohort for feasibility rerun tests.',
        'expression_json' => ['ConceptSets' => [1]],
        'author_id' => $this->user->id,
        'is_public' => false,
    ]);
    StudyCohort::create([
        'study_id' => $this->study->id,
        'cohort_definition_id' => $cohort->id,
        'role' => 'target',
        'label' => 'Runnable target cohort',
        'concept_set_ids' => [1],
        'sort_order' => 0,
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
            'min_cell_count' => 11,
        ])
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'blocked')
        ->assertJsonPath('data.draft_payload_json.min_cell_count', 11)
        ->assertJsonPath('data.provenance_json.min_cell_count', 11)
        ->assertJsonPath('result.status', 'blocked')
        ->assertJsonPath('result.blockers.0.code', 'missing_cohort_generation')
        ->assertJsonPath('result.blockers.0.action.type', 'generate_cohort_on_source')
        ->assertJsonPath('result.blockers.0.action.source_id', $source->id)
        ->assertJsonPath('result.action_targets.0.type', 'generate_cohort_on_source');

    CohortGeneration::create([
        'cohort_definition_id' => $cohort->id,
        'source_id' => $source->id,
        'status' => ExecutionStatus::Completed->value,
        'started_at' => now()->subMinutes(3),
        'completed_at' => now(),
        'person_count' => 50,
    ]);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
            'min_cell_count' => 7,
        ])
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'verified')
        ->assertJsonPath('data.draft_payload_json.min_cell_count', 7)
        ->assertJsonPath('data.provenance_json.min_cell_count', 7)
        ->assertJsonPath('result.status', 'ready')
        ->assertJsonPath('result.previous_run.status', 'blocked')
        ->assertJsonPath('result.previous_run.min_cell_count', 11)
        ->assertJsonPath('result.previous_run.threshold_changed', true);
});

it('blocks analysis plan acceptance for missing HADES packages and materializes verified plans', function () {
    [$sessionId, $versionId] = createStudyDesignSessionAndVersion($this);
    $cohorts = collect(['target', 'comparator', 'outcome'])
        ->mapWithKeys(function (string $role): array {
            $cohort = CohortDefinition::create([
                'name' => ucfirst($role).' Analysis Cohort',
                'description' => "A {$role} cohort for analysis plan tests.",
                'expression_json' => ['ConceptSets' => [1]],
                'author_id' => $this->user->id,
                'is_public' => false,
            ]);
            StudyCohort::create([
                'study_id' => $this->study->id,
                'cohort_definition_id' => $cohort->id,
                'role' => $role,
                'label' => ucfirst($role).' analysis cohort',
                'concept_set_ids' => [1],
                'sort_order' => $role === 'target' ? 0 : ($role === 'comparator' ? 1 : 2),
            ]);

            return [$role => $cohort];
        });
    $source = createStudyDesignFeasibilitySource($cohorts->pluck('id')->all());
    foreach (['condition_occurrence', 'drug_exposure', 'procedure_occurrence', 'measurement', 'observation', 'death'] as $index => $tableName) {
        DB::table("cdm.{$tableName}")->insert(['id' => $index + 1]);
    }

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
            'min_cell_count' => 5,
        ])
        ->assertCreated()
        ->assertJsonPath('data.verification_status', 'verified')
        ->assertJsonPath('result.status', 'ready');

    Http::fake([
        '*/hades/packages' => Http::sequence()
            ->push([
                'status' => 'ready',
                'packages' => [
                    ['package' => 'Characterization', 'installed' => true, 'version' => '1.0.0'],
                    ['package' => 'CohortMethod', 'installed' => false, 'version' => null],
                ],
            ])
            ->push([
                'status' => 'ready',
                'packages' => [
                    ['package' => 'Characterization', 'installed' => true, 'version' => '1.0.0'],
                    ['package' => 'CohortMethod', 'installed' => false, 'version' => null],
                ],
            ])
            ->push([
                'status' => 'ready',
                'packages' => [
                    ['package' => 'CohortMethod', 'installed' => true, 'version' => '6.0.0'],
                ],
            ]),
    ]);

    $assetId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/analysis-plans/draft", [
            'analysis_types' => ['estimation'],
        ])
        ->assertCreated()
        ->assertJsonPath('data.0.asset_type', 'analysis_plan')
        ->assertJsonPath('data.0.verification_status', 'blocked')
        ->assertJsonPath('data.0.draft_payload_json.analysis_family.id', 'estimation')
        ->assertJsonPath('data.0.draft_payload_json.analysis_family.recommended', true)
        ->assertJsonPath('data.0.draft_payload_json.parameter_review.0.name', 'target_cohort')
        ->assertJsonPath('data.0.draft_payload_json.hades_capability.installed', false)
        ->assertJsonPath('data.0.draft_payload_json.hades_remediation.action.type', 'install_hades_package')
        ->assertJsonPath('data.0.draft_payload_json.blockers.0.code', 'missing_hades_package')
        ->assertJsonPath('data.0.draft_payload_json.blockers.0.action.type', 'install_hades_package')
        ->json('data.0.id');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/review", [
            'decision' => 'accept',
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Only deterministically verified Study Design assets can be accepted.');

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/analysis-plans/materialize")
        ->assertStatus(422)
        ->assertJsonValidationErrors(['verification']);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/analysis-plans/verify")
        ->assertOk()
        ->assertJsonPath('data.verification_status', 'verified')
        ->assertJsonPath('data.draft_payload_json.hades_capability.installed', true)
        ->assertJsonPath('data.draft_payload_json.hades_remediation', null)
        ->assertJsonPath('data.verification_json.eligibility.can_accept', true);

    $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/review", [
            'decision' => 'accept',
            'review_notes' => 'HADES package verified and parameters reviewed.',
        ])
        ->assertOk()
        ->assertJsonPath('data.status', 'accepted');

    $materializedId = $this->actingAs($this->user)
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/assets/{$assetId}/analysis-plans/materialize")
        ->assertCreated()
        ->assertJsonPath('data.status', 'materialized')
        ->assertJsonPath('data.materialized_type', EstimationAnalysis::class)
        ->json('materialized.analysis.id');

    $this->assertDatabaseHas('estimation_analyses', [
        'id' => $materializedId,
        'author_id' => $this->user->id,
    ]);
    $this->assertDatabaseHas('study_analyses', [
        'study_id' => $this->study->id,
        'analysis_type' => EstimationAnalysis::class,
        'analysis_id' => $materializedId,
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
    $source = createStudyDesignFeasibilitySource();

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
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
        ])
        ->assertStatus(422)
        ->assertJsonPath('message', 'Required study cohorts must be linked before source feasibility can run.')
        ->assertJsonPath('data.cohorts.ready_for_feasibility', false)
        ->assertJsonPath('data.cohorts.blockers.0.code', 'deprecated_cohort_definitions');

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
    $source = createStudyDesignFeasibilitySource([$cohort->id]);

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
        ->postJson("/api/v1/studies/{$this->study->slug}/design-sessions/{$sessionId}/versions/{$versionId}/feasibility/run", [
            'source_ids' => [$source->id],
        ])
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
