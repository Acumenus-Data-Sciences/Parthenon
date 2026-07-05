<?php

namespace App\Console\Commands;

use App\Concerns\SourceAware;
use App\Context\SourceContext;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyResult;
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
        {--action=analyses : reuse-audit|analyses|report}
        {--plan-version=v5 : analysis-plan version (avoids the reserved --version flag)}
        {--study=165 : study id}
        {--source=ACUMENUS : source key whose results schema holds the tables}
        {--dry-run : report without persisting}';

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

    /** Spec morbidities with no verified concept set yet (Analysis M coverage gap). */
    private const PENDING_MORBIDITIES = [
        'Dyslipidemia', 'Obesity', 'Sleep apnea', 'COPD', 'Depression/anxiety',
        'Coronary artery disease', 'Peripheral vascular disease', 'Cerebrovascular disease',
        'Atrial fibrillation', 'Hypertensive retinopathy', 'Cancer', 'Dementia', 'Liver disease',
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
        $this->line('  Morbidity concept sets available: '.implode(', ', array_keys(self::MORBIDITY_SETS)));
        $this->warn('  Pending concept-set materialisation: '.implode(', ', self::PENDING_MORBIDITIES));

        return self::SUCCESS;
    }

    private function runAnalyses(int $studyId): int
    {
        $this->info("Analysis M — comorbidity comparison matrix (real CDM) · study {$studyId}");
        $this->reportRuntimeGaps();

        $denoms = $this->populationDenominators();
        $rows = [];
        $heatmap = [];

        foreach (self::MORBIDITY_SETS as $morbidity => $conceptSetId) {
            $byPop = $this->morbidityByPopulation($conceptSetId);
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
        $this->persistStudyResult($studyId, $heatmap);
        $this->info('Analysis M persisted (real CDM data). O/P/R/N/F/G/H require the R runtime — skipped.');

        return self::SUCCESS;
    }

    private function report(int $studyId): int
    {
        $this->info("Report — study {$studyId}: render via the frontend v5 Report tab (StudyV5ReportTab).");
        $this->line('  Standalone HTML/PDF report generation is deferred to the R report step (runtime absent).');

        return self::SUCCESS;
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
     * Real per-population comorbidity counts (pre-existing / newly-occurring /
     * ever) for one morbidity concept set. Concepts resolved from verified seed
     * roots via vocab.concept_ancestor (standard OMOP descendant expansion —
     * verified roots, not guessed ids). Fully-qualified schema names read the
     * omop/vocab/results schemas on the default connection.
     *
     * @return array<int, array{pre: int, new: int, ever: int}>
     */
    private function morbidityByPopulation(int $conceptSetId): array
    {
        $sql = <<<'SQL'
            with concepts as (
                select ca.descendant_concept_id as concept_id
                from app.concept_set_items csi
                join vocab.concept_ancestor ca on ca.ancestor_concept_id = csi.concept_id
                where csi.concept_set_id = ?
                  and coalesce(csi.is_excluded, false) = false
                  and coalesce(csi.include_descendants, true) = true
                union
                select concept_id
                from app.concept_set_items
                where concept_set_id = ?
                  and coalesce(is_excluded, false) = false
                  and coalesce(include_descendants, true) = false
            ),
            excluded as (
                select concept_id
                from app.concept_set_items
                where concept_set_id = ? and coalesce(is_excluded, false) = true
            ),
            eligible as (
                select concept_id from concepts
                except
                select concept_id from excluded
            ),
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
        foreach (DB::select($sql, [$conceptSetId, $conceptSetId, $conceptSetId]) as $row) {
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
     */
    private function persistStudyResult(int $studyId, array $heatmap): void
    {
        $result = StudyResult::query()
            ->where('study_id', $studyId)
            ->where('result_type', 'comorbidity_matrix')
            ->first();

        if (! $result instanceof StudyResult) {
            $this->warn('  ⚠ no comorbidity_matrix study_results row to update (run the fixture seeder first).');

            return;
        }

        $result->summary_data = [
            'analysis_code' => 'M',
            'label' => 'Comorbidity Comparison Matrix (real CDM prevalence)',
            'data_source' => 'cdm',
            'computed_at' => now()->toDateString(),
            'morbidities' => array_keys(self::MORBIDITY_SETS),
            'populations' => array_values(self::POPULATIONS),
            'heatmap' => $heatmap,
            'pending_morbidities' => self::PENDING_MORBIDITIES,
            'note' => 'Real prevalence + Wilson 95% CI from the Acumenus omop CDM for '.count(self::MORBIDITY_SETS).' morbidities with verified concept sets. Adjusted ORs and the remaining '.count(self::PENDING_MORBIDITIES).' morbidities are pending (require R runtime / concept-set materialisation).',
            'result_table' => 'comorbidity-matrix',
        ];
        $result->diagnostics = ['data_source' => 'cdm', 'r_runtime' => 'absent'];
        $result->save();

        $this->line('  ✓ app.study_results comorbidity_matrix row updated to real CDM data');
    }
}
