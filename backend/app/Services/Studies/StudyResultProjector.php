<?php

namespace App\Services\Studies;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyResult;
use App\Services\Analysis\StudyService;
use App\Support\AnalysisTypeMap;
use App\Support\Studies\EstimationClearance;

/**
 * Projects completed analysis executions into curated `study_results` rows.
 *
 * Analyses compute their output into `analysis_executions.result_json` (morph-
 * keyed by analysis type), but the study Results tab, the package builder, and
 * the publication layer all read `study_results`. Nothing bridged the two, so
 * the Results tab was structurally empty for every real study. This projector is
 * that bridge: it normalizes each execution's result and upserts one curated,
 * publishable row per (study analysis × result type), preserving any reviewer
 * curation (is_primary / reviewed_by) on re-projection.
 */
class StudyResultProjector
{
    public function __construct(private readonly StudyService $studyService) {}

    /**
     * Project a single completed execution into study_results for every study
     * that links the underlying analysis. Returns the number of rows upserted.
     */
    public function projectExecution(AnalysisExecution $execution): int
    {
        if ($execution->status !== ExecutionStatus::Completed || ! is_array($execution->result_json)) {
            return 0;
        }

        $studyAnalyses = StudyAnalysis::query()
            ->where('analysis_type', $execution->analysis_type)
            ->where('analysis_id', $execution->analysis_id)
            ->with('study.gates')
            ->get();

        $count = 0;
        foreach ($studyAnalyses as $studyAnalysis) {
            // Always project the latest completed execution for the analysis, not
            // necessarily the one that just fired — a later-completing retry of an
            // older execution must not clobber the row with stale results.
            $latest = $this->latestCompletedExecution($studyAnalysis);
            if ($latest === null) {
                continue;
            }
            $count += $this->projectForStudyAnalysis($studyAnalysis, $latest);
        }

        return $count;
    }

    /**
     * Backfill: project the latest completed execution of every analysis linked
     * to the study. Returns the number of rows upserted.
     */
    public function projectStudy(Study $study): int
    {
        $study->loadMissing(['analyses', 'gates']);

        $count = 0;
        foreach ($study->analyses as $studyAnalysis) {
            $execution = $this->latestCompletedExecution($studyAnalysis);
            if ($execution === null) {
                continue;
            }

            // Reuse the study already loaded with gates (avoids a per-analysis reload).
            $studyAnalysis->setRelation('study', $study);
            $count += $this->projectForStudyAnalysis($studyAnalysis, $execution);
        }

        return $count;
    }

    private function latestCompletedExecution(StudyAnalysis $studyAnalysis): ?AnalysisExecution
    {
        return AnalysisExecution::query()
            ->where('analysis_type', $studyAnalysis->analysis_type)
            ->where('analysis_id', $studyAnalysis->analysis_id)
            ->where('status', ExecutionStatus::Completed)
            ->orderByDesc('created_at')
            ->first();
    }

    private function projectForStudyAnalysis(StudyAnalysis $studyAnalysis, AnalysisExecution $execution): int
    {
        $rows = $this->buildRows($studyAnalysis, $execution);

        foreach ($rows as $row) {
            $result = StudyResult::firstOrNew([
                'study_id' => $studyAnalysis->study_id,
                'study_analysis_id' => $studyAnalysis->id,
                'result_type' => $row['result_type'],
                'site_id' => null,
            ]);

            $wasExisting = $result->exists;

            $result->analysis_execution_id = $execution->id;
            $result->summary_data = $row['summary_data'];
            $result->diagnostics = $row['diagnostics'];
            $result->is_publishable = $row['is_publishable'];

            // Preserve reviewer curation: is_primary is only seeded on first
            // creation, never reset by a later re-projection.
            if (! $wasExisting) {
                $result->is_primary = $row['is_primary'];
            }

            $result->save();
        }

        return count($rows);
    }

    /**
     * Build the curated study_results attributes for one analysis execution.
     *
     * @return list<array{result_type: string, summary_data: array<string, mixed>, diagnostics: array<string, mixed>|null, is_primary: bool, is_publishable: bool}>
     */
    private function buildRows(StudyAnalysis $studyAnalysis, AnalysisExecution $execution): array
    {
        $raw = is_array($execution->result_json) ? $execution->result_json : [];
        $normalized = $this->studyService->normalizeExecutionResult($studyAnalysis->analysis_type, $raw);

        return match (AnalysisTypeMap::slug($studyAnalysis->analysis_type)) {
            'characterization' => [$this->descriptiveRow('characterization', $normalized)],
            'incidence_rate' => [$this->descriptiveRow('incidence_rate', $normalized)],
            'pathway' => [$this->descriptiveRow('pathway', $normalized)],
            'prediction' => [$this->descriptiveRow('prediction_performance', $normalized)],
            'estimation', 'sccs' => [$this->estimationRow($studyAnalysis, $normalized)],
            'evidence_synthesis' => [$this->descriptiveRow('custom', $normalized)],
            default => [],
        };
    }

    /**
     * A descriptive (non-comparative) result is always publishable — it carries
     * no blinded effect estimate to gate.
     *
     * @param  array<string, mixed>  $normalized
     * @return array{result_type: string, summary_data: array<string, mixed>, diagnostics: null, is_primary: bool, is_publishable: bool}
     */
    private function descriptiveRow(string $resultType, array $normalized): array
    {
        return [
            'result_type' => $resultType,
            'summary_data' => $normalized,
            'diagnostics' => null,
            'is_primary' => false,
            'is_publishable' => true,
        ];
    }

    /**
     * A comparative effect estimate is publishable only when its own diagnostics
     * clear and a completed empirical calibration is present — the same rule the
     * manuscript composer enforces.
     *
     * @param  array<string, mixed>  $normalized
     * @return array{result_type: string, summary_data: array<string, mixed>, diagnostics: array<string, mixed>, is_primary: bool, is_publishable: bool}
     */
    private function estimationRow(StudyAnalysis $studyAnalysis, array $normalized): array
    {
        $study = $studyAnalysis->study;
        $cleared = $study instanceof Study && EstimationClearance::isCleared($normalized, $study);
        $calibrated = EstimationClearance::isCalibrated($normalized);

        return [
            'result_type' => 'effect_estimate',
            'summary_data' => $normalized,
            'diagnostics' => [
                'summary' => is_array($normalized['summary'] ?? null) ? $normalized['summary'] : null,
                'propensity_score' => $normalized['propensity_score'] ?? null,
                'calibration' => is_array($normalized['calibration'] ?? null) ? $normalized['calibration'] : null,
                'cleared' => $cleared,
                'calibrated' => $calibrated,
            ],
            'is_primary' => false,
            'is_publishable' => $cleared && $calibrated,
        ];
    }
}
