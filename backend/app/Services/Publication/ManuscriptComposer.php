<?php

namespace App\Services\Publication;

use App\Models\App\EstimationAnalysis;
use App\Models\App\Study;
use App\Models\App\StudyGate;
use App\Support\EstimationResultNormalizer;

/**
 * Assembles a STROBE/RECORD-structured manuscript from a study's ACTUAL data
 * (ADR-0020 Phase 6). Deterministic and fabrication-free: every figure comes
 * from a stored result, every limitation from the gate ledger, and the
 * provenance appendix from the recorded hashes and decision trail. The output
 * shape matches PublicationService::export(), so it flows straight to docx/pdf.
 *
 * Crucially, the Results section is gate-aware: calibrated effect estimates are
 * reported only when the study's study-diagnostics gate has cleared (passed,
 * approved, or overridden). Otherwise the effect is withheld and only the
 * diagnostics are reported — the same blinding the live API enforces.
 */
class ManuscriptComposer
{
    /**
     * @return array<string, mixed>
     */
    public function compose(Study $study): array
    {
        $study->loadMissing(['cohorts.cohortDefinition', 'analyses', 'gates']);

        $estimation = $this->latestEstimationResult($study);
        $s5Cleared = $this->gateCleared($study, 'study_diagnostics');

        $sections = [
            $this->section('abstract', 'Abstract', $this->abstract($study)),
            $this->section('introduction', 'Introduction', $this->introduction($study)),
            $this->section('methods', 'Methods', $this->methods($study)),
            $this->section('results', 'Results', $this->results($study, $estimation, $s5Cleared)),
            $this->section('limitations', 'Limitations', $this->limitations($study)),
            $this->section('provenance', 'Provenance & Reproducibility', $this->provenance($study)),
        ];

        return [
            'title' => $study->title,
            'authors' => $this->authors($study),
            'template' => 'strobe-record',
            'sections' => $sections,
            'manuscript_meta' => [
                'effect_estimates_included' => $s5Cleared && $estimation !== null,
                'gating_enabled' => (bool) config('studies.gating_enabled', false),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>|null  $estimation
     */
    private function results(Study $study, ?array $estimation, bool $s5Cleared): string
    {
        if ($estimation === null) {
            return 'No population-level estimation has completed for this study; comparative effect estimates are not yet available.';
        }

        $ps = is_array($estimation['propensity_score'] ?? null) ? $estimation['propensity_score'] : [];
        $lines = [];

        $lines[] = sprintf(
            'Propensity-score diagnostics: AUC %s, equipoise %s, maximum post-adjustment standardized mean difference %s.',
            $this->fmt($ps['auc'] ?? null),
            $this->fmt($ps['equipoise'] ?? null),
            $this->fmt($ps['max_smd_after'] ?? null),
        );

        if (! $s5Cleared) {
            $lines[] = 'Effect estimates are withheld: the study-diagnostics gate has not cleared. '
                .'Only diagnostics are reported, pending reviewer approval or a documented override.';

            return implode(' ', $lines);
        }

        $calibration = is_array($estimation['calibration'] ?? null) ? $estimation['calibration'] : null;

        if ($calibration === null || ($calibration['status'] ?? null) !== 'completed') {
            $lines[] = 'Empirical calibration was not performed (insufficient informative negative controls), '
                .'so only uncalibrated estimates are available and should be interpreted with caution.';
            $lines[] = $this->uncalibratedTable($estimation);

            return implode(' ', array_filter($lines));
        }

        $lines[] = sprintf(
            'Estimates were empirically calibrated against %d negative controls (EASE %s).',
            (int) ($calibration['informative_negative_controls'] ?? 0),
            $this->fmt($calibration['ease'] ?? null),
        );
        $lines[] = $this->calibratedTable($calibration);

        return implode(' ', array_filter($lines));
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
                $this->fmt($est['calibrated_p'] ?? null),
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
                $this->fmt($est['p_value'] ?? null),
            );
        }

        return $rows === [] ? '' : 'Uncalibrated estimates: '.implode(' ', $rows);
    }

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
            .($cohorts === [] ? '' : 'Cohorts: '.implode('; ', $cohorts).'. ')
            .$thresholdText;
    }

    private function limitations(Study $study): string
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

        if ($lines === []) {
            return 'No scientific gate failures or overrides were recorded for this study.';
        }

        return 'The following gate decisions qualify the findings. '.implode(' ', $lines);
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

    private function abstract(Study $study): string
    {
        return (string) ($study->primary_objective
            ?: $study->scientific_rationale
            ?: sprintf('An observational study (%s) conducted on the OMOP CDM.', (string) $study->title));
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

    /**
     * @return array<string, mixed>|null
     */
    private function latestEstimationResult(Study $study): ?array
    {
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

            if ($execution !== null && is_array($execution->result_json)) {
                return EstimationResultNormalizer::normalize($execution->result_json);
            }
        }

        return null;
    }

    private function gateCleared(Study $study, string $stage): bool
    {
        foreach ($study->gates as $gate) {
            if ($gate instanceof StudyGate && $gate->stage->value === $stage) {
                return $gate->status->clears();
            }
        }

        // No gate recorded → not blocked (gating may be disabled or not yet run).
        return true;
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
}
