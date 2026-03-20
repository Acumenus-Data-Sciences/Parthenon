<?php

namespace App\Console\Commands;

use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyCohort;
use App\Models\App\StudyMilestone;
use App\Models\App\StudySite;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SeedResearchStudies extends Command
{
    protected $signature = 'parthenon:seed-research-studies
        {--dry-run : Show what would be created without writing to the database}
        {--force : Skip confirmation prompt}';

    protected $description = 'Seed research study configurations: resolve cohort IDs in analysis fixtures, create analysis records, and build Study protocols for S6 (Cardiorenal) and S8 (Opioid)';

    /**
     * Map logical cohort IDs (used in analysis fixture JSON) to cohort definition names.
     * These names must match what was imported by parthenon:import-designs.
     *
     * @var array<string, string>
     */
    private const COHORT_MAP = [
        // Study 6 — Cardiorenal Cascade
        's6-c1' => 'S6: New Prediabetes%',
        's6-c2' => 'S6: Matched Controls%',
        's6-c3' => 'S6: CKD Stage 4%',
        's6-c4' => 'S6: ESRD%',
        's6-c5' => 'S6: Composite MACE%No CHF%',
        's6-c6' => 'S6: Anemia at CKD%',
        's6-c7' => 'S6: Metabolic Syndrome%',
        's6-c8' => 'S6: Essential Hypertension%',
        's6-c9' => 'S6: CKD Stage 1%',
        's6-c10' => 'S6: CKD Stage 2%',
        's6-c11' => 'S6: CKD Stage 3%',
        // Study 7 — Statin Paradox
        's7-c1' => 'S7:%Simvastatin%',
        's7-c2' => 'S7:%Atorvastatin%',
        's7-c3' => 'S7: Composite MACE%With CHF%',
        's7-c4' => 'S7: STEMI%',
        's7-c5' => 'S7: Stroke%',
        's7-c6' => 'S7:%Death%',
        // Study 8 — Opioid Trajectory
        's8-c1' => 'S8: New Opioid Users%',
        's8-c2' => 'S8: Chronic Pain%NSAID%',
        's8-c3' => 'S8: Drug Misuse%',
        's8-c4' => 'S8: Drug Dependence%',
        's8-c5' => 'S8:%Death%',
        's8-c6' => 'S8: MAT Initiation%',
        's8-c7' => 'S8: Naloxone%',
        // Study 9 — Metformin Repurposing
        's9-c1' => 'S9:%New Metformin%',
        's9-c2' => 'S9:%New Insulin%',
        's9-c3' => 'S9: Colorectal%',
        's9-c4' => 'S9: Alzheimer%',
        's9-c5' => 'S9: Composite MACE%',
        's9-c6' => 'S9:%Death%',
        's9-c7' => 'S9:%Breast%',
        // Study 10 — Prediabetes Reversal
        's10-c0' => 'S10: Prediabetes%Base%',
        's10-c1' => 'S10: Prediabetes Escapers%',
        's10-c2' => 'S10: Prediabetes Progressors%',
        's10-c3' => 'S10: Type 2 Diabetes%',
        's10-c4' => 'S10: Metabolic Syndrome%',
        's10-c5' => 'S10: CKD Any Stage%',
    ];

    /**
     * Map fixture subdirectory → analysis model class.
     *
     * @var array<string, class-string<\Illuminate\Database\Eloquent\Model>>
     */
    private const ANALYSIS_MODEL_MAP = [
        'characterizations' => Characterization::class,
        'estimation_analyses' => EstimationAnalysis::class,
        'prediction_analyses' => PredictionAnalysis::class,
        'pathway_analyses' => PathwayAnalysis::class,
        'incidence_rate_analyses' => IncidenceRateAnalysis::class,
        'sccs_analyses' => SccsAnalysis::class,
        'evidence_synthesis_analyses' => EvidenceSynthesisAnalysis::class,
    ];

    public function handle(): int
    {
        $admin = User::where('email', 'admin@acumenus.net')->first();
        if ($admin === null) {
            $this->error('Admin user admin@acumenus.net not found. Run: php artisan admin:seed');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');

        if (! $dryRun && ! $this->option('force')) {
            if (! $this->confirm('This will create/update analysis records and Study protocols. Continue?')) {
                return self::SUCCESS;
            }
        }

        // Step 1: Build cohort ID resolution map
        $this->info('Resolving cohort IDs...');
        $idMap = $this->buildCohortIdMap();
        if ($idMap === null) {
            return self::FAILURE;
        }
        $this->info('  Resolved '.count($idMap).' cohort references');

        try {
            DB::beginTransaction();

            // Step 2: Import analysis fixtures with resolved IDs
            $this->info('Importing analysis fixtures...');
            $analysisRecords = $this->importAnalysisFixtures($idMap, $admin, $dryRun);
            $this->info('  Created/updated '.count($analysisRecords).' analysis records');

            // Step 3: Create Study records
            $this->info('Creating Study protocols...');
            $this->createStudy6($admin, $idMap, $analysisRecords, $dryRun);
            $this->createStudy8($admin, $idMap, $analysisRecords, $dryRun);

            if ($dryRun) {
                DB::rollBack();
                $this->info('[DRY RUN] No changes written.');
            } else {
                DB::commit();
                $this->info('Research studies seeded successfully.');
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error("Seeding failed: {$e->getMessage()}");
            $this->error($e->getTraceAsString());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    /**
     * Build a map of logical cohort IDs (e.g., "s6-c1") to database IDs.
     *
     * @return array<string, int>|null
     */
    private function buildCohortIdMap(): ?array
    {
        $idMap = [];
        $missing = [];

        foreach (self::COHORT_MAP as $logicalId => $namePattern) {
            $cohort = CohortDefinition::where('name', 'LIKE', $namePattern)->first();
            if ($cohort === null) {
                $missing[] = "{$logicalId} => {$namePattern}";
            } else {
                $idMap[$logicalId] = $cohort->id;
                $this->line("  {$logicalId} => {$cohort->id} ({$cohort->name})");
            }
        }

        if (! empty($missing)) {
            $this->error('Missing cohort definitions (run parthenon:import-designs first):');
            foreach ($missing as $m) {
                $this->error("  - {$m}");
            }

            return null;
        }

        return $idMap;
    }

    /**
     * Recursively resolve cohort ID placeholders in a value.
     * Replaces any string matching /^s\d+-c\d+$/ with the integer ID from the map.
     *
     * @param  array<string, int>  $idMap
     */
    private function resolveIds(mixed $value, array $idMap): mixed
    {
        if (is_string($value) && preg_match('/^s\d+-c\d+$/', $value)) {
            if (! isset($idMap[$value])) {
                throw new \RuntimeException("Unresolved cohort reference: {$value}");
            }

            return $idMap[$value];
        }

        if (is_array($value)) {
            return array_map(fn ($v) => $this->resolveIds($v, $idMap), $value);
        }

        return $value;
    }

    /**
     * Import all s*-prefixed analysis fixtures with resolved cohort IDs.
     *
     * @param  array<string, int>  $idMap
     * @return array<string, array{model_class: class-string<\Illuminate\Database\Eloquent\Model>, id: int}> keyed by fixture name
     */
    private function importAnalysisFixtures(array $idMap, User $admin, bool $dryRun): array
    {
        $basePath = config('design_fixtures.path') ?? base_path('database/fixtures/designs');
        $records = [];

        foreach (self::ANALYSIS_MODEL_MAP as $dirName => $modelClass) {
            $dir = $basePath.'/'.$dirName;
            if (! is_dir($dir)) {
                continue;
            }

            foreach (glob($dir.'/s*.json') ?: [] as $file) {
                $raw = file_get_contents($file);
                if ($raw === false) {
                    $this->warn("  Skipping unreadable: {$file}");

                    continue;
                }

                $data = json_decode($raw, true);
                if ($data === null) {
                    $this->warn("  Skipping malformed JSON: {$file}");

                    continue;
                }

                // Resolve cohort IDs in design_json
                if (isset($data['design_json'])) {
                    $data['design_json'] = $this->resolveIds($data['design_json'], $idMap);
                }

                // Strip non-fillable fields
                unset($data['id'], $data['created_at'], $data['updated_at']);

                // Remap author to admin if original author no longer exists
                $authorCol = 'author_id';
                if (isset($data[$authorCol]) && ! User::where('id', $data[$authorCol])->exists()) {
                    $data[$authorCol] = $admin->id;
                }

                $name = $data['name'] ?? basename($file, '.json');

                if (! $dryRun) {
                    $existing = $modelClass::where('name', $name)->first();
                    if ($existing) {
                        $existing->update($data);
                        $record = $existing;
                        $this->line("  Updated: {$name}");
                    } else {
                        $record = $modelClass::create($data);
                        $this->line("  Created: {$name}");
                    }

                    $records[$name] = [
                        'model_class' => $modelClass,
                        'id' => $record->id,
                    ];
                } else {
                    $this->line("  [DRY] Would create/update: {$name}");
                    $records[$name] = [
                        'model_class' => $modelClass,
                        'id' => 0,
                    ];
                }
            }
        }

        return $records;
    }

    /**
     * Find an analysis record by name pattern and return its model class + ID.
     *
     * @param  array<string, array{model_class: class-string<\Illuminate\Database\Eloquent\Model>, id: int}>  $records
     * @return array{model_class: class-string<\Illuminate\Database\Eloquent\Model>, id: int}|null
     */
    private function findAnalysis(array $records, string $namePattern): ?array
    {
        foreach ($records as $name => $info) {
            if (str_contains($name, $namePattern)) {
                return $info;
            }
        }

        return null;
    }

    /**
     * @param  array<string, int>  $idMap
     * @param  array<string, array{model_class: class-string<\Illuminate\Database\Eloquent\Model>, id: int}>  $analysisRecords
     */
    private function createStudy6(User $admin, array $idMap, array $analysisRecords, bool $dryRun): void
    {
        $this->info('  Creating Study 6: Cardiorenal-Metabolic Cascade...');

        if ($dryRun) {
            $this->line('  [DRY] Would create Study + 8 cohorts + 6 analyses + 1 site + 8 milestones');

            return;
        }

        $study = Study::updateOrCreate(
            ['short_title' => 'Cardiorenal Cascade'],
            [
                'title' => 'The Cardiorenal-Metabolic Cascade: A Multi-State Transition Model from Prediabetes to End-Stage Renal Disease',
                'study_type' => 'observational',
                'study_design' => 'cohort',
                'priority' => 'high',
                'status' => 'protocol_development',
                'description' => 'Population-level study examining the temporal cascade from prediabetes through metabolic syndrome, hypertension, and progressive CKD stages to ESRD and cardiovascular death, using multi-state transition modeling in a 1M-patient OMOP CDM database.',
                'scientific_rationale' => 'Cardiorenal-metabolic syndrome is increasingly recognized as a unified disease continuum rather than discrete comorbidities. However, population-level transition probabilities between states remain poorly characterized. The 52,630 patients in this database with documented CKD stage 1→2→3→4 progression provide a rare opportunity to model the full cascade with time-varying covariates, testing whether anemia onset at any CKD stage accelerates progression to the next stage.',
                'hypothesis' => 'Specific transition probabilities exist between prediabetes, metabolic syndrome, hypertension, and CKD stages 1-4 that are modifiable by treatment intensity. Anemia onset at any CKD stage independently accelerates progression to the next stage, with the effect magnitude increasing at higher CKD stages.',
                'primary_objective' => 'Characterize multi-state transition probabilities from prediabetes through the cardiorenal-metabolic cascade and identify modifiable accelerants of disease progression.',
                'secondary_objectives' => [
                    'Quantify the anemia-CKD interaction: does anemia at CKD stage N predict faster transition to stage N+1?',
                    'Build a patient-level prediction model for CKD Stage 4 using baseline features at prediabetes diagnosis',
                    'Map the most common disease progression pathways and their associated 5-year mortality',
                    'Compare MACE incidence rates between the prediabetes cascade cohort and age/sex-matched controls',
                ],
                'study_start_date' => '2026-03-19',
                'protocol_version' => '1.0',
                'funding_source' => 'Acumenus Data Sciences — internal research',
                'tags' => ['cardiorenal', 'ckd-progression', 'metabolic-syndrome', 'multi-state-model', 'prediabetes', 'anemia'],
                'settings' => ['min_cell_count' => 5, 'cdm_version' => '5.4', 'analysis_framework' => 'HADES'],
                'metadata' => [
                    'data_sources' => ['Parthenon OMOP CDM — 1,005,788 patients'],
                    'key_statistics' => [
                        'prediabetes_n' => 394039,
                        'metabolic_syndrome_n' => 200127,
                        'hypertension_n' => 380336,
                        'ckd_full_progression_n' => 52630,
                        'esrd_deaths_n' => 10591,
                        'anemia_prediabetes_comorbid_n' => 315842,
                    ],
                ],
                'created_by' => $admin->id,
                'principal_investigator_id' => $admin->id,
            ]
        );

        // Study Cohorts
        $s6Cohorts = [
            ['logical' => 's6-c1',  'role' => 'target',     'label' => 'Primary study population'],
            ['logical' => 's6-c2',  'role' => 'comparator', 'label' => 'Background rate comparator'],
            ['logical' => 's6-c3',  'role' => 'outcome',    'label' => 'Primary endpoint — CKD Stage 4'],
            ['logical' => 's6-c4',  'role' => 'outcome',    'label' => 'Secondary endpoint — ESRD'],
            ['logical' => 's6-c5',  'role' => 'outcome',    'label' => 'Secondary endpoint — MACE'],
            ['logical' => 's6-c6',  'role' => 'subgroup',   'label' => 'Effect modifier — anemia at CKD'],
            ['logical' => 's6-c7',  'role' => 'event',      'label' => 'Pathway event — metabolic syndrome'],
            ['logical' => 's6-c8',  'role' => 'event',      'label' => 'Pathway event — hypertension'],
        ];

        foreach ($s6Cohorts as $i => $cohort) {
            StudyCohort::updateOrCreate(
                ['study_id' => $study->id, 'cohort_definition_id' => $idMap[$cohort['logical']]],
                [
                    'role' => $cohort['role'],
                    'label' => $cohort['label'],
                    'sort_order' => $i,
                ]
            );
        }

        // Study Analyses
        $s6AnalysisPatterns = [
            'S6: Cardiorenal Cascade — Baseline',
            'S6: CKD Progression Incidence — Prediabetes',
            'S6: CKD Progression Incidence — Anemia',
            'S6: Cardiorenal — Metabolic Cascade',
            'S6: Predict CKD Stage 4',
            'S6: Predict Composite MACE',
        ];

        foreach ($s6AnalysisPatterns as $pattern) {
            $analysis = $this->findAnalysis($analysisRecords, $pattern);
            if ($analysis) {
                StudyAnalysis::updateOrCreate(
                    [
                        'study_id' => $study->id,
                        'analysis_type' => $analysis['model_class'],
                        'analysis_id' => $analysis['id'],
                    ]
                );
            } else {
                $this->warn("  Could not find analysis matching: {$pattern}");
            }
        }

        // Study Site
        $defaultSource = Source::where('is_default', true)->first();
        if ($defaultSource) {
            StudySite::updateOrCreate(
                ['study_id' => $study->id, 'source_id' => $defaultSource->id],
                [
                    'site_role' => 'coordinating_center',
                    'status' => 'irb_approved',
                    'cdm_version' => '5.4',
                    'patient_count_estimate' => 1005788,
                ]
            );
        }

        // Study Milestones
        $s6Milestones = [
            ['title' => 'Protocol finalization',              'type' => 'protocol_finalized',  'date' => '2026-03-25', 'status' => 'in_progress'],
            ['title' => 'Cohort generation & validation',     'type' => 'code_validated',       'date' => '2026-03-28', 'status' => 'pending'],
            ['title' => 'Baseline characterization complete', 'type' => 'custom',               'date' => '2026-04-01', 'status' => 'pending'],
            ['title' => 'Pathway analysis complete',          'type' => 'custom',               'date' => '2026-04-04', 'status' => 'pending'],
            ['title' => 'Incidence rate analyses complete',   'type' => 'custom',               'date' => '2026-04-07', 'status' => 'pending'],
            ['title' => 'PLP model training & validation',    'type' => 'custom',               'date' => '2026-04-14', 'status' => 'pending'],
            ['title' => 'Results review & interpretation',    'type' => 'synthesis_complete',   'date' => '2026-04-21', 'status' => 'pending'],
            ['title' => 'Manuscript draft',                   'type' => 'manuscript_submitted', 'date' => '2026-05-01', 'status' => 'pending'],
        ];

        foreach ($s6Milestones as $i => $milestone) {
            StudyMilestone::updateOrCreate(
                ['study_id' => $study->id, 'title' => $milestone['title']],
                [
                    'milestone_type' => $milestone['type'],
                    'target_date' => $milestone['date'],
                    'status' => $milestone['status'],
                    'sort_order' => $i,
                ]
            );
        }

        $this->info("  Study 6 created: ID {$study->id} with 8 cohorts, 6 analyses, 1 site, 8 milestones");
    }

    /**
     * @param  array<string, int>  $idMap
     * @param  array<string, array{model_class: class-string<\Illuminate\Database\Eloquent\Model>, id: int}>  $analysisRecords
     */
    private function createStudy8(User $admin, array $idMap, array $analysisRecords, bool $dryRun): void
    {
        $this->info('  Creating Study 8: Opioid Trajectory...');

        if ($dryRun) {
            $this->line('  [DRY] Would create Study + 7 cohorts + 7 analyses + 1 site + 10 milestones');

            return;
        }

        $study = Study::updateOrCreate(
            ['short_title' => 'Opioid Trajectory'],
            [
                'slug' => 'opioid-trajectory-prescription-to-substance-use-disorder',
                'title' => 'The Opioid Trajectory: Predicting Transition from Legitimate Prescription to Substance Use Disorder in Chronic Pain Patients',
                'study_type' => 'observational',
                'study_design' => 'cohort',
                'priority' => 'high',
                'status' => 'protocol_development',
                'description' => 'Multi-method OHDSI study examining the clinical trajectory from first opioid prescription in chronic pain patients to substance use disorder, comparing outcomes against NSAID-managed chronic pain controls. Combines pathway analysis, comparative effectiveness estimation, and patient-level prediction to characterize, quantify, and predict the opioid-to-dependence transition in a 1M-patient OMOP CDM database.',
                'scientific_rationale' => "The opioid epidemic's pharmacoepidemiological profile remains incompletely characterized at the population level. Among 192,195 opioid-exposed patients in this database, 10.6% develop documented drug misuse and 9.3% develop dependence, with 6.4% mortality. The availability of 68% AUDIT-C and drug abuse screening coverage, plus 87% depression screening, enables baseline risk stratification using validated instruments rather than diagnosis codes alone. The NSAID-managed chronic pain cohort (207K naproxen + 143K ibuprofen) provides a powerful active comparator that shares the indication (chronic pain) but not the exposure (opioids).",
                'hypothesis' => 'Among opioid-naive chronic pain patients, specific baseline features (depression screening severity, AUDIT-C score, age, concurrent benzodiazepine use) predict transition to drug misuse or dependence within 3 years. Opioid-exposed patients have significantly higher rates of misuse, dependence, and mortality compared to NSAID-managed chronic pain patients after propensity score adjustment.',
                'primary_objective' => 'Estimate the comparative risk of drug misuse, drug dependence, and all-cause mortality between new opioid users and NSAID-managed chronic pain patients using active comparator new-user design with propensity score matching.',
                'secondary_objectives' => [
                    'Build a patient-level prediction model for drug misuse within 3 years of first opioid prescription using baseline clinical, demographic, and screening instrument features',
                    'Map the most common escalation pathways from initial opioid prescription through misuse, dependence, MAT initiation (buprenorphine/methadone), overdose reversal (naloxone), and death',
                    'Characterize baseline clinical profiles of opioid new-users vs. NSAID-managed chronic pain patients to assess residual confounding after PS matching',
                    'Compare gradient boosting vs. LASSO models for dependence prediction to evaluate interpretability-performance tradeoff',
                ],
                'study_start_date' => '2026-03-19',
                'protocol_version' => '1.0',
                'funding_source' => 'Acumenus Data Sciences — internal research',
                'tags' => ['opioid', 'substance-use-disorder', 'chronic-pain', 'drug-safety', 'prediction', 'pharmacoepidemiology'],
                'settings' => ['min_cell_count' => 5, 'cdm_version' => '5.4', 'analysis_framework' => 'HADES'],
                'metadata' => [
                    'data_sources' => ['Parthenon OMOP CDM — 1,005,788 patients'],
                    'key_statistics' => [
                        'opioid_exposed_n' => 192195,
                        'chronic_pain_n' => 247198,
                        'opioid_with_chronic_pain_n' => 126544,
                        'drug_misuse_n' => 84886,
                        'opioid_misuse_n' => 20450,
                        'opioid_dependence_n' => 17926,
                        'opioid_deaths_n' => 12385,
                        'nsaid_chronic_pain_n' => 207484,
                        'depression_screening_coverage' => 0.867,
                        'audit_c_coverage' => 0.680,
                        'drug_abuse_screening_coverage' => 0.684,
                    ],
                ],
                'created_by' => $admin->id,
                'principal_investigator_id' => $admin->id,
            ]
        );

        // Study Cohorts
        $s8Cohorts = [
            ['logical' => 's8-c1', 'role' => 'target',     'label' => 'Primary exposed population'],
            ['logical' => 's8-c2', 'role' => 'comparator', 'label' => 'Active comparator — NSAID'],
            ['logical' => 's8-c3', 'role' => 'outcome',    'label' => 'Primary endpoint — drug misuse'],
            ['logical' => 's8-c4', 'role' => 'outcome',    'label' => 'Secondary endpoint — drug dependence'],
            ['logical' => 's8-c5', 'role' => 'outcome',    'label' => 'Secondary endpoint — mortality'],
            ['logical' => 's8-c6', 'role' => 'event',      'label' => 'MAT pathway event'],
            ['logical' => 's8-c7', 'role' => 'event',      'label' => 'Overdose sentinel event'],
        ];

        foreach ($s8Cohorts as $i => $cohort) {
            StudyCohort::updateOrCreate(
                ['study_id' => $study->id, 'cohort_definition_id' => $idMap[$cohort['logical']]],
                [
                    'role' => $cohort['role'],
                    'label' => $cohort['label'],
                    'sort_order' => $i,
                ]
            );
        }

        // Study Analyses
        $s8AnalysisPatterns = [
            'S8: Opioid Trajectory',
            'S8: Opioid — Prescribing',
            'S8: Opioid vs NSAID — Drug Misuse',
            'S8: Opioid vs NSAID — Drug Dependence',
            'S8: Opioid vs NSAID — All-Cause',
            'S8: Predict Drug Misuse',
            'S8: Predict Drug Dependence',
        ];

        foreach ($s8AnalysisPatterns as $pattern) {
            $analysis = $this->findAnalysis($analysisRecords, $pattern);
            if ($analysis) {
                StudyAnalysis::updateOrCreate(
                    [
                        'study_id' => $study->id,
                        'analysis_type' => $analysis['model_class'],
                        'analysis_id' => $analysis['id'],
                    ]
                );
            } else {
                $this->warn("  Could not find analysis matching: {$pattern}");
            }
        }

        // Study Site (same source as S6)
        $defaultSource = Source::where('is_default', true)->first();
        if ($defaultSource) {
            StudySite::updateOrCreate(
                ['study_id' => $study->id, 'source_id' => $defaultSource->id],
                [
                    'site_role' => 'coordinating_center',
                    'status' => 'irb_approved',
                    'cdm_version' => '5.4',
                    'patient_count_estimate' => 1005788,
                ]
            );
        }

        // Study Milestones
        $s8Milestones = [
            ['title' => 'Protocol finalization',                        'type' => 'protocol_finalized',  'date' => '2026-03-25', 'status' => 'in_progress'],
            ['title' => 'Cohort generation & validation',               'type' => 'code_validated',       'date' => '2026-03-28', 'status' => 'pending'],
            ['title' => 'Baseline characterization & SMD review',       'type' => 'custom',               'date' => '2026-04-01', 'status' => 'pending'],
            ['title' => 'Pathway analysis — escalation trajectories',   'type' => 'custom',               'date' => '2026-04-04', 'status' => 'pending'],
            ['title' => 'CohortMethod estimation (3 outcomes)',         'type' => 'execution_started',    'date' => '2026-04-10', 'status' => 'pending'],
            ['title' => 'PS diagnostics review & sensitivity analyses', 'type' => 'custom',               'date' => '2026-04-14', 'status' => 'pending'],
            ['title' => 'PLP model training (LASSO + GB)',              'type' => 'custom',               'date' => '2026-04-18', 'status' => 'pending'],
            ['title' => 'PLP model validation & comparison',            'type' => 'custom',               'date' => '2026-04-21', 'status' => 'pending'],
            ['title' => 'Results integration & interpretation',         'type' => 'synthesis_complete',   'date' => '2026-04-28', 'status' => 'pending'],
            ['title' => 'Manuscript draft',                             'type' => 'manuscript_submitted', 'date' => '2026-05-10', 'status' => 'pending'],
        ];

        foreach ($s8Milestones as $i => $milestone) {
            StudyMilestone::updateOrCreate(
                ['study_id' => $study->id, 'title' => $milestone['title']],
                [
                    'milestone_type' => $milestone['type'],
                    'target_date' => $milestone['date'],
                    'status' => $milestone['status'],
                    'sort_order' => $i,
                ]
            );
        }

        $this->info("  Study 8 created: ID {$study->id} with 7 cohorts, 7 analyses, 1 site, 10 milestones");
    }
}
