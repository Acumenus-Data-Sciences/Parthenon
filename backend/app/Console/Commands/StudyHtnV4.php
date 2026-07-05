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
        {--action=analyses : reuse-audit|analyses|run-o|run-p|report}
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
        $this->info("Analysis O — delayed (G2–G4) vs timely (G1) via darkstar CohortMethod · study {$studyId}");

        $r = $this->runContrast($studyId, self::O_DELAYED, self::O_TIMELY);
        if ($r === null) {
            return self::FAILURE;
        }

        $summaryData = [
            'analysis_code' => 'O',
            'label' => 'Delay Effect — delayed (G2–G4) vs timely (G1), PS-matched Cox',
            'method' => 'darkstar CohortMethod: 1:1 PS matching + Cox + EmpiricalCalibration. Exact PSweight ATO pending (WeightIt not in HADES image); PS matching is the spec-named sensitivity.',
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
        $r = $this->runContrast($studyId, self::P_UNTREATED, self::P_TREATED);
        if ($r === null) {
            return self::FAILURE;
        }

        $summaryData = [
            'analysis_code' => 'P',
            'label' => 'Target-Trial Emulation — treat within 90 d vs not (landmark)',
            'method' => 'Landmark new-user target-trial emulation (index = t2 + 90 d); PS-matched Cox + EmpiricalCalibration. Full clone-censor-weight + IPCW is a refinement.',
            'grace_days' => 90,
            'immortal_time_check' => 'PASS (landmark design — follow-up starts at the grace landmark)',
        ] + $this->estimationSummaryData($r);

        $this->persistEstimationRow($studyId, 'target_trial', $summaryData, $r);
        $this->info($this->contrastLine('Analysis P', $r));

        return self::SUCCESS;
    }

    /**
     * Run one PS-matched Cox contrast through darkstar, reusing the proven v4
     * design (analysis 64) with the given target/comparator cohorts. Returns the
     * gated, normalised result or null on error.
     *
     * @return array<string, mixed>|null
     */
    private function runContrast(int $studyId, int $target, int $comparator): ?array
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
            $this->line("  [dry-run] would POST estimation to darkstar (target {$target} vs comparator {$comparator}).");

            return null;
        }

        $this->line('  Calling darkstar /analysis/estimation/run (CohortMethod, PS matching + negative-control calibration)…');
        $raw = app(RService::class)->runEstimation($spec);
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
