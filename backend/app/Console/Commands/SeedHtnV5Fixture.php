<?php

namespace App\Console\Commands;

use App\Concerns\SourceAware;
use App\Context\SourceContext;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyResult;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Seeds a representative, clearly-labelled demonstration fixture for the
 * Hypertension Outcomes Program **v5** so the frontend surfacing layer
 * (per-analysis renderers + the v5 Report tab) has data to display.
 *
 * The full v5 executor (analyses M–R + triangulation from CLAUDE_PROMPT_v5.md)
 * has not been run — study 165 currently carries only its four v4 results.
 * Rather than block the frontend on a multi-hour causal-inference run, this
 * command populates the two physical surfaces the frontend reads:
 *
 *   1. app.study_results — one curated row per v5 analysis (O, P, R, M, N, Q,
 *      triangulation) with a compact, chart-ready summary_data payload.
 *   2. results.htn_v4_* — the long-form tables behind the "view full matrix"
 *      drawers and CSV exports (comorbidity matrix, BP distribution, phenotype
 *      grid, IV tertile balance, triangulation).
 *
 * Every row is flagged `_fixture: true` and carries `_provenance` so the UI can
 * render an explicit "demonstration data" banner. The numbers are grounded in
 * the real v4 baseline facts recorded in CHANGELOG_v4_to_v5.md (T = 109,763;
 * never-diagnosed ≈ 90%; latency_b ≈ 1,106 d; CKD HR ≈ 2.60; 37.9% encounter
 * coverage) so the demonstration is realistic — but it is NOT a real v5 result
 * and must never be presented as one.
 *
 * Idempotent: re-running replaces its own fixture rows and truncates the
 * fixture tables. Additive only — it writes to app.* and results.* and never
 * touches CDM (omop / vocab) data.
 */
class SeedHtnV5Fixture extends Command
{
    use SourceAware;

    protected $signature = 'study:seed-htn-v5-fixture
        {--study=165 : Study id to attach the v5 fixture to}
        {--source=ACUMENUS : Source key whose results schema holds the long-form tables}
        {--dry-run : Report what would be written without persisting}
        {--force : Skip the confirmation prompt}';

    protected $description = 'Seed a representative (non-production) v5 result fixture for the Hypertension study so the frontend surfacing layer has data to render';

    private const PROVENANCE = 'Representative demonstration fixture — grounded in v4 baseline facts (CHANGELOG_v4_to_v5.md), NOT a real v5 execution. Do not present as a study finding.';

    /** result_types this fixture owns; used for idempotent cleanup. */
    private const V5_RESULT_TYPES = [
        'overlap_weighted_effect',
        'target_trial',
        'instrumental_variable',
        'comorbidity_matrix',
        'bp_distribution',
        'phenotype_robustness',
        'triangulation',
    ];

    public function handle(): int
    {
        $studyId = (int) $this->option('study');
        $dryRun = (bool) $this->option('dry-run');

        $study = Study::find($studyId);
        if (! $study instanceof Study) {
            $this->error("Study {$studyId} not found.");

            return self::FAILURE;
        }

        $this->info("Seeding v5 demonstration fixture for study {$studyId} ({$study->slug}).");
        $this->warn('This is REPRESENTATIVE, non-production data. Rows are flagged _fixture:true.');

        // Resolve existing analyses to attach the curated rows to. The v5
        // analyses (M–R) have no analysis records of their own, so we hang the
        // projected rows off the study's existing analyses; the (study, analysis,
        // result_type) key stays unique because the v5 result_types are new.
        $analyses = StudyAnalysis::query()
            ->where('study_id', $studyId)
            ->orderBy('id')
            ->get();

        if ($analyses->isEmpty()) {
            $this->error("Study {$studyId} has no analyses to attach results to.");

            return self::FAILURE;
        }

        $descriptiveAnalysisId = $this->firstAnalysisId($analyses, 'Characterization') ?? (int) $analyses->first()->id;
        $estimationIds = $this->estimationAnalysisIds($analyses);
        $estA = $estimationIds[0] ?? (int) $analyses->first()->id;
        $estB = $estimationIds[1] ?? $estA;

        if (! $dryRun && ! $this->option('force') && ! $this->confirm('Write fixture rows now?', true)) {
            $this->line('Aborted.');

            return self::SUCCESS;
        }

        $rows = [
            ['analysis_id' => $estA, 'type' => 'overlap_weighted_effect', 'primary' => true, 'publishable' => true, 'data' => $this->overlapWeighted()],
            ['analysis_id' => $estB, 'type' => 'target_trial', 'primary' => false, 'publishable' => true, 'data' => $this->targetTrial()],
            ['analysis_id' => $estB, 'type' => 'instrumental_variable', 'primary' => false, 'publishable' => false, 'data' => $this->instrumentalVariable()],
            ['analysis_id' => $descriptiveAnalysisId, 'type' => 'comorbidity_matrix', 'primary' => false, 'publishable' => true, 'data' => $this->comorbidityMatrix()],
            ['analysis_id' => $descriptiveAnalysisId, 'type' => 'bp_distribution', 'primary' => false, 'publishable' => true, 'data' => $this->bpDistribution()],
            ['analysis_id' => $descriptiveAnalysisId, 'type' => 'phenotype_robustness', 'primary' => false, 'publishable' => true, 'data' => $this->phenotypeRobustness()],
            ['analysis_id' => $estA, 'type' => 'triangulation', 'primary' => false, 'publishable' => true, 'data' => $this->triangulation()],
        ];

        if ($dryRun) {
            foreach ($rows as $row) {
                $keys = implode(', ', array_keys($row['data']));
                $this->line("  [dry-run] {$row['type']} → analysis {$row['analysis_id']} · summary keys: {$keys}");
            }
            $this->line('  [dry-run] long-form tables: '.implode(', ', array_keys($this->longFormTables())));

            return self::SUCCESS;
        }

        DB::transaction(function () use ($studyId, $rows): void {
            // Idempotent: clear this fixture's own prior rows only.
            StudyResult::query()
                ->where('study_id', $studyId)
                ->whereIn('result_type', self::V5_RESULT_TYPES)
                ->delete();

            foreach ($rows as $row) {
                StudyResult::create([
                    'study_id' => $studyId,
                    'study_analysis_id' => $row['analysis_id'],
                    'result_type' => $row['type'],
                    'summary_data' => $this->stamp($row['data']),
                    'diagnostics' => ['fixture' => true, 'gates' => $row['data']['gates'] ?? null],
                    'is_primary' => $row['primary'],
                    'is_publishable' => $row['publishable'],
                ]);
                $this->line("  ✓ {$row['type']}");
            }
        });

        $source = Source::query()->where('source_key', $this->option('source'))->first();
        if ($source instanceof Source) {
            SourceContext::forSource($source);
            $this->seedLongFormTables();
        } else {
            $this->warn("  ⚠ Source '{$this->option('source')}' not found — skipped long-form tables (study rows still seeded).");
        }

        $this->info('v5 fixture seeded. Reload study 165 → Results tab / v5 Report tab.');

        return self::SUCCESS;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function stamp(array $data): array
    {
        return array_merge(['_fixture' => true, '_provenance' => self::PROVENANCE], $data);
    }

    /**
     * @param  Collection<int, StudyAnalysis>  $analyses
     */
    private function firstAnalysisId(Collection $analyses, string $needle): ?int
    {
        $match = $analyses->first(fn (StudyAnalysis $a): bool => str_contains((string) $a->analysis_type, $needle));

        return $match instanceof StudyAnalysis ? (int) $match->id : null;
    }

    /**
     * @param  Collection<int, StudyAnalysis>  $analyses
     * @return list<int>
     */
    private function estimationAnalysisIds(Collection $analyses): array
    {
        return array_values($analyses
            ->filter(fn (StudyAnalysis $a): bool => str_contains((string) $a->analysis_type, 'Estimation'))
            ->map(fn (StudyAnalysis $a): int => (int) $a->id)
            ->all());
    }

    // ---------------------------------------------------------------------
    // Compact summary_data payloads (Appendix A contracts)
    // ---------------------------------------------------------------------

    /** Analysis O — overlap-weighted (ATO) timely vs delayed initiation. */
    private function overlapWeighted(): array
    {
        return [
            'analysis_code' => 'O',
            'label' => 'Overlap-Weighted (ATO) — Timely vs Delayed Antihypertensive Initiation',
            'estimable' => true,
            'gates' => ['max_smd' => 0.06, 'equipoise' => 0.41, 'null_centered' => true],
            'target_count' => 109763,
            'comparator_count' => 41288,
            'estimates' => [
                ['outcome_name' => 'MACE', 'hazard_ratio' => 0.88, 'ci_95_lower' => 0.79, 'ci_95_upper' => 0.98, 'e_value' => 1.52, 'calibrated_hr' => 0.90, 'cal_ci_lower' => 0.79, 'cal_ci_upper' => 1.02],
                ['outcome_name' => 'CKD progression', 'hazard_ratio' => 0.74, 'ci_95_lower' => 0.66, 'ci_95_upper' => 0.83, 'e_value' => 2.04, 'calibrated_hr' => 0.76, 'cal_ci_lower' => 0.66, 'cal_ci_upper' => 0.88],
            ],
            'risk_difference_5y' => ['mace' => -0.021, 'ckd' => -0.038],
            'gradient' => [
                ['group' => 1, 'label' => 'Q1 (most delayed)', 'hr' => 1.00, 'ci_95_lower' => 1.00, 'ci_95_upper' => 1.00],
                ['group' => 2, 'label' => 'Q2', 'hr' => 0.94, 'ci_95_lower' => 0.85, 'ci_95_upper' => 1.04],
                ['group' => 3, 'label' => 'Q3', 'hr' => 0.86, 'ci_95_lower' => 0.77, 'ci_95_upper' => 0.96],
                ['group' => 4, 'label' => 'Q4 (most timely)', 'hr' => 0.74, 'ci_95_lower' => 0.66, 'ci_95_upper' => 0.83],
            ],
            'balance' => $this->balanceCovariates(),
            'calibration' => ['ease' => 0.09, 'informative_negative_controls' => 48, 'null_mean' => 0.01, 'null_sd' => 0.21],
        ];
    }

    /** @return list<array{covariate: string, smd_before: float, smd_after: float}> */
    private function balanceCovariates(): array
    {
        $covs = [
            ['Age', 0.31, 0.04], ['Female', 0.18, 0.02], ['Diabetes', 0.27, 0.05],
            ['Prior MI', 0.22, 0.03], ['Heart failure', 0.19, 0.06], ['CKD stage ≥3', 0.34, 0.05],
            ['Statin use', 0.24, 0.03], ['Smoking', 0.16, 0.02], ['Obesity', 0.14, 0.04],
            ['Prior stroke', 0.20, 0.03], ['COPD', 0.12, 0.02], ['Atrial fibrillation', 0.17, 0.05],
            ['Baseline SBP', 0.29, 0.06], ['eGFR', 0.33, 0.04], ['Charlson index', 0.36, 0.05],
        ];

        return array_map(
            fn (array $c): array => ['covariate' => $c[0], 'smd_before' => $c[1], 'smd_after' => $c[2]],
            $covs,
        );
    }

    /** Analysis P — target-trial emulation (clone-censor-weight, IPCW). */
    private function targetTrial(): array
    {
        return [
            'analysis_code' => 'P',
            'label' => 'Target-Trial Emulation — Per-Protocol (90-day grace)',
            'grace_days' => 90,
            'immortal_time_check' => 'PASS',
            'estimates' => [
                ['outcome_name' => 'MACE', 'hazard_ratio' => 0.86, 'ci_95_lower' => 0.76, 'ci_95_upper' => 0.97, 'risk_diff_5y' => -0.024],
                ['outcome_name' => 'CKD progression', 'hazard_ratio' => 0.72, 'ci_95_lower' => 0.63, 'ci_95_upper' => 0.82, 'risk_diff_5y' => -0.041],
            ],
            'sensitivity' => [
                ['grace_days' => 30, 'outcome_name' => 'MACE', 'hazard_ratio' => 0.89],
                ['grace_days' => 180, 'outcome_name' => 'MACE', 'hazard_ratio' => 0.84],
            ],
            'km' => [
                'timely' => $this->cumulativeIncidence(0.135),
                'delayed' => $this->cumulativeIncidence(0.171),
            ],
            'ipcw' => ['max_stabilized_weight' => 6.8, 'mean_stabilized_weight' => 1.02, 'flag' => false],
        ];
    }

    /** @return list<array{time: int, surv: float, nAtRisk: int, nEvents: int}> cumulative-incidence points. */
    private function cumulativeIncidence(float $fiveYearRisk): array
    {
        $points = [];
        $atRisk = 90000;
        $cumEvents = 0;
        for ($month = 0; $month <= 60; $month += 6) {
            $frac = $fiveYearRisk * ($month / 60) ** 0.85;
            $cumInc = round($frac, 4);
            $events = (int) round($cumInc * 90000) - $cumEvents;
            $cumEvents += max(0, $events);
            $points[] = [
                'time' => $month,
                'surv' => round(1 - $cumInc, 4),
                'nAtRisk' => max(0, $atRisk - $cumEvents),
                'nEvents' => max(0, $events),
            ];
        }

        return $points;
    }

    /** Analysis R — instrumental variable (2SRI; regional prescribing preference). */
    private function instrumentalVariable(): array
    {
        return [
            'analysis_code' => 'R',
            'label' => 'Instrumental Variable (2SRI) — Regional Prescribing Preference',
            'first_stage_f' => 14.2,
            'interpretable' => true,
            'n_sites' => 521,
            'coverage_pct' => 37.9,
            'nc_on_instrument_null' => true,
            'late' => [
                ['outcome_name' => 'MACE', 'estimate' => 0.83, 'ci_95_lower' => 0.68, 'ci_95_upper' => 1.01],
                ['outcome_name' => 'CKD progression', 'estimate' => 0.70, 'ci_95_lower' => 0.55, 'ci_95_upper' => 0.89],
            ],
            'tertile_balance' => [
                ['covariate' => 'Age', 't1' => 61.2, 't2' => 61.5, 't3' => 61.1, 'balanced' => true],
                ['covariate' => 'Diabetes %', 't1' => 28.4, 't2' => 28.9, 't3' => 28.1, 'balanced' => true],
                ['covariate' => 'CKD ≥3 %', 't1' => 11.7, 't2' => 12.0, 't3' => 11.5, 'balanced' => true],
                ['covariate' => 'Charlson', 't1' => 2.3, 't2' => 2.4, 't3' => 2.3, 'balanced' => true],
            ],
            'result_table' => 'iv-instrument',
        ];
    }

    /** Analysis M — comorbidity prevalence matrix (17 morbidities × 6 populations). */
    private function comorbidityMatrix(): array
    {
        $cells = [];
        foreach ($this->comorbidityRows() as $r) {
            $cells[] = [
                'morbidity' => $r['morbidity'],
                'population' => $r['population'],
                'prevalence' => $r['prevalence'],
                'wilson_lo' => $r['wilson_lo'],
                'wilson_hi' => $r['wilson_hi'],
            ];
        }

        return [
            'analysis_code' => 'M',
            'label' => 'Comorbidity Prevalence Matrix',
            'morbidities' => self::MORBIDITIES,
            'populations' => self::POPULATIONS,
            'heatmap' => $cells,
            'result_table' => 'comorbidity-matrix',
        ];
    }

    /** Analysis N — blood-pressure distribution across groups × timepoints. */
    private function bpDistribution(): array
    {
        $summary = [];
        foreach (self::BP_GROUPS as $group) {
            foreach (['t1', 't2', 't_dx'] as $tp) {
                foreach (['SBP', 'DBP'] as $measure) {
                    $base = $measure === 'SBP' ? 148 : 88;
                    $shift = $tp === 't1' ? 0 : ($tp === 't2' ? -4 : -9);
                    $mean = $base + $shift + (crc32($group) % 5) - 2;
                    $summary[] = [
                        'group' => $group,
                        'timepoint' => $tp,
                        'measure' => $measure,
                        'n' => 109763,
                        'mean' => $mean,
                        'sd' => $measure === 'SBP' ? 16.4 : 10.2,
                        'median' => $mean - 1,
                        'q1' => $mean - ($measure === 'SBP' ? 11 : 7),
                        'q3' => $mean + ($measure === 'SBP' ? 11 : 7),
                        'skew' => 0.34,
                        'kurt' => 3.1,
                    ];
                }
            }
        }

        return [
            'analysis_code' => 'N',
            'label' => 'Blood-Pressure Distribution (t1 → t2 → t_dx)',
            'groups' => self::BP_GROUPS,
            'timepoints' => ['t1', 't2', 't_dx'],
            'summary' => $summary,
            'kde' => $this->bpKde(),
            'trellis' => $this->bpTrellis(),
            'below_trigger_fraction' => 0.184,
            'result_table' => 'bp-distribution',
        ];
    }

    /** @return list<array{group: string, timepoint: string, measure: string, points: list<array{0: float, 1: float}>}> */
    private function bpKde(): array
    {
        $out = [];
        foreach (self::BP_GROUPS as $group) {
            foreach (['t1', 't_dx'] as $tp) {
                $center = $tp === 't1' ? 150 : 141;
                $points = [];
                for ($x = 100; $x <= 200; $x += 5) {
                    $z = ($x - $center) / 16.4;
                    $points[] = [$x, round(exp(-0.5 * $z * $z), 4)];
                }
                $out[] = ['group' => $group, 'timepoint' => $tp, 'measure' => 'SBP', 'points' => $points];
            }
        }

        return $out;
    }

    /** @return list<array{group: string, t1: float, t2: float, t_dx: float}> paired-arrow trellis (mean SBP). */
    private function bpTrellis(): array
    {
        $out = [];
        foreach (self::BP_GROUPS as $i => $group) {
            $out[] = ['group' => $group, 't1' => 150 + $i, 't2' => 146 + $i, 't_dx' => 141 + $i];
        }

        return $out;
    }

    /** Analysis Q — phenotype robustness (index-rule × threshold × max-gap grid). */
    private function phenotypeRobustness(): array
    {
        $grid = [];
        foreach (['first-dx', 'two-dx', 'dx+rx'] as $rule) {
            foreach ([1, 2] as $threshold) {
                foreach ([90, 365] as $maxGap) {
                    $neverDx = round(0.90 - (str_contains($rule, 'rx') ? 0.06 : 0) - ($threshold - 1) * 0.03 - ($maxGap === 365 ? 0.02 : 0), 3);
                    $grid[] = [
                        'index_rule' => $rule,
                        'threshold' => $threshold,
                        'max_gap' => $maxGap,
                        'never_dx_fraction' => $neverDx,
                        'n' => 109763,
                        'median_latency' => 1106 - ($threshold - 1) * 90,
                    ];
                }
            }
        }

        return [
            'analysis_code' => 'Q',
            'label' => 'Phenotype Robustness — Never-Diagnosed Fraction',
            'grid' => $grid,
            'visit_split' => [
                'visit_linked' => ['coverage_pct' => 37.9, 'never_dx' => 0.71, 'mace' => 0.089, 'ckd' => 0.142],
                'measurement_only' => ['coverage_pct' => 62.1, 'never_dx' => 0.98, 'mace' => 0.041, 'ckd' => 0.067],
            ],
            'e_values' => ['mace' => 1.52, 'ckd' => 2.04],
            'qba_interval' => [0.70, 0.94],
            'result_table' => 'phenotype-grid',
        ];
    }

    /** Cross-design triangulation of the causal estimate (O / P / R). */
    private function triangulation(): array
    {
        return [
            'analysis_code' => 'Triangulation',
            'label' => 'Cross-Design Triangulation — Timely vs Delayed Initiation',
            'designs' => [
                ['name' => 'O — Overlap-weighted (ATO)', 'code' => 'O', 'hr_mace' => 0.88, 'mace_lo' => 0.79, 'mace_hi' => 0.98, 'hr_ckd' => 0.74, 'ckd_lo' => 0.66, 'ckd_hi' => 0.83, 'estimable' => true, 'gate_status' => 'cleared'],
                ['name' => 'P — Target-trial emulation', 'code' => 'P', 'hr_mace' => 0.86, 'mace_lo' => 0.76, 'mace_hi' => 0.97, 'hr_ckd' => 0.72, 'ckd_lo' => 0.63, 'ckd_hi' => 0.82, 'estimable' => true, 'gate_status' => 'cleared'],
                ['name' => 'R — Instrumental variable (2SRI)', 'code' => 'R', 'hr_mace' => 0.83, 'mace_lo' => 0.68, 'mace_hi' => 1.01, 'hr_ckd' => 0.70, 'ckd_lo' => 0.55, 'ckd_hi' => 0.89, 'estimable' => true, 'gate_status' => 'triangulation-only'],
            ],
            'concordance' => 'concordant',
            'most_credible' => 'P',
            'narrative' => 'All three designs point the same direction for both endpoints; the target-trial emulation (P) is the most credible primary basis, with O and R providing concordant support. R is retained for triangulation only.',
        ];
    }

    // ---------------------------------------------------------------------
    // Long-form results.htn_v4_* tables (Layer 2 drawer + CSV)
    // ---------------------------------------------------------------------

    /** @return array<string, string> key → schema-qualified table (documentation + dry-run). */
    private function longFormTables(): array
    {
        return [
            'comorbidity-matrix' => 'results.htn_v4_m_comorbidity_matrix',
            'bp-distribution' => 'results.htn_v4_n_bp_distribution',
            'phenotype-grid' => 'results.htn_v4_q_phenotype_grid',
            'iv-instrument' => 'results.htn_v4_r_instrument',
            'triangulation' => 'results.htn_v4_triangulation',
        ];
    }

    private function longFormTablesExist(Connection $c): bool
    {
        $row = $c->selectOne("select to_regclass('results.htn_v4_triangulation') is not null as ok");

        return (bool) ($row->ok ?? false);
    }

    private function seedLongFormTables(): void
    {
        $c = $this->results();

        // The runtime role (parthenon_app) has no DDL on the results schema, so
        // the tables are pre-created + granted by the owner via
        // scripts/sql/htn-v5-fixture-tables.sql. If they are missing, skip the
        // long-form seed with a clear hint rather than failing the study rows.
        if (! $this->longFormTablesExist($c)) {
            $this->warn('  ⚠ results.htn_v4_* tables missing — run scripts/sql/htn-v5-fixture-tables.sql as the owner first, then re-run to populate the long-form drawers.');

            return;
        }

        foreach (['htn_v4_m_comorbidity_matrix', 'htn_v4_n_bp_distribution', 'htn_v4_q_phenotype_grid', 'htn_v4_r_instrument', 'htn_v4_triangulation'] as $t) {
            $c->statement("TRUNCATE results.{$t}");
        }

        // M — full 17 × 6 matrix with adjusted OR vs control population.
        foreach ($this->comorbidityRows() as $r) {
            $c->table('htn_v4_m_comorbidity_matrix')->insert($r);
        }

        // N — per group × timepoint × measure summary.
        foreach ($this->bpDistribution()['summary'] as $s) {
            $c->table('htn_v4_n_bp_distribution')->insert([
                'grp' => $s['group'], 'timepoint' => $s['timepoint'], 'measure' => $s['measure'],
                'n' => $s['n'], 'mean' => $s['mean'], 'sd' => $s['sd'], 'median' => $s['median'],
                'q1' => $s['q1'], 'q3' => $s['q3'], 'skew' => $s['skew'], 'kurt' => $s['kurt'],
            ]);
        }

        // Q — full grid.
        foreach ($this->phenotypeRobustness()['grid'] as $g) {
            $c->table('htn_v4_q_phenotype_grid')->insert([
                'index_rule' => $g['index_rule'], 'threshold' => $g['threshold'], 'max_gap' => $g['max_gap'],
                'never_dx_fraction' => $g['never_dx_fraction'], 'n' => $g['n'],
                'median_latency' => $g['median_latency'], 'visit_linked' => $g['max_gap'] === 90,
            ]);
        }

        // R — aggregated tertile balance only (never member-grain).
        foreach ($this->instrumentalVariable()['tertile_balance'] as $b) {
            foreach ([1 => 't1', 2 => 't2', 3 => 't3'] as $tertile => $key) {
                $c->table('htn_v4_r_instrument')->insert([
                    'tertile' => $tertile, 'covariate' => $b['covariate'],
                    'mean_value' => $b[$key], 'balanced' => $b['balanced'],
                ]);
            }
        }

        // Triangulation — one row per (design × outcome).
        foreach ($this->triangulation()['designs'] as $d) {
            $c->table('htn_v4_triangulation')->insert([
                'design' => $d['name'], 'outcome' => 'MACE', 'estimate' => $d['hr_mace'],
                'ci_lo' => $d['mace_lo'], 'ci_hi' => $d['mace_hi'], 'estimable' => $d['estimable'], 'gate_status' => $d['gate_status'],
            ]);
            $c->table('htn_v4_triangulation')->insert([
                'design' => $d['name'], 'outcome' => 'CKD progression', 'estimate' => $d['hr_ckd'],
                'ci_lo' => $d['ckd_lo'], 'ci_hi' => $d['ckd_hi'], 'estimable' => $d['estimable'], 'gate_status' => $d['gate_status'],
            ]);
        }

        $this->line('  ✓ long-form results.htn_v4_* tables');
    }

    private const MORBIDITIES = [
        'Diabetes', 'CKD', 'Heart failure', 'Prior MI', 'Prior stroke', 'Atrial fibrillation',
        'COPD', 'Obesity', 'Dyslipidemia', 'Depression', 'Anemia', 'Peripheral arterial disease',
        'Sleep apnea', 'Gout', 'Osteoarthritis', 'Chronic liver disease', 'Dementia',
    ];

    private const POPULATIONS = [
        'All hypertensives', 'Timely initiators', 'Delayed initiators', 'Never-diagnosed', 'Visit-linked', 'Measurement-only',
    ];

    private const BP_GROUPS = ['Timely', 'Delayed', 'Never-diagnosed'];

    /** @return list<array{morbidity: string, population: string, prevalence: float, wilson_lo: float, wilson_hi: float, n_present: int, n_total: int, adjusted_or: float, or_ci_lo: float, or_ci_hi: float}> */
    private function comorbidityRows(): array
    {
        $rows = [];
        foreach (self::MORBIDITIES as $mi => $morbidity) {
            $basePrev = 0.08 + (($mi * 37) % 40) / 100.0; // deterministic 0.08–0.47
            foreach (self::POPULATIONS as $pi => $population) {
                $adj = $pi === 2 ? 0.06 : ($pi === 3 ? -0.03 : ($pi === 1 ? -0.02 : 0));
                $prev = round(max(0.01, min(0.92, $basePrev + $adj + ($pi % 3) * 0.01)), 4);
                $nTotal = 109763;
                $nPresent = (int) round($prev * $nTotal);
                $half = round(1.96 * sqrt($prev * (1 - $prev) / $nTotal), 4);
                $or = $pi === 0 ? 1.00 : round(1.0 + $adj * 6, 2);
                $rows[] = [
                    'morbidity' => $morbidity,
                    'population' => $population,
                    'prevalence' => $prev,
                    'wilson_lo' => round(max(0, $prev - $half), 4),
                    'wilson_hi' => round(min(1, $prev + $half), 4),
                    'n_present' => $nPresent,
                    'n_total' => $nTotal,
                    'adjusted_or' => $or,
                    'or_ci_lo' => round($or * 0.9, 2),
                    'or_ci_hi' => round($or * 1.1, 2),
                ];
            }
        }

        return $rows;
    }
}
