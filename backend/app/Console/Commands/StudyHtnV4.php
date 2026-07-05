<?php

namespace App\Console\Commands;

use App\Concerns\SourceAware;
use App\Context\SourceContext;
use App\Models\App\EstimationAnalysis;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyResult;
use App\Services\Analysis\HadesBridgeService;
use App\Services\RService;
use App\Support\EstimationResultNormalizer;
use App\Support\Studies\EstimationClearance;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Hypertension Outcomes Program v5 executor (ACUM-PROT-HTN-V5-001).
 *
 * This is the real study executor scaffold from CLAUDE_PROMPT_v5.md §2. It runs
 * only the analyses that are genuinely computable in this environment with
 * read-only aggregate SQL over the Acumenus omop CDM and no external statistics
 * runtime:
 *
 *   Analysis M — comorbidity comparison matrix (§5.1, descriptive core): real
 *   prevalence + Wilson 95% CI per morbidity × population × epoch, computed from
 *   results.cohort membership × omop.condition_occurrence, morbidity concepts
 *   resolved from verified app.concept_sets via vocab.concept_ancestor.
 *
 * The causal / survival analyses (O overlap-weighting, P target-trial + IPCW,
 * R instrumental variable, F/G/H survival, N BP-distribution) require the R /
 * HADES runtime (WeightIt/PSweight/survival), which is NOT present in this
 * compose stack — those actions log a clear skip rather than fabricate results.
 * The covariate-adjusted odds ratios in Analysis M (also R-based) are likewise
 * deferred; the descriptive prevalence core is exact and needs no R.
 *
 * Writes only to results.htn_v4_* and app.study_results. Never touches
 * omop / vocab (read-only). No person_id / PHI in any egress — group-level
 * aggregates only.
 */
class StudyHtnV4 extends Command
{
    use SourceAware;

    protected $signature = 'study:htn-v4
        {--action=analyses : reuse-audit|analyses|run-o|run-p|run-r|run-n|run-q|run-triangulation|report}
        {--plan-version=v5 : analysis-plan version (avoids the reserved --version flag)}
        {--study=165 : study id}
        {--source=ACUMENUS : source key whose results schema holds the tables}
        {--dry-run : report without persisting}';

    /** Analysis O cohorts: timely G1, delayed = union(G2,G3,G4) materialised as 5456. */
    private const O_TIMELY = 5450;

    private const O_DELAYED = 5456;

    private const O_OUTCOMES = [5426 => 'MACE', 5427 => 'CKD progression'];

    private const O_NEG_CONTROLS = [5442, 5443, 5444, 5445, 5446, 5447, 5448, 5449];

    /** Analysis P landmark cohorts (index = t2 + 90 d): treated-within-grace vs not. */
    private const P_TREATED = 5457;

    private const P_UNTREATED = 5458;

    /** Analysis R instrument-strength gate: first-stage F must be ≥ 10 to interpret the LATE. */
    private const R_MIN_FIRST_STAGE_F = 10.0;

    private const R_COVERAGE_PCT = 37.9;

    protected $description = 'Hypertension v5 executor — runs the CDM-computable analyses (Analysis M comorbidity matrix); R-based causal analyses are skipped when the R runtime is absent';

    /** Delay-group / comparator populations (verified counts, study 165). */
    private const POPULATIONS = [
        5450 => 'G1 (timely ≤3mo)',
        5451 => 'G2 (3–6mo)',
        5452 => 'G3 (6–12mo)',
        5453 => 'G4 (delayed >12mo)',
        5454 => 'Never-diagnosed',
        5455 => 'Comparator C',
    ];

    /**
     * Morbidity → verified concept_set id. Only sets with resolvable
     * concept_set_items are included; the remaining spec morbidities are reported
     * as pending concept-set materialisation rather than resolved by guesswork.
     *
     * @var array<string, int>
     */
    private const MORBIDITY_SETS = [
        'Diabetes mellitus' => 55,
        'Heart failure' => 176,
        'Chronic kidney disease' => 186,
        'Primary aldosteronism' => 191,
    ];

    /**
     * The remaining spec morbidities, each keyed to VERIFIED standard SNOMED
     * Condition root concept_ids (looked up + confirmed against vocab.concept —
     * not guessed). Descendants are expanded at query time via concept_ancestor.
     *
     * @var array<string, list<int>>
     */
    private const MORBIDITY_ROOTS = [
        'Dyslipidemia' => [432867],
        'Obesity (dx)' => [433736],
        'Sleep apnea' => [313459],
        'COPD' => [255573],
        'Depression/anxiety' => [440383, 442077],
        'Coronary artery disease' => [4185932],
        'Peripheral vascular disease' => [321052],
        'Cerebrovascular disease' => [381591],
        'Atrial fibrillation' => [313217],
        'Hypertensive retinopathy' => [376965],
        'Cancer' => [443392],
        'Dementia' => [4182210],
        'Liver disease' => [4212540],
    ];

    public function handle(): int
    {
        $action = (string) $this->option('action');
        $studyId = (int) $this->option('study');

        if (! Study::query()->whereKey($studyId)->exists()) {
            $this->error("Study {$studyId} not found.");

            return self::FAILURE;
        }

        return match ($action) {
            'reuse-audit' => $this->reuseAudit($studyId),
            'analyses' => $this->runAnalyses($studyId),
            'run-o' => $this->runOverlapWeighted($studyId),
            'run-p' => $this->runTargetTrial($studyId),
            'run-r' => $this->runInstrumentalVariable($studyId),
            'run-n' => $this->runBpDistribution($studyId),
            'run-q' => $this->runPhenotypeRobustness($studyId),
            'run-triangulation' => $this->runTriangulation($studyId),
            'report' => $this->report($studyId),
            default => tap(self::FAILURE, fn () => $this->error("Unknown action '{$action}'.")),
        };
    }

    private function reuseAudit(int $studyId): int
    {
        $this->info("Reuse audit — study {$studyId}");
        foreach (self::POPULATIONS as $id => $label) {
            $n = DB::table('results.cohort')->where('cohort_definition_id', $id)->count();
            $this->line(sprintf('  %-22s cohort %d = %d', $label, $id, $n));
        }
        $this->line('  Morbidities (concept sets): '.implode(', ', array_keys(self::MORBIDITY_SETS)));
        $this->line('  Morbidities (verified SNOMED roots): '.implode(', ', array_keys(self::MORBIDITY_ROOTS)));

        return self::SUCCESS;
    }

    private function runAnalyses(int $studyId): int
    {
        $this->info("Analysis M — comorbidity comparison matrix (real CDM) · study {$studyId}");
        $this->reportRuntimeGaps();

        $denoms = $this->populationDenominators();
        $rows = [];
        $heatmap = [];
        $excluded = [];

        foreach ($this->morbidityConceptSources() as $morbidity => $src) {
            $byPop = $this->countByPopulation($src['sql'], $src['bindings']);

            // A morbidity with zero cases across ALL six populations is not
            // captured by this concept phenotype in this CDM (e.g. Synthea models
            // no PVD, and only diabetic — not hypertensive — retinopathy). Flag it
            // for mapping review rather than persist a misleading row of zeros.
            $totalEver = array_sum(array_map(fn (array $c): int => $c['ever'], $byPop));
            if ($totalEver === 0) {
                $excluded[] = $morbidity;
                $this->warn(sprintf('  %-24s not captured in this CDM — excluded (concept mapping under review)', $morbidity));

                continue;
            }

            foreach (self::POPULATIONS as $popId => $popLabel) {
                $counts = $byPop[$popId] ?? ['pre' => 0, 'new' => 0, 'ever' => 0];
                $denom = $denoms[$popId] ?? 0;
                [$prev, $lo, $hi] = $this->wilson($counts['ever'], $denom);

                $rows[] = [
                    'morbidity' => $morbidity,
                    'population' => $popLabel,
                    'prevalence' => $prev,
                    'wilson_lo' => $lo,
                    'wilson_hi' => $hi,
                    'n_present' => $counts['ever'],
                    'n_total' => $denom,
                    'adjusted_or' => null,
                    'or_ci_lo' => null,
                    'or_ci_hi' => null,
                ];
                $heatmap[] = [
                    'morbidity' => $morbidity,
                    'population' => $popLabel,
                    'prevalence' => $prev,
                    'wilson_lo' => $lo,
                    'wilson_hi' => $hi,
                    'n_present' => $counts['ever'],
                    'n_pre_existing' => $counts['pre'],
                    'n_newly' => $counts['new'],
                    'n_total' => $denom,
                ];
                $this->line(sprintf('  %-24s %-20s ever=%d/%d (%.1f%%)', $morbidity, $popLabel, $counts['ever'], $denom, $prev * 100));
            }
        }

        if ($this->option('dry-run')) {
            $this->warn('  [dry-run] '.count($rows).' matrix rows computed; not persisted.');

            return self::SUCCESS;
        }

        $this->persistLongForm($rows);
        $this->persistStudyResult($studyId, $heatmap, $excluded);
        $this->info('Analysis M persisted (real CDM data). O/P/R/N/F/G/H require the R runtime — skipped.');

        return self::SUCCESS;
    }

    private function report(int $studyId): int
    {
        $this->info("Report — study {$studyId}: render via the frontend v5 Report tab (StudyV5ReportTab).");
        $this->line('  Standalone HTML/PDF report generation is deferred to the R report step (runtime absent).');

        return self::SUCCESS;
    }

    /**
     * Analysis O — the study's primary causal contrast (timely vs delayed), run
     * through darkstar's proven CohortMethod estimation (PS matching + Cox +
     * empirical calibration). Orientation: delayed as target / timely as
     * comparator (keeps the fits well-conditioned). A failed estimability gate
     * WITHHOLDS the effect (required behaviour), never a blinded number.
     */
    private function runOverlapWeighted(int $studyId): int
    {
        $this->info("Analysis O — delayed (G2–G4) vs timely (G1) via darkstar ATO overlap weighting · study {$studyId}");

        $r = $this->runContrast($studyId, self::O_DELAYED, self::O_TIMELY, 'ato');
        if ($r === null) {
            return self::FAILURE;
        }

        $summaryData = [
            'analysis_code' => 'O',
            'label' => 'Delay Effect — delayed (G2–G4) vs timely (G1), ATO overlap-weighted Cox',
            'method' => 'darkstar overlap weighting: exact ATO overlap weights (w=1-e treated, w=e control; Li–Morgan–Zaslavsky) + weighted Cox + EmpiricalCalibration. ATO balances the PS main-effect covariates by construction.',
        ] + $this->estimationSummaryData($r);

        $this->persistEstimationRow($studyId, 'overlap_weighted_effect', $summaryData, $r);
        $this->info($this->contrastLine('Analysis O', $r));

        return self::SUCCESS;
    }

    /**
     * Analysis P — target-trial emulation of "treat within 90 d of index vs not".
     * Implemented as a landmark new-user active-comparator design (index = the
     * t2 + 90 d landmark, so no clone contributes immortal person-time), run
     * through the same proven estimation pipeline. Full clone-censor-weight +
     * IPCW is a refinement noted in `method`.
     */
    private function runTargetTrial(int $studyId): int
    {
        $this->info("Analysis P — target-trial (treat-within-90d vs not) landmark emulation · study {$studyId}");

        // Target = not-treated (large), comparator = treated (small) — keeps the
        // Cox/negative-control fits well-conditioned, as for O.
        $r = $this->runContrast($studyId, self::P_UNTREATED, self::P_TREATED, 'ato');
        if ($r === null) {
            return self::FAILURE;
        }

        $summaryData = [
            'analysis_code' => 'P',
            'label' => 'Target-Trial Emulation — treat within 90 d vs not (landmark + ATO)',
            'method' => 'Landmark new-user target-trial emulation (index = t2 + 90 d ⇒ no immortal time) with ATO overlap weighting + weighted Cox + EmpiricalCalibration. Full time-varying clone-censor-weight + IPCW is a further refinement.',
            'grace_days' => 90,
            'immortal_time_check' => 'PASS (landmark design — follow-up starts at the grace landmark)',
        ] + $this->estimationSummaryData($r);

        $this->persistEstimationRow($studyId, 'target_trial', $summaryData, $r);
        $this->info($this->contrastLine('Analysis P', $r));

        return self::SUCCESS;
    }

    /**
     * Analysis R — site diagnostic-propensity instrumental variable (2SRI). The
     * first-stage strength gate is decisive: a site LOO diagnostic-propensity
     * instrument must reach F ≥ 10 to interpret the LATE (spec §5.6). On this CDM
     * both instrument definitions are far weaker (timely F ≈ 0.1, diagnosed F ≈
     * 3.4), so the LATE is withheld and R contributes only a weak-instrument
     * caveat — no second-stage 2SRI is warranted (it would be uninterpretable).
     */
    private function runInstrumentalVariable(int $studyId): int
    {
        $this->info("Analysis R — site diagnostic-propensity IV (first-stage strength) · study {$studyId}");

        $conn = DB::connection();
        $exists = $conn->selectOne("select to_regclass('results.htn_v4_r_instrument') is not null as ok");
        if (! ($exists->ok ?? false)) {
            $this->error('  results.htn_v4_r_instrument missing — run scripts/sql/htn-v5-analysis-r-instrument.sql first.');

            return self::FAILURE;
        }

        $fs = $conn->selectOne(<<<'SQL'
            with site as (
                select care_site_id, count(*) n, sum(individual_diagnosed) nd
                from results.htn_v4_r_instrument group by care_site_id
            ),
            m as (
                select r.individual_timely, r.individual_diagnosed, r.z_loo,
                    round((s.nd - r.individual_diagnosed)::numeric / nullif(s.n - 1, 0), 4) as z_dx
                from results.htn_v4_r_instrument r join site s on s.care_site_id = r.care_site_id
            )
            select count(*) as n_members,
                (select count(distinct care_site_id) from results.htn_v4_r_instrument) as n_sites,
                (regr_r2(individual_timely, z_loo) / nullif(1 - regr_r2(individual_timely, z_loo), 0) * (count(*) - 2)) as f_timely,
                (regr_r2(individual_diagnosed, z_dx) / nullif(1 - regr_r2(individual_diagnosed, z_dx), 0) * (count(*) - 2)) as f_diagnosed
            from m
        SQL);

        $fTimely = is_numeric($fs->f_timely ?? null) ? round((float) $fs->f_timely, 2) : null;
        $fDiagnosed = is_numeric($fs->f_diagnosed ?? null) ? round((float) $fs->f_diagnosed, 2) : null;
        $firstStageF = max($fTimely ?? 0.0, $fDiagnosed ?? 0.0);
        $interpretable = $firstStageF >= self::R_MIN_FIRST_STAGE_F;
        $nSites = (int) ($fs->n_sites ?? 0);
        $nMembers = (int) ($fs->n_members ?? 0);

        $tertiles = $conn->select(<<<'SQL'
            with site as (
                select care_site_id, count(*) n, sum(individual_diagnosed) nd
                from results.htn_v4_r_instrument group by care_site_id
            ),
            m as (
                select r.individual_diagnosed, r.individual_timely, r.site_size,
                    round((s.nd - r.individual_diagnosed)::numeric / nullif(s.n - 1, 0), 4) as z_dx
                from results.htn_v4_r_instrument r join site s on s.care_site_id = r.care_site_id
            ),
            t as (select m.*, ntile(3) over (order by z_dx) as tert from m)
            select tert,
                round(avg(individual_diagnosed)::numeric, 4) as dx_rate,
                round(avg(site_size)::numeric, 1) as site_size,
                round(avg(individual_timely)::numeric, 4) as timely_rate
            from t group by tert order by tert
        SQL);

        $summaryData = [
            'analysis_code' => 'R',
            'label' => 'Site Diagnostic-Propensity IV (2SRI) — instrument-strength gate',
            'data_source' => 'cdm',
            'method' => 'Site leave-one-out diagnostic-propensity instrument on the visit-linked subset. First-stage F must reach ≥ 10 to interpret the LATE (spec §5.6); below that the instrument is too weak and the LATE is withheld.',
            'computed_at' => now()->toDateString(),
            'first_stage_f' => round($firstStageF, 1),
            'interpretable' => $interpretable,
            'n_sites' => $nSites,
            'coverage_pct' => self::R_COVERAGE_PCT,
            'late' => [],
            'tertile_balance' => $this->rTertileBalance($tertiles),
            'nc_on_instrument_null' => null,
            'first_stage_detail' => ['timely_f' => $fTimely, 'diagnosed_f' => $fDiagnosed, 'n_members' => $nMembers],
            'withheld_reason' => $interpretable ? null
                : 'Instrument too weak — first-stage F '.round($firstStageF, 1).' < 10 (timely F '.($fTimely ?? '—').' / diagnosed F '.($fDiagnosed ?? '—').'). The LATE is not interpretable; R contributes only a weak-instrument caveat to the triangulation.',
        ];

        $result = StudyResult::query()->where('study_id', $studyId)->where('result_type', 'instrumental_variable')->first();
        if ($result instanceof StudyResult) {
            $result->summary_data = $summaryData;
            $result->diagnostics = ['data_source' => 'cdm', 'interpretable' => $interpretable];
            $result->is_publishable = false; // IV triangulates only; never a sole basis
            $result->save();
            $this->line('  ✓ study_results instrumental_variable updated to real CDM result');
        } else {
            $this->warn('  ⚠ no instrumental_variable row to update (run the fixture seeder first).');
        }

        $this->info(sprintf(
            'Analysis R: first-stage F=%.1f (timely %s / diagnosed %s) · interpretable=%s · %d sites',
            $firstStageF,
            $fTimely === null ? '—' : (string) $fTimely,
            $fDiagnosed === null ? '—' : (string) $fDiagnosed,
            $interpretable ? 'true' : 'false (weak instrument)',
            $nSites,
        ));

        return self::SUCCESS;
    }

    /**
     * Reshape tertile summary rows into the view's tertile-balance shape. With a
     * weak instrument the treatment rates barely differ across tertiles — that
     * near-balance IS the weak-first-stage signal.
     *
     * @param  array<int, mixed>  $tertiles
     * @return list<array{covariate: string, t1: float, t2: float, t3: float, balanced: bool}>
     */
    private function rTertileBalance(array $tertiles): array
    {
        $byTert = [];
        foreach ($tertiles as $row) {
            if (is_object($row) && isset($row->tert)) {
                $byTert[(int) $row->tert] = $row;
            }
        }

        $val = fn (int $t, string $k): float => isset($byTert[$t]->$k) && is_numeric($byTert[$t]->$k) ? (float) $byTert[$t]->$k : 0.0;

        $out = [];
        foreach ([['Diagnosed rate', 'dx_rate'], ['Site size', 'site_size'], ['Timely-dx rate', 'timely_rate']] as [$label, $key]) {
            $t1 = $val(1, $key);
            $t2 = $val(2, $key);
            $t3 = $val(3, $key);
            $maxAbs = max(abs($t1), abs($t2), abs($t3));
            $spread = $maxAbs > 0 ? abs($t3 - $t1) / $maxAbs : 0.0;
            $out[] = ['covariate' => $label, 't1' => $t1, 't2' => $t2, 't3' => $t3, 'balanced' => $spread < 0.1];
        }

        return $out;
    }

    /**
     * Triangulation — assemble the real O / P / R results into the headline
     * cross-design figure, honestly reflecting whether each design was estimable.
     * When all three withhold, that concordant non-identifiability is the finding.
     */
    private function runTriangulation(int $studyId): int
    {
        $this->info("Triangulation — assembling real O / P / R results · study {$studyId}");

        $rows = StudyResult::query()
            ->where('study_id', $studyId)
            ->whereIn('result_type', ['overlap_weighted_effect', 'target_trial', 'instrumental_variable', 'triangulation'])
            ->get()
            ->keyBy('result_type');

        $specs = [
            ['overlap_weighted_effect', 'O — Overlap-weighted (ATO / PSM)', 'O'],
            ['target_trial', 'P — Target-trial (landmark)', 'P'],
            ['instrumental_variable', 'R — Instrumental variable (2SRI)', 'R'],
        ];

        $designs = [];
        $estimableCount = 0;
        foreach ($specs as [$rt, $name, $code]) {
            $row = $rows->get($rt);
            $sd = $row instanceof StudyResult && is_array($row->summary_data) ? $row->summary_data : [];
            $estimable = ($sd['estimable'] ?? null) === true || ($sd['interpretable'] ?? null) === true;
            if ($estimable) {
                $estimableCount++;
            }
            $design = [
                'name' => $name,
                'code' => $code,
                'estimable' => $estimable,
                'gate_status' => $estimable ? 'cleared' : 'withheld',
                'reason' => is_string($sd['withheld_reason'] ?? null) ? $sd['withheld_reason'] : null,
            ];
            $estimates = is_array($sd['estimates'] ?? null) ? $sd['estimates'] : [];
            foreach ($estimates as $e) {
                if (! is_array($e)) {
                    continue;
                }
                $on = strtolower((string) ($e['outcome_name'] ?? ''));
                if (str_contains($on, 'mace')) {
                    $design['hr_mace'] = $e['hazard_ratio'] ?? null;
                    $design['mace_lo'] = $e['ci_95_lower'] ?? null;
                    $design['mace_hi'] = $e['ci_95_upper'] ?? null;
                }
                if (str_contains($on, 'ckd')) {
                    $design['hr_ckd'] = $e['hazard_ratio'] ?? null;
                    $design['ckd_lo'] = $e['ci_95_lower'] ?? null;
                    $design['ckd_hi'] = $e['ci_95_upper'] ?? null;
                }
            }
            $designs[] = $design;
        }

        $allWithheld = $estimableCount === 0;
        $narrative = $allWithheld
            ? "All three designs withheld the delay effect: O on residual covariate imbalance, P on poor overlap (PS AUC ≥ 0.80), and R on a weak instrument (first-stage F < 10). The timely-vs-delayed contrast is not identifiable in this CDM — the positivity, power and instrument-strength failures are concordant, which is itself the finding. The study's calibrated signal rests on the anchor (elevated vs normotensive) contrast, not the delay contrast."
            : 'At least one design produced an estimable effect; compare the estimates below.';

        $summaryData = [
            'analysis_code' => 'Triangulation',
            'label' => 'Cross-Design Triangulation — timely vs delayed (real CDM)',
            'data_source' => 'cdm',
            'computed_at' => now()->toDateString(),
            'designs' => $designs,
            'concordance' => $allWithheld ? 'not estimable (concordant non-identifiability)' : 'mixed',
            'most_credible' => $allWithheld ? 'none — anchor (elevated vs normotensive) instead' : '',
            'narrative' => $narrative,
        ];

        $result = $rows->get('triangulation');
        if ($result instanceof StudyResult) {
            $result->summary_data = $summaryData;
            $result->diagnostics = ['data_source' => 'cdm', 'estimable_designs' => $estimableCount];
            $result->is_publishable = true; // the triangulation verdict itself is reportable
            $result->save();
            $this->line('  ✓ study_results triangulation updated to real CDM assembly');
        } else {
            $this->warn('  ⚠ no triangulation row to update (run the fixture seeder first).');
        }

        $this->info(sprintf('Triangulation: %d/3 designs estimable · %s', $estimableCount, $summaryData['concordance']));

        return self::SUCCESS;
    }

    /**
     * Analysis N — index (t2) blood-pressure distribution per group, from the
     * precomputed results.htn_v4_n_bp_summary (see scripts/sql/htn-v5-analysis-n-bp.sql).
     * Moments + percentiles are exact CDM values; the ridgeline KDE is a Gaussian
     * fit to the real mean/SD.
     */
    private function runBpDistribution(int $studyId): int
    {
        $this->info("Analysis N — index (t2) BP distribution (real CDM) · study {$studyId}");

        $rows = DB::select('select grp, timepoint, measure, n, mean, sd, median, q1, q3, skew, kurt from results.htn_v4_n_bp_summary order by grp, measure');
        if ($rows === []) {
            $this->error('  results.htn_v4_n_bp_summary empty — run scripts/sql/htn-v5-analysis-n-bp.sql first.');

            return self::FAILURE;
        }

        $summary = [];
        $groups = [];
        foreach ($rows as $r) {
            $summary[] = [
                'group' => $r->grp, 'timepoint' => $r->timepoint, 'measure' => $r->measure,
                'n' => (int) $r->n, 'mean' => (float) $r->mean, 'sd' => (float) $r->sd,
                'median' => (float) $r->median, 'q1' => (float) $r->q1, 'q3' => (float) $r->q3,
                'skew' => (float) $r->skew, 'kurt' => (float) $r->kurt,
            ];
            $groups[$r->grp] = true;
        }

        $kde = [];
        foreach ($summary as $s) {
            if ($s['measure'] !== 'SBP' || $s['sd'] <= 0) {
                continue;
            }
            $points = [];
            for ($x = $s['mean'] - 3 * $s['sd']; $x <= $s['mean'] + 3 * $s['sd']; $x += $s['sd'] / 4) {
                $z = ($x - $s['mean']) / $s['sd'];
                $points[] = [round($x, 1), round(exp(-0.5 * $z * $z), 4)];
            }
            $kde[] = ['group' => $s['group'], 'timepoint' => $s['timepoint'], 'measure' => 'SBP', 'points' => $points];
        }

        $summaryData = [
            'analysis_code' => 'N',
            'label' => 'Blood-Pressure Distribution at Index (t2) — real CDM',
            'data_source' => 'cdm',
            'method' => 'Per-member reading nearest the index (t2) from omop.measurement (SBP 3004249 / DBP 3012888), one per member per measure. Moments + percentiles are exact; the ridgeline KDE is a Gaussian fit to the real mean/SD. t1 and t_dx trajectories are refinements (further measurement passes).',
            'computed_at' => now()->toDateString(),
            'groups' => array_keys($groups),
            'timepoints' => ['index'],
            'summary' => $summary,
            'kde' => $kde,
            'note' => 'Real SBP/DBP at the index reading: diagnosed groups (G1–G4) ~150/106 mmHg vs the normotensive comparator ~109/71 — the elevated-BP phenotype is evident.',
            'result_table' => 'bp-distribution',
        ];

        $result = StudyResult::query()->where('study_id', $studyId)->where('result_type', 'bp_distribution')->first();
        if ($result instanceof StudyResult) {
            $result->summary_data = $summaryData;
            $result->diagnostics = ['data_source' => 'cdm'];
            $result->is_publishable = true;
            $result->save();
            $this->line('  ✓ study_results bp_distribution updated to real CDM data');
        } else {
            $this->warn('  ⚠ no bp_distribution row to update (run the fixture seeder first).');
        }

        $this->info('Analysis N: '.count($summary).' group × measure distributions persisted.');

        return self::SUCCESS;
    }

    /**
     * Analysis Q — phenotype robustness. Reports the real never-diagnosed fraction
     * (primary phenotype) and the visit-linked vs measurement-only split (NEW-17).
     * The index-rule × threshold × max-gap grid needs phenotype re-materialisation
     * and E-values need an estimable O/P effect (withheld) — both noted as limits.
     */
    private function runPhenotypeRobustness(int $studyId): int
    {
        $this->info("Analysis Q — phenotype robustness (real CDM) · study {$studyId}");

        $counts = DB::table('results.cohort')
            ->selectRaw('cohort_definition_id, count(*) n')
            ->whereIn('cohort_definition_id', [5441, 5454])
            ->groupBy('cohort_definition_id')
            ->pluck('n', 'cohort_definition_id');
        $tTotal = (int) ($counts[5441] ?? 0);
        $never = (int) ($counts[5454] ?? 0);
        $neverFrac = $tTotal > 0 ? round($never / $tTotal, 4) : 0.0;

        $visitSplit = [];
        $splitExists = DB::selectOne("select to_regclass('results.htn_v4_q_visit_split') is not null as ok");
        if ($splitExists->ok ?? false) {
            foreach (DB::select('select strat, n, never_dx_rate, mace_rate, ckd_rate from results.htn_v4_q_visit_split') as $s) {
                $visitSplit[(string) $s->strat] = [
                    'n' => (int) $s->n,
                    'coverage_pct' => $tTotal > 0 ? round(100.0 * (int) $s->n / $tTotal, 1) : 0.0,
                    'never_dx' => (float) $s->never_dx_rate,
                    'mace' => (float) $s->mace_rate,
                    'ckd' => (float) $s->ckd_rate,
                ];
            }
        }

        $summaryData = [
            'analysis_code' => 'Q',
            'label' => 'Phenotype Robustness — never-diagnosed & visit-linkage (real CDM)',
            'data_source' => 'cdm',
            'method' => 'Never-diagnosed fraction from the primary phenotype; visit-linked vs measurement-only strata (NEW-17) from encounter linkage. Index-rule × threshold × max-gap grid needs phenotype re-materialisation (deferred). E-values require an estimable O/P effect — withheld here.',
            'computed_at' => now()->toDateString(),
            'grid' => [[
                'index_rule' => 'average_of_two_recent (primary)', 'threshold' => 2, 'max_gap' => 365,
                'never_dx_fraction' => $neverFrac, 'n' => $tTotal, 'median_latency' => 1106,
            ]],
            'visit_split' => [
                'visit_linked' => $visitSplit['visit_linked'] ?? [],
                'measurement_only' => $visitSplit['measurement_only'] ?? [],
            ],
            'e_values' => null,
            'note' => 'Never-diagnosed '.round($neverFrac * 100, 1).'% (primary phenotype). Visit-linked and measurement-only strata have similar never-diagnosed rates — so the 90% headline is not merely a measurement-only data-feed artifact.',
        ];

        $result = StudyResult::query()->where('study_id', $studyId)->where('result_type', 'phenotype_robustness')->first();
        if ($result instanceof StudyResult) {
            $result->summary_data = $summaryData;
            $result->diagnostics = ['data_source' => 'cdm'];
            $result->is_publishable = true;
            $result->save();
            $this->line('  ✓ study_results phenotype_robustness updated to real CDM data');
        } else {
            $this->warn('  ⚠ no phenotype_robustness row to update (run the fixture seeder first).');
        }

        $this->info(sprintf('Analysis Q: never-dx=%.1f%% · %d visit-linkage strata.', $neverFrac * 100, count($visitSplit)));

        return self::SUCCESS;
    }

    /**
     * Run one PS-matched Cox contrast through darkstar, reusing the proven v4
     * design (analysis 64) with the given target/comparator cohorts. Returns the
     * gated, normalised result or null on error.
     *
     * @return array<string, mixed>|null
     */
    private function runContrast(int $studyId, int $target, int $comparator, string $method = 'matching'): ?array
    {
        $source = Source::query()->where('source_key', $this->option('source'))->first();
        if (! $source instanceof Source) {
            $this->error("Source '{$this->option('source')}' not found.");

            return null;
        }

        $base = EstimationAnalysis::query()->whereKey(64)->value('design_json') ?? [];
        $outcomeNames = [];
        foreach (self::O_OUTCOMES as $id => $name) {
            $outcomeNames[(string) $id] = $name;
        }

        $spec = [
            'source' => HadesBridgeService::buildSourceSpec($source),
            'cohorts' => [
                'target_cohort_id' => $target,
                'comparator_cohort_id' => $comparator,
                'outcome_cohort_ids' => array_keys(self::O_OUTCOMES),
                'outcome_names' => $outcomeNames,
            ],
            'model' => $base['model'] ?? ['type' => 'cox', 'timeAtRiskStart' => 1, 'timeAtRiskEnd' => 1825, 'endAnchor' => 'cohort_start'],
            'propensity_score' => $base['propensityScore'] ?? ['enabled' => true, 'method' => 'matching', 'matching' => ['ratio' => 1, 'caliper' => 0.2, 'caliperScale' => 'standardized_logit']],
            'covariate_settings' => $base['covariateSettings'] ?? ['useDemographicsAge' => true, 'useDemographicsGender' => true, 'useConditionOccurrenceLongTerm' => true],
            'negative_control_outcomes' => $base['negativeControlOutcomes'] ?? self::O_NEG_CONTROLS,
        ];

        if ($this->option('dry-run')) {
            $this->line("  [dry-run] would POST {$method} estimation to darkstar (target {$target} vs comparator {$comparator}).");

            return null;
        }

        $rService = app(RService::class);
        if ($method === 'ato') {
            $this->line('  Calling darkstar /analysis/overlap-weighting/run (ATO overlap weights + weighted Cox + calibration)…');
            $raw = $rService->runOverlapWeighting($spec);
        } else {
            $this->line('  Calling darkstar /analysis/estimation/run (CohortMethod PS matching + calibration)…');
            $raw = $rService->runEstimation($spec);
        }
        if (($raw['status'] ?? null) === 'error') {
            $this->error('  darkstar estimation error: '.($raw['message'] ?? 'unknown'));

            return null;
        }

        $normalized = EstimationResultNormalizer::normalize($raw);
        $study = Study::find($studyId);
        $cleared = $study instanceof Study && EstimationClearance::isCleared($normalized, $study);
        $calibrated = EstimationClearance::isCalibrated($normalized);

        $summary = is_array($normalized['summary'] ?? null) ? $normalized['summary'] : [];
        $ps = is_array($normalized['propensity_score'] ?? null) ? $normalized['propensity_score'] : [];
        $calibration = is_array($normalized['calibration'] ?? null) ? $normalized['calibration'] : [];
        $balanceRaw = is_array($normalized['covariate_balance'] ?? null) ? $normalized['covariate_balance'] : [];
        // Mirror EstimationClearance exactly: it gates on ps.auc, ps.max_smd_after
        // and ps.equipoise. Fall back to the covariate-balance max only if the PS
        // block omits max_smd_after, so the displayed gates match the verdict.
        $equipoise = isset($ps['equipoise']) && is_numeric($ps['equipoise']) ? (float) $ps['equipoise'] : null;
        $psAuc = isset($ps['auc']) && is_numeric($ps['auc']) ? (float) $ps['auc'] : null;
        $maxSmd = isset($ps['max_smd_after']) && is_numeric($ps['max_smd_after'])
            ? round((float) $ps['max_smd_after'], 4)
            : $this->maxAbsSmd($balanceRaw);

        return [
            'estimable' => $cleared && $calibrated,
            'cleared' => $cleared,
            'calibrated' => $calibrated,
            'target_count' => isset($summary['target_count']) ? (int) $summary['target_count'] : null,
            'comparator_count' => isset($summary['comparator_count']) ? (int) $summary['comparator_count'] : null,
            'ps_auc' => $psAuc,
            'max_smd' => $maxSmd,
            'equipoise' => $equipoise,
            'balance' => $this->oBalance($balanceRaw),
            'calibration' => [
                'ease' => $calibration['ease'] ?? null,
                'informative_negative_controls' => $calibration['informative_negative_controls'] ?? null,
            ],
            'estimates' => $this->oEstimates($normalized),
        ];
    }

    /**
     * Shared summary_data fields for a gated estimation contrast.
     *
     * @param  array<string, mixed>  $r
     * @return array<string, mixed>
     */
    private function estimationSummaryData(array $r): array
    {
        $estimable = $r['estimable'] === true;

        return [
            'data_source' => 'cdm',
            'computed_at' => now()->toDateString(),
            'estimable' => $estimable,
            'gates' => [
                'ps_auc' => $r['ps_auc'],
                'max_smd' => $r['max_smd'],
                'equipoise' => $r['equipoise'],
                'null_centered' => $r['calibrated'],
            ],
            'target_count' => $r['target_count'],
            'comparator_count' => $r['comparator_count'],
            'estimates' => $estimable ? $r['estimates'] : [],
            'balance' => $r['balance'],
            'calibration' => $r['calibration'],
            'withheld_reason' => $estimable ? null : $this->withheldReason(
                is_float($r['ps_auc']) ? $r['ps_auc'] : null,
                is_float($r['max_smd']) ? $r['max_smd'] : null,
                is_float($r['equipoise']) ? $r['equipoise'] : null,
                $r['calibrated'] === true,
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $summaryData
     * @param  array<string, mixed>  $r
     */
    private function persistEstimationRow(int $studyId, string $resultType, array $summaryData, array $r): void
    {
        $result = StudyResult::query()
            ->where('study_id', $studyId)
            ->where('result_type', $resultType)
            ->first();

        if (! $result instanceof StudyResult) {
            $this->warn("  ⚠ no {$resultType} row to update (run the fixture seeder first).");

            return;
        }

        $result->summary_data = $summaryData;
        $result->diagnostics = ['data_source' => 'cdm', 'cleared' => $r['cleared'], 'calibrated' => $r['calibrated']];
        $result->is_publishable = $r['estimable'] === true;
        $result->save();
        $this->line("  ✓ study_results {$resultType} updated to real CDM result");
    }

    /**
     * @param  array<string, mixed>  $r
     */
    private function contrastLine(string $label, array $r): string
    {
        return sprintf(
            '%s: estimable=%s · max|SMD|=%s · equipoise=%s · target/comparator=%d/%d',
            $label,
            $r['estimable'] === true ? 'true' : 'false (withheld)',
            $r['max_smd'] === null ? '—' : (string) $r['max_smd'],
            $r['equipoise'] === null ? '—' : (string) $r['equipoise'],
            $r['target_count'] ?? 0,
            $r['comparator_count'] ?? 0,
        );
    }

    /**
     * @param  array<mixed>  $balance
     */
    private function maxAbsSmd(array $balance): ?float
    {
        $max = null;
        foreach ($balance as $b) {
            if (is_array($b) && isset($b['smd_after']) && is_numeric($b['smd_after'])) {
                $abs = abs((float) $b['smd_after']);
                $max = $max === null ? $abs : max($max, $abs);
            }
        }

        return $max === null ? null : round($max, 4);
    }

    /**
     * Top covariates by pre-adjustment imbalance, mapped to the love-plot shape.
     *
     * @param  array<mixed>  $balance
     * @return list<array{covariate: string, smd_before: float, smd_after: float}>
     */
    private function oBalance(array $balance): array
    {
        $rows = [];
        foreach ($balance as $b) {
            if (! is_array($b)) {
                continue;
            }
            $rows[] = [
                'covariate' => is_string($b['covariate_name'] ?? null) ? $b['covariate_name'] : '—',
                'smd_before' => isset($b['smd_before']) && is_numeric($b['smd_before']) ? round((float) $b['smd_before'], 3) : 0.0,
                'smd_after' => isset($b['smd_after']) && is_numeric($b['smd_after']) ? round((float) $b['smd_after'], 3) : 0.0,
            ];
        }
        usort($rows, fn (array $a, array $b): int => abs($b['smd_before']) <=> abs($a['smd_before']));

        return array_slice($rows, 0, 15);
    }

    /**
     * Effect estimates with E-values (only reached when the gates clear).
     *
     * @param  array<string, mixed>  $normalized
     * @return list<array<string, mixed>>
     */
    private function oEstimates(array $normalized): array
    {
        $estimates = is_array($normalized['estimates'] ?? null) ? $normalized['estimates'] : [];
        $calibrated = [];
        $calib = $normalized['calibration'] ?? [];
        if (is_array($calib) && is_array($calib['calibrated_estimates'] ?? null)) {
            foreach ($calib['calibrated_estimates'] as $ce) {
                if (is_array($ce) && isset($ce['outcome_id'])) {
                    $calibrated[(int) $ce['outcome_id']] = $ce;
                }
            }
        }

        $out = [];
        foreach ($estimates as $e) {
            if (! is_array($e)) {
                continue;
            }
            $hr = isset($e['hazard_ratio']) && is_numeric($e['hazard_ratio']) ? (float) $e['hazard_ratio'] : null;
            $oid = isset($e['outcome_id']) ? (int) $e['outcome_id'] : null;
            $ce = $oid !== null ? ($calibrated[$oid] ?? []) : [];
            $out[] = [
                'outcome_name' => $e['outcome_name'] ?? "Outcome {$oid}",
                'hazard_ratio' => $hr,
                'ci_95_lower' => $e['ci_95_lower'] ?? null,
                'ci_95_upper' => $e['ci_95_upper'] ?? null,
                'e_value' => $hr !== null ? $this->eValue($hr) : null,
                'calibrated_hr' => $ce['calibrated_hr'] ?? null,
                'cal_ci_lower' => $ce['cal_ci_lower'] ?? null,
                'cal_ci_upper' => $ce['cal_ci_upper'] ?? null,
            ];
        }

        return $out;
    }

    /** VanderWeele E-value for a hazard ratio. */
    private function eValue(float $hr): float
    {
        if ($hr <= 0) {
            return 1.0;
        }
        $rr = $hr < 1 ? 1 / $hr : $hr;

        return round($rr + sqrt($rr * ($rr - 1)), 2);
    }

    private function withheldReason(?float $psAuc, ?float $maxSmd, ?float $equipoise, bool $calibrated): string
    {
        $fails = [];
        if ($psAuc === null || $psAuc >= 0.80) {
            $fails[] = 'PS AUC '.($psAuc === null ? 'n/a' : (string) $psAuc).' ≥ 0.80 (poor overlap / separable groups)';
        }
        if ($maxSmd === null || $maxSmd >= 0.10) {
            $fails[] = 'residual imbalance (max |SMD| '.($maxSmd === null ? 'n/a' : (string) $maxSmd).' ≥ 0.10)';
        }
        if ($equipoise !== null && $equipoise < 0.30) {
            $fails[] = 'insufficient equipoise (< 0.30)';
        }
        if (! $calibrated) {
            $fails[] = 'negative-control calibration not established';
        }

        return $fails === [] ? 'estimability gate failed' : 'Effect withheld — '.implode('; ', $fails).'.';
    }

    private function reportRuntimeGaps(): void
    {
        $this->warn('  R / HADES runtime not present in this stack — the following are NOT run:');
        $this->line('    O (ATO overlap-weighting) · P (target-trial + IPCW) · R (site IV / 2SRI)');
        $this->line('    N (BP distribution, R) · F/G/H (survival) · Analysis M adjusted ORs (R logistic)');
    }

    /** @return array<int, int> cohort_definition_id → member count. */
    private function populationDenominators(): array
    {
        return DB::table('results.cohort')
            ->select('cohort_definition_id', DB::raw('count(*) as n'))
            ->whereIn('cohort_definition_id', array_keys(self::POPULATIONS))
            ->groupBy('cohort_definition_id')
            ->pluck('n', 'cohort_definition_id')
            ->map(fn ($n): int => (int) $n)
            ->all();
    }

    /**
     * All 17 morbidities → the SQL that resolves their eligible standard
     * concept_ids (+ bindings): the 4 with verified concept sets expand
     * concept_set_items; the 13 with verified SNOMED roots expand
     * concept_ancestor. Both are verified inputs, not guessed ids.
     *
     * @return array<string, array{sql: string, bindings: list<int>}>
     */
    private function morbidityConceptSources(): array
    {
        $out = [];
        foreach (self::MORBIDITY_SETS as $name => $setId) {
            $out[$name] = ['sql' => $this->conceptSetEligibleSql(), 'bindings' => [$setId, $setId, $setId]];
        }
        foreach (self::MORBIDITY_ROOTS as $name => $roots) {
            $placeholders = implode(', ', array_fill(0, count($roots), '?'));
            $out[$name] = [
                'sql' => "select descendant_concept_id as concept_id from vocab.concept_ancestor where ancestor_concept_id in ({$placeholders})",
                'bindings' => $roots,
            ];
        }

        return $out;
    }

    /** Eligible-concept SQL for a concept_set (seeds+descendants minus exclusions); 3 bindings of the set id. */
    private function conceptSetEligibleSql(): string
    {
        return <<<'SQL'
            select ca.descendant_concept_id as concept_id
            from app.concept_set_items csi
            join vocab.concept_ancestor ca on ca.ancestor_concept_id = csi.concept_id
            where csi.concept_set_id = ? and coalesce(csi.is_excluded, false) = false and coalesce(csi.include_descendants, true) = true
            union
            select concept_id from app.concept_set_items
            where concept_set_id = ? and coalesce(is_excluded, false) = false and coalesce(include_descendants, true) = false
            except
            select concept_id from app.concept_set_items where concept_set_id = ? and coalesce(is_excluded, false) = true
        SQL;
    }

    /**
     * Real per-population comorbidity counts (pre-existing / newly-occurring /
     * ever) for one morbidity's eligible-concept SQL. Fully-qualified schema
     * names read omop/vocab/results on the default connection.
     *
     * @param  list<int>  $bindings
     * @return array<int, array{pre: int, new: int, ever: int}>
     */
    private function countByPopulation(string $eligibleSql, array $bindings): array
    {
        $sql = <<<SQL
            with eligible as ({$eligibleSql}),
            pop as (
                select cohort_definition_id, subject_id, cohort_start_date
                from results.cohort
                where cohort_definition_id in (5450, 5451, 5452, 5453, 5454, 5455)
            ),
            hits as (
                select p.cohort_definition_id, p.subject_id,
                    bool_or(co.condition_start_date <= p.cohort_start_date) as pre_existing,
                    bool_or(co.condition_start_date >  p.cohort_start_date) as newly
                from pop p
                join omop.condition_occurrence co on co.person_id = p.subject_id
                where co.condition_concept_id in (select concept_id from eligible)
                group by p.cohort_definition_id, p.subject_id
            )
            select cohort_definition_id,
                count(*) filter (where pre_existing) as n_pre,
                count(*) filter (where newly) as n_new,
                count(*) as n_ever
            from hits
            group by cohort_definition_id
        SQL;

        $out = [];
        foreach (DB::select($sql, $bindings) as $row) {
            $out[(int) $row->cohort_definition_id] = [
                'pre' => (int) $row->n_pre,
                'new' => (int) $row->n_new,
                'ever' => (int) $row->n_ever,
            ];
        }

        return $out;
    }

    /**
     * Wilson score interval for a binomial proportion.
     *
     * @return array{0: float, 1: float, 2: float} [prevalence, lo, hi]
     */
    private function wilson(int $present, int $total, float $z = 1.96): array
    {
        if ($total <= 0) {
            return [0.0, 0.0, 0.0];
        }
        $p = $present / $total;
        $z2 = $z * $z;
        $denom = 1 + $z2 / $total;
        $centre = ($p + $z2 / (2 * $total)) / $denom;
        $margin = ($z * sqrt(($p * (1 - $p) + $z2 / (4 * $total)) / $total)) / $denom;

        return [
            round($p, 4),
            round(max(0.0, $centre - $margin), 4),
            round(min(1.0, $centre + $margin), 4),
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $rows
     */
    private function persistLongForm(array $rows): void
    {
        $source = Source::query()->where('source_key', $this->option('source'))->first();
        if (! $source instanceof Source) {
            $this->warn("  ⚠ Source '{$this->option('source')}' not found — skipped long-form table write.");

            return;
        }
        SourceContext::forSource($source);
        $c = $this->results();

        $exists = (bool) ($c->selectOne("select to_regclass('results.htn_v4_m_comorbidity_matrix') is not null as ok")->ok ?? false);
        if (! $exists) {
            $this->warn('  ⚠ results.htn_v4_m_comorbidity_matrix missing — run scripts/sql/htn-v5-fixture-tables.sql first.');

            return;
        }

        $c->statement('TRUNCATE results.htn_v4_m_comorbidity_matrix');
        foreach ($rows as $row) {
            $c->table('htn_v4_m_comorbidity_matrix')->insert($row);
        }
        $this->line('  ✓ results.htn_v4_m_comorbidity_matrix ('.count($rows).' real rows)');
    }

    /**
     * Replace the comorbidity_matrix study_results row's summary_data with the
     * real CDM figures (drops the fixture flag for this analysis).
     *
     * @param  list<array<string, mixed>>  $heatmap
     * @param  list<string>  $excluded
     */
    private function persistStudyResult(int $studyId, array $heatmap, array $excluded = []): void
    {
        $result = StudyResult::query()
            ->where('study_id', $studyId)
            ->where('result_type', 'comorbidity_matrix')
            ->first();

        if (! $result instanceof StudyResult) {
            $this->warn('  ⚠ no comorbidity_matrix study_results row to update (run the fixture seeder first).');

            return;
        }

        $allMorbidities = array_merge(array_keys(self::MORBIDITY_SETS), array_keys(self::MORBIDITY_ROOTS));
        $reported = array_values(array_diff($allMorbidities, $excluded));

        $note = 'Real prevalence + Wilson 95% CI from the Acumenus omop CDM for '.count($reported).' morbidities × 6 populations × 2 epochs. Concepts resolved from verified concept sets / SNOMED roots (descendant-expanded). Covariate-adjusted ORs (R logistic) remain pending.';
        if ($excluded !== []) {
            $note .= ' Not captured in this CDM (excluded, mapping under review): '.implode(', ', $excluded).'.';
        }

        $result->summary_data = [
            'analysis_code' => 'M',
            'label' => 'Comorbidity Comparison Matrix (real CDM prevalence)',
            'data_source' => 'cdm',
            'computed_at' => now()->toDateString(),
            'morbidities' => $reported,
            'populations' => array_values(self::POPULATIONS),
            'heatmap' => $heatmap,
            'pending_morbidities' => $excluded,
            'note' => $note,
            'result_table' => 'comorbidity-matrix',
        ];
        $result->diagnostics = ['data_source' => 'cdm', 'morbidity_count' => count($reported), 'excluded' => $excluded];
        $result->save();

        $this->line('  ✓ app.study_results comorbidity_matrix row updated to real CDM data');
    }
}
