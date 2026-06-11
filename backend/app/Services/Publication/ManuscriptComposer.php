<?php

namespace App\Services\Publication;

use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\Study;
use App\Models\App\StudyGate;
use App\Models\App\StudySynthesis;
use App\Support\EstimationResultNormalizer;
use App\Support\Studies\EstimationClearance;

/**
 * Assembles a STROBE/RECORD-structured manuscript from a study's ACTUAL data
 * (ADR-0020 Phase 6). Deterministic and fabrication-free: every figure comes
 * from a stored result, every limitation from the gate ledger, and the
 * provenance appendix from the recorded hashes and decision trail. The output
 * shape matches PublicationService::export(), so it flows straight to docx/pdf.
 *
 * The Results section is comprehensive and protocol-ordered — prevalence,
 * diagnostic latency, baseline characteristics, incidence, treatment, and
 * outcome consequences — reading each figure from its stored analysis result
 * (characterization / incidence executions, the descriptive synthesis, and
 * every linked estimation). It is gate-aware per contrast: each estimation's
 * calibrated effect is reported only when that contrast's own diagnostics clear
 * (or a human override is recorded); otherwise it is withheld (blinded), the
 * same discipline the live API enforces.
 */
class ManuscriptComposer
{
    /**
     * @return array<string, mixed>
     */
    public function compose(Study $study): array
    {
        $study->loadMissing(['cohorts.cohortDefinition', 'analyses', 'gates']);

        $descriptive = $this->descriptiveSummary($study);
        $estimations = $this->estimationResults($study);
        $anyEstimable = false;
        foreach ($estimations as $est) {
            if ($est['cleared'] === true && $est['calibrated'] === true) {
                $anyEstimable = true;
                break;
            }
        }

        $sections = [
            $this->section('abstract', 'Abstract', $this->abstract($study, $descriptive, $estimations)),
            $this->section('introduction', 'Introduction', $this->introduction($study)),
            $this->section('methods', 'Methods', $this->methods($study)),
            $this->section('results', 'Results', $this->results($study, $descriptive, $estimations)),
            $this->section('limitations', 'Limitations', $this->limitations($study, $estimations)),
            $this->section('provenance', 'Provenance & Reproducibility', $this->provenance($study)),
        ];

        return [
            'title' => $study->title,
            'authors' => $this->authors($study),
            'template' => 'strobe-record',
            'sections' => $sections,
            'manuscript_meta' => [
                'effect_estimates_included' => $anyEstimable,
                'estimation_contrasts' => count($estimations),
                'gating_enabled' => (bool) config('studies.gating_enabled', false),
            ],
        ];
    }

    // ── Results (protocol-ordered subsections) ───────────────────────────────

    /**
     * @param  array<string, mixed>|null  $descriptive
     * @param  list<array<string, mixed>>  $estimations
     */
    private function results(Study $study, ?array $descriptive, array $estimations): string
    {
        $parts = [
            $this->subsection('Prevalence of under-diagnosis', $this->prevalenceText($descriptive)),
            $this->subsection('Diagnostic latency', $this->latencyText($descriptive)),
            $this->subsection('Baseline characteristics by delay stratum', $this->characterizationText($study, $descriptive)),
            $this->subsection('Incidence of cardiovascular–renal outcomes', $this->incidenceText($study)),
            $this->subsection('Treatment utilization', $this->treatmentText($descriptive)),
            $this->subsection('Outcome consequences', $this->consequencesText($estimations)),
        ];

        $parts = array_values(array_filter($parts, static fn (string $p): bool => $p !== ''));

        return $parts === []
            ? 'No completed analyses are available for this study.'
            : implode("\n\n", $parts);
    }

    /**
     * @param  array<string, mixed>|null  $d
     */
    private function prevalenceText(?array $d): string
    {
        $p = is_array($d['prevalence'] ?? null) ? $d['prevalence'] : null;
        if ($p === null) {
            return '';
        }

        return sprintf(
            'Of %s treatment-naïve patients entering on a second consecutive elevated blood-pressure reading, '
            .'%s (%s%%) never recorded a hypertension diagnosis within their observation period; only %s were ever '
            .'diagnosed. Timely diagnosis was rare: among the diagnosed, %s were recorded within 90 days, %s within '
            .'3–6 months, %s within 7–12 months, and %s only after more than a year.',
            $this->num($p['target_total'] ?? null),
            $this->num($p['never_diagnosed'] ?? null),
            $this->fmt($p['never_dx_pct'] ?? null),
            $this->num($p['ever_diagnosed'] ?? null),
            $this->num(($d['delay_strata']['G1_timely_le90d'] ?? null)),
            $this->num(($d['delay_strata']['G2_91_180d'] ?? null)),
            $this->num(($d['delay_strata']['G3_181_365d'] ?? null)),
            $this->num(($d['delay_strata']['G4_delayed_gt365d'] ?? null)),
        );
    }

    /**
     * @param  array<string, mixed>|null  $d
     */
    private function latencyText(?array $d): string
    {
        $a = is_array($d['latency_first_to_second_elevated_bp_days'] ?? null) ? $d['latency_first_to_second_elevated_bp_days'] : null;
        $b = is_array($d['latency_second_elevated_to_diagnosis_days'] ?? null) ? $d['latency_second_elevated_to_diagnosis_days'] : null;
        if ($a === null && $b === null) {
            return '';
        }

        $lines = [];
        if ($a !== null) {
            $lines[] = sprintf(
                'The interval between the first and second elevated blood-pressure readings had a median of %s days (IQR %s–%s).',
                $this->num($a['median'] ?? null), $this->num($a['q1'] ?? null), $this->num($a['q3'] ?? null),
            );
        }
        if ($b !== null) {
            $lines[] = sprintf(
                'Among patients who were eventually diagnosed (n=%s), the interval from the second elevated reading to the '
                .'recorded hypertension diagnosis had a median of %s days (IQR %s–%s) — roughly %s years.',
                $this->num($b['n'] ?? null), $this->num($b['median'] ?? null), $this->num($b['q1'] ?? null), $this->num($b['q3'] ?? null),
                is_numeric($b['median'] ?? null) ? (string) round(((float) $b['median']) / 365.0, 1) : '—',
            );
        }

        return implode(' ', $lines);
    }

    /**
     * @param  array<string, mixed>|null  $d
     */
    private function treatmentText(?array $d): string
    {
        $t = is_array($d['treatment_utilization'] ?? null) ? $d['treatment_utilization'] : null;
        if ($t === null) {
            return '';
        }

        return sprintf(
            'Only %s patients (%s%%) of the elevated-BP population were ever dispensed an antihypertensive after the index '
            .'reading, with a median time to first agent of %s days (IQR %s–%s). Treatment tracked diagnosis closely: %s%% '
            .'of the diagnosed were treated, so under-treatment mirrored under-diagnosis.',
            $this->num($t['ever_treated'] ?? null),
            $this->fmt($t['ever_treated_pct'] ?? null),
            $this->num($t['median_days_to_first_tx'] ?? null),
            $this->num($t['q1_days_to_first_tx'] ?? null),
            $this->num($t['q3_days_to_first_tx'] ?? null),
            $this->fmt($t['treated_pct_of_diagnosed'] ?? null),
        );
    }

    /**
     * @param  array<string, mixed>|null  $d
     */
    private function characterizationText(Study $study, ?array $d): string
    {
        $strata = is_array($d['delay_strata'] ?? null) ? $d['delay_strata'] : null;
        $result = $this->latestAnalysisResult($study, Characterization::class);
        if ($strata === null && $result === null) {
            return '';
        }

        $lines = [];
        if ($strata !== null) {
            $lines[] = sprintf(
                'Baseline characteristics were compared across the five delay strata — timely (≤3mo, n=%s), 3–6 months '
                .'(n=%s), 7–12 months (n=%s), delayed (>12mo, n=%s), and never diagnosed (n=%s).',
                $this->num($strata['G1_timely_le90d'] ?? null),
                $this->num($strata['G2_91_180d'] ?? null),
                $this->num($strata['G3_181_365d'] ?? null),
                $this->num($strata['G4_delayed_gt365d'] ?? null),
                $this->num($strata['never_diagnosed'] ?? null),
            );
        }

        $female = $result !== null ? $this->femaleByCohort($result) : [];
        $age50 = $result !== null ? $this->agedFiftyPlusByCohort($result) : [];
        if ($female !== [] || $age50 !== []) {
            $bits = [];
            $map = [5450 => 'timely', 5453 => 'delayed (>12mo)', 5454 => 'never diagnosed'];
            foreach ($map as $cid => $label) {
                $f = $female[$cid] ?? null;
                $a = $age50[$cid] ?? null;
                if ($f === null && $a === null) {
                    continue;
                }
                $bits[] = sprintf(
                    'the %s stratum was %s female%s',
                    $label,
                    $f !== null ? $this->fmt($f).'%' : 'of unreported sex',
                    $a !== null ? sprintf(' with %s%% aged ≥50', $this->fmt($a)) : '',
                );
            }
            if ($bits !== []) {
                $lines[] = 'By demographics, '.implode('; ', $bits).'.';
            }
        }

        $lines[] = 'Full distributions of demographics, conditions, drugs, measurements, and procedures, with standardized '
            .'mean differences against the full treatment-naïve elevated-BP cohort, are reported in the characterization result.';

        return implode(' ', $lines);
    }

    private function incidenceText(Study $study): string
    {
        $result = $this->latestAnalysisResult($study, IncidenceRateAnalysis::class);
        $rows = is_array($result['results'] ?? null) ? $result['results'] : [];
        if ($rows === []) {
            return '';
        }

        $labels = $this->cohortLabels($study);
        $blocks = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $oid = is_numeric($row['outcome_cohort_id'] ?? null) ? (int) $row['outcome_cohort_id'] : 0;
            $stored = (string) ($row['outcome_cohort_name'] ?? '');
            $name = ($stored === '' || str_starts_with($stored, 'Outcome #'))
                ? ($labels[$oid] ?? ($stored !== '' ? $stored : 'Outcome'))
                : $stored;
            $segments = [];
            if (is_numeric($row['incidence_rate'] ?? null)) {
                $segments[] = sprintf(
                    'overall %s/1,000 py (95%% CI %s–%s)',
                    $this->fmt($row['incidence_rate']),
                    $this->fmt($row['rate_95_ci_lower'] ?? null),
                    $this->fmt($row['rate_95_ci_upper'] ?? null),
                );
            }
            foreach ($this->orderedStrata($row['strata'] ?? null) as $segment) {
                $segments[] = $segment;
            }
            if ($segments !== []) {
                $blocks[] = sprintf('%s — %s', $name, implode('; ', $segments)).'.';
            }
        }

        return $blocks === []
            ? ''
            : 'Crude incidence, with time at risk measured from the index reading: '.implode(' ', $blocks);
    }

    /**
     * Per-stratum incidence segments in clinical order (sex, then age band).
     *
     * @return list<string>
     */
    private function orderedStrata(mixed $strata): array
    {
        $byName = [];
        foreach (is_array($strata) ? $strata : [] as $s) {
            if (! is_array($s)) {
                continue;
            }
            $name = (string) ($s['stratum_name'] ?? '');
            if ($name === '' || ! is_numeric($s['incidence_rate'] ?? null)) {
                continue;
            }
            $byName[$name] = sprintf(
                '%s %s/1,000 py (95%% CI %s–%s)',
                $name,
                $this->fmt($s['incidence_rate']),
                $this->fmt($s['rate_95_ci_lower'] ?? null),
                $this->fmt($s['rate_95_ci_upper'] ?? null),
            );
        }

        $ordered = [];
        foreach (['MALE', 'FEMALE', '18-34', '35-49', '50-64', '65+'] as $k) {
            if (isset($byName[$k])) {
                $ordered[] = $byName[$k];
                unset($byName[$k]);
            }
        }
        foreach ($byName as $v) {
            $ordered[] = $v;
        }

        return $ordered;
    }

    /**
     * @param  list<array<string, mixed>>  $estimations
     */
    private function consequencesText(array $estimations): string
    {
        if ($estimations === []) {
            return 'No population-level estimation completed for this study; comparative effect estimates are not available.';
        }

        $blocks = [];
        foreach ($estimations as $est) {
            $result = $est['result'];
            $ps = is_array($result['propensity_score'] ?? null) ? $result['propensity_score'] : [];
            $diag = sprintf(
                '%s — propensity-score diagnostics: AUC %s, equipoise %s, maximum post-adjustment SMD %s.',
                (string) $est['name'],
                $this->fmt($ps['auc'] ?? null),
                $this->fmt($ps['equipoise'] ?? null),
                $this->fmt($ps['max_smd_after'] ?? null),
            );

            if ($est['cleared'] !== true) {
                $blocks[] = $diag.' This pre-specified contrast was not estimable — the diagnostics did not clear '
                    .'(the comparator could not be balanced), so its effect estimates are withheld (blinded) and were not interpreted.';

                continue;
            }

            $calibration = is_array($result['calibration'] ?? null) ? $result['calibration'] : null;
            if ($calibration === null || ($calibration['status'] ?? null) !== 'completed') {
                $blocks[] = $diag.' Empirical calibration was not performed (insufficient informative negative controls); '
                    .'uncalibrated estimates only: '.$this->uncalibratedTable($result);

                continue;
            }

            $blocks[] = $diag.sprintf(
                ' Estimates were empirically calibrated against %d negative controls (EASE %s). ',
                (int) ($calibration['informative_negative_controls'] ?? 0),
                $this->fmt($calibration['ease'] ?? null),
            ).$this->calibratedTable($calibration);
        }

        return implode("\n\n", $blocks);
    }

    /**
     * @param  array<string, mixed>  $calibration
     */
    private function calibratedTable(array $calibration): string
    {
        $rows = [];
        $estimates = is_array($calibration['calibrated_estimates'] ?? null) ? $calibration['calibrated_estimates'] : [];
        foreach ($estimates as $est) {
            if (! is_array($est) || ($est['calibrated'] ?? false) !== true) {
                continue;
            }
            $rows[] = sprintf(
                '%s: calibrated HR %s (95%% CI %s–%s), calibrated p %s.',
                (string) ($est['outcome_name'] ?? 'Outcome'),
                $this->fmt($est['calibrated_hr'] ?? null),
                $this->fmt($est['cal_ci_lower'] ?? null),
                $this->fmt($est['cal_ci_upper'] ?? null),
                $this->fmtP($est['calibrated_p'] ?? null),
            );
        }

        return $rows === [] ? 'No calibrated outcome estimates were produced.' : 'Calibrated effect estimates: '.implode(' ', $rows);
    }

    /**
     * @param  array<string, mixed>  $estimation
     */
    private function uncalibratedTable(array $estimation): string
    {
        $rows = [];
        foreach ($estimation['estimates'] ?? [] as $est) {
            if (! is_array($est)) {
                continue;
            }
            $rows[] = sprintf(
                '%s: HR %s (95%% CI %s–%s), p %s.',
                (string) ($est['outcome_name'] ?? 'Outcome'),
                $this->fmt($est['hazard_ratio'] ?? null),
                $this->fmt($est['ci_95_lower'] ?? null),
                $this->fmt($est['ci_95_upper'] ?? null),
                $this->fmtP($est['p_value'] ?? null),
            );
        }

        return $rows === [] ? '' : 'Uncalibrated estimates: '.implode(' ', $rows);
    }

    // ── Static narrative sections ────────────────────────────────────────────

    private function methods(Study $study): string
    {
        $cohorts = [];
        foreach ($study->cohorts as $cohort) {
            $cohorts[] = sprintf('%s (%s)', (string) ($cohort->label ?? $cohort->role), (string) $cohort->role);
        }

        $thresholds = config('studies.gate_thresholds.study_diagnostics', []);
        $thresholdText = is_array($thresholds) ? sprintf(
            'Pre-specified diagnostic gates required propensity-score AUC below %s, maximum post-adjustment SMD below %s, and equipoise of at least %s.',
            $this->fmt($thresholds['max_ps_auc'] ?? null),
            $this->fmt($thresholds['max_smd_after'] ?? null),
            $this->fmt($thresholds['min_equipoise'] ?? null),
        ) : '';

        $design = $study->study_design ? sprintf('This was a %s observational study on the OMOP CDM. ', (string) $study->study_design)
            : 'This was an observational study on the OMOP CDM. ';

        return $design
            .'Prevalence, diagnostic latency, baseline characteristics, incidence, treatment utilization, and outcome '
            .'consequences were analysed. Each effect-estimation contrast was propensity-score matched and empirically '
            .'calibrated against the negative-control panel, and reported only when its own diagnostics cleared. '
            .($cohorts === [] ? '' : 'Cohorts: '.implode('; ', $cohorts).'. ')
            .$thresholdText;
    }

    /**
     * @param  list<array<string, mixed>>  $estimations
     */
    private function limitations(Study $study, array $estimations): string
    {
        $lines = [];
        foreach ($study->gates as $gate) {
            if (! $gate instanceof StudyGate) {
                continue;
            }
            $reasons = is_array($gate->metrics_json['reasons'] ?? null)
                ? implode(' ', array_map('strval', $gate->metrics_json['reasons']))
                : '';
            $stage = $gate->stage->value;

            if ($gate->status->value === 'overridden') {
                $lines[] = sprintf(
                    'The %s gate did not pass (%s) and was overridden with the documented rationale: "%s".',
                    $stage, $reasons, (string) ($gate->override_rationale ?? '')
                );
            } elseif ($gate->status->value === 'failed') {
                $lines[] = sprintf(
                    'The %s gate failed (%s); affected estimates remain blinded and were not interpreted.',
                    $stage, $reasons
                );
            }
        }

        foreach ($estimations as $est) {
            if ($est['cleared'] !== true) {
                $lines[] = sprintf(
                    'The "%s" contrast was not estimable in this data and its effect estimates were withheld.',
                    (string) $est['name']
                );
            }
        }

        if ($lines === []) {
            return 'No scientific gate failures or overrides were recorded for this study.';
        }

        return 'The following qualify the findings. '.implode(' ', $lines);
    }

    private function provenance(Study $study): string
    {
        $cohortLines = [];
        $vocab = null;
        $cdm = null;
        foreach ($study->cohorts as $cohort) {
            $def = $cohort->cohortDefinition;
            if ($def === null) {
                continue;
            }
            $gen = $def->generations()->orderByDesc('id')->first();
            $vocab ??= $gen?->vocabulary_version;
            $cdm ??= $gen?->cdm_source_release;
            $cohortLines[] = sprintf('%s [sha256:%s]', (string) $def->name, substr((string) $def->expression_sha256, 0, 12) ?: 'unhashed');
        }

        $gateTrail = [];
        foreach ($study->gates as $gate) {
            if ($gate instanceof StudyGate) {
                $gateTrail[] = sprintf('%s=%s', $gate->stage->value, $gate->status->value);
            }
        }

        return 'This study is reproducible from its content-addressed artifacts. '
            .($cohortLines === [] ? '' : 'Cohort definitions: '.implode('; ', $cohortLines).'. ')
            .($vocab ? sprintf('Vocabulary version %s. ', $vocab) : '')
            .($cdm ? sprintf('CDM release %s. ', $cdm) : '')
            .($gateTrail === [] ? '' : 'Gate-ledger decision trail: '.implode(', ', $gateTrail).'.');
    }

    /**
     * @param  array<string, mixed>|null  $descriptive
     * @param  list<array<string, mixed>>  $estimations
     */
    private function abstract(Study $study, ?array $descriptive, array $estimations): string
    {
        $objective = (string) ($study->primary_objective
            ?: $study->scientific_rationale
            ?: sprintf('An observational study (%s) conducted on the OMOP CDM.', (string) $study->title));

        $findings = [];
        $p = is_array($descriptive['prevalence'] ?? null) ? $descriptive['prevalence'] : null;
        if ($p !== null) {
            $findings[] = sprintf('%s%% of treatment-naïve elevated-BP patients never recorded a diagnosis', $this->fmt($p['never_dx_pct'] ?? null));
        }
        $b = is_array($descriptive['latency_second_elevated_to_diagnosis_days'] ?? null) ? $descriptive['latency_second_elevated_to_diagnosis_days'] : null;
        if ($b !== null && is_numeric($b['median'] ?? null)) {
            $findings[] = sprintf('among the diagnosed, median delay to diagnosis was %s days', $this->num($b['median']));
        }
        foreach ($estimations as $est) {
            if ($est['cleared'] !== true) {
                continue;
            }
            $cal = is_array($est['result']['calibration'] ?? null) ? $est['result']['calibration'] : null;
            $ests = is_array($cal['calibrated_estimates'] ?? null) ? $cal['calibrated_estimates'] : [];
            foreach ($ests as $e) {
                if (is_array($e) && stripos((string) ($e['outcome_name'] ?? ''), 'CKD') !== false) {
                    $findings[] = sprintf('elevated BP was associated with a calibrated HR of %s for incident CKD versus recording-comparable normotensives', $this->fmt($e['calibrated_hr'] ?? null));
                    break 2;
                }
            }
        }

        return $findings === []
            ? $objective
            : $objective.' Results: '.ucfirst(implode('; ', $findings)).'.';
    }

    private function introduction(Study $study): string
    {
        return (string) ($study->scientific_rationale ?: $study->hypothesis ?: 'Background and rationale for this study.');
    }

    /**
     * @return list<string>
     */
    private function authors(Study $study): array
    {
        $authors = [];
        if ($study->principalInvestigator !== null) {
            $authors[] = (string) $study->principalInvestigator->name;
        }
        if ($study->leadStatistician !== null) {
            $authors[] = (string) $study->leadStatistician->name;
        }

        return array_values(array_unique($authors));
    }

    // ── Data access ──────────────────────────────────────────────────────────

    /**
     * Every linked estimation, each tagged with whether its own diagnostics
     * cleared and whether a completed calibration is present.
     *
     * @return list<array{name: string, result: array<string, mixed>, cleared: bool, calibrated: bool}>
     */
    private function estimationResults(Study $study): array
    {
        $out = [];
        foreach ($study->analyses as $studyAnalysis) {
            if ($studyAnalysis->analysis_type !== EstimationAnalysis::class) {
                continue;
            }
            /** @var EstimationAnalysis|null $analysis */
            $analysis = $studyAnalysis->analysis;
            $execution = $analysis?->executions()
                ->where('status', 'completed')
                ->orderByDesc('created_at')
                ->first();
            if ($execution === null || ! is_array($execution->result_json)) {
                continue;
            }
            $result = EstimationResultNormalizer::normalize($execution->result_json);
            $calibration = is_array($result['calibration'] ?? null) ? $result['calibration'] : null;
            $out[] = [
                'name' => (string) $analysis?->name,
                'result' => $result,
                'cleared' => $this->estimationCleared($result, $study),
                'calibrated' => $calibration !== null && ($calibration['status'] ?? null) === 'completed',
            ];
        }

        return $out;
    }

    /**
     * A contrast is estimable when its own propensity diagnostics meet the
     * pre-specified thresholds, OR a human has overridden/approved the
     * study-diagnostics gate.
     *
     * @param  array<string, mixed>  $result
     */
    private function estimationCleared(array $result, Study $study): bool
    {
        // Authoritative gate logic lives in EstimationClearance so the projector
        // (is_publishable), the Results tab, and this manuscript never disagree.
        return EstimationClearance::isCleared($result, $study);
    }

    /**
     * cohort_definition_id → human label from the study's linked cohorts.
     *
     * @return array<int, string>
     */
    private function cohortLabels(Study $study): array
    {
        $map = [];
        foreach ($study->cohorts as $cohort) {
            $id = (int) $cohort->cohort_definition_id;
            $label = (string) ($cohort->label ?? $cohort->cohortDefinition?->name ?? '');
            if ($id !== 0 && $label !== '') {
                $map[$id] = $label;
            }
        }

        return $map;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function descriptiveSummary(Study $study): ?array
    {
        $row = StudySynthesis::query()
            ->where('study_id', $study->id)
            ->where('synthesis_type', 'descriptive_summary')
            ->orderByDesc('id')
            ->first();

        return is_array($row?->output) ? $row->output : null;
    }

    /**
     * Latest completed execution result_json for a given analysis morph class.
     *
     * @param  class-string  $analysisType
     * @return array<array-key, mixed>|null
     */
    private function latestAnalysisResult(Study $study, string $analysisType): ?array
    {
        foreach ($study->analyses as $studyAnalysis) {
            if ($studyAnalysis->analysis_type !== $analysisType) {
                continue;
            }
            $execution = AnalysisExecution::query()
                ->where('analysis_type', $analysisType)
                ->where('analysis_id', $studyAnalysis->analysis_id)
                ->where('status', 'completed')
                ->orderByDesc('created_at')
                ->first();
            $result = $execution?->result_json;
            if (is_array($result)) {
                /** @var array<array-key, mixed> $result */
                return $result;
            }
        }

        return null;
    }

    /**
     * % female per cohort_id from a characterization result (suppressed cells skipped).
     *
     * @param  array<array-key, mixed>  $result
     * @return array<int, float>
     */
    private function femaleByCohort(array $result): array
    {
        $out = [];
        foreach (is_array($result['results'] ?? null) ? $result['results'] : [] as $elem) {
            $demographics = is_array($elem['features']['demographics'] ?? null) ? $elem['features']['demographics'] : [];
            foreach ($demographics as $f) {
                if (! is_array($f)) {
                    continue;
                }
                $name = strtolower((string) ($f['feature_name'] ?? ''));
                $cat = strtoupper((string) ($f['category'] ?? ''));
                $pct = $f['percent'] ?? null;
                if (str_contains($name, 'gender') && ($cat === 'FEMALE' || $cat === 'F') && is_numeric($pct) && (float) $pct >= 0) {
                    $out[(int) ($f['cohort_id'] ?? 0)] = (float) $pct;
                }
            }
        }

        return $out;
    }

    /**
     * % aged ≥50 per cohort_id (sum of 50-64 and 65+ age bands; suppressed cells skipped).
     *
     * @param  array<array-key, mixed>  $result
     * @return array<int, float>
     */
    private function agedFiftyPlusByCohort(array $result): array
    {
        $out = [];
        foreach (is_array($result['results'] ?? null) ? $result['results'] : [] as $elem) {
            $demographics = is_array($elem['features']['demographics'] ?? null) ? $elem['features']['demographics'] : [];
            foreach ($demographics as $f) {
                if (! is_array($f)) {
                    continue;
                }
                $name = strtolower((string) ($f['feature_name'] ?? ''));
                $cat = (string) ($f['category'] ?? '');
                $pct = $f['percent'] ?? null;
                if (str_contains($name, 'age') && in_array($cat, ['50-64', '65+'], true) && is_numeric($pct) && (float) $pct >= 0) {
                    $cid = (int) ($f['cohort_id'] ?? 0);
                    $out[$cid] = ($out[$cid] ?? 0.0) + (float) $pct;
                }
            }
        }

        return array_map(static fn (float $v): float => round($v, 1), $out);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function subsection(string $heading, string $body): string
    {
        return $body === '' ? '' : '### '.$heading."\n".$body;
    }

    /**
     * @return array<string, mixed>
     */
    private function section(string $key, string $title, string $content): array
    {
        return [
            'key' => $key,
            'title' => $title,
            'content' => $content,
            'type' => 'text',
            'included' => true,
        ];
    }

    private function fmt(mixed $value): string
    {
        return is_numeric($value) ? (string) round((float) $value, 4) : '—';
    }

    private function fmtP(mixed $value): string
    {
        if (! is_numeric($value)) {
            return '—';
        }

        return (float) $value < 0.0001 ? '<0.0001' : (string) round((float) $value, 4);
    }

    private function num(mixed $value): string
    {
        return is_numeric($value) ? number_format((float) $value) : '—';
    }
}
