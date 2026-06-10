<?php

namespace App\Services\Studies\Gates;

use App\Enums\GateStage;
use App\Enums\GateStatus;
use App\Exceptions\GateBlockedException;
use App\Models\App\Study;
use App\Models\App\StudyAnalysis;
use App\Models\App\StudyGate;
use App\Models\User;
use App\Support\EstimationResultNormalizer;
use InvalidArgumentException;

/**
 * The spine of the Clio gate ledger (ADR-0020 Phase 3): auto-evaluates stage
 * gates from computed metrics, records human approvals / justified overrides,
 * and answers whether downstream work may proceed. When gating is disabled the
 * service is inert and never blocks anything.
 */
class StudyGateService
{
    public function gatingEnabled(): bool
    {
        return (bool) config('studies.gating_enabled', false);
    }

    /**
     * Auto-evaluate a stage gate from its computed metrics and persist it.
     *
     * @param  array<string, mixed>  $metrics
     */
    public function evaluate(Study $study, GateStage $stage, array $metrics, string $gateKey = 'default'): StudyGate
    {
        $thresholds = $this->thresholdsFor($stage);
        $result = GateThresholdEvaluator::evaluate($stage, $metrics, $thresholds);

        return StudyGate::updateOrCreate(
            ['study_id' => $study->id, 'stage' => $stage->value, 'gate_key' => $gateKey],
            [
                'status' => $result['status'],
                'metrics_json' => $metrics + ['reasons' => $result['reasons']],
                'threshold_json' => $thresholds,
                'decision' => 'auto',
                'decided_by' => null,
                'decided_at' => null,
                'override_rationale' => null,
            ],
        );
    }

    public function approve(StudyGate $gate, User $user): StudyGate
    {
        $gate->update([
            'status' => GateStatus::Approved,
            'decision' => 'human',
            'decided_by' => $user->id,
            'decided_at' => now(),
        ]);

        return $gate->refresh();
    }

    public function override(StudyGate $gate, User $user, string $rationale): StudyGate
    {
        $rationale = trim($rationale);
        if ($rationale === '') {
            throw new InvalidArgumentException('A written rationale is required to override a gate.');
        }

        $gate->update([
            'status' => GateStatus::Overridden,
            'decision' => 'human',
            'decided_by' => $user->id,
            'decided_at' => now(),
            'override_rationale' => $rationale,
        ]);

        return $gate->refresh();
    }

    /**
     * Whether work behind a gate may proceed. Always true when gating is off.
     */
    public function mayProceed(Study $study, GateStage $stage, string $gateKey = 'default'): bool
    {
        if (! $this->gatingEnabled()) {
            return true;
        }

        $gate = $this->find($study, $stage, $gateKey);

        return $gate !== null && $gate->status->clears();
    }

    /**
     * Enforce a gate at a tool boundary — throws unless the gate has cleared.
     */
    public function assertMayRun(Study $study, GateStage $stage, string $gateKey = 'default'): void
    {
        if ($this->mayProceed($study, $stage, $gateKey)) {
            return;
        }

        $gate = $this->find($study, $stage, $gateKey);
        $metrics = is_array($gate?->metrics_json) ? $gate->metrics_json : [];
        $reasons = is_array($metrics['reasons'] ?? null)
            ? implode(' ', array_map('strval', $metrics['reasons']))
            : '';

        throw new GateBlockedException(
            $stage,
            trim(sprintf('Study gate "%s" has not cleared. %s', $stage->value, $reasons)),
        );
    }

    /**
     * Evaluate the estimation-derived gates (S5 study diagnostics, S6 empirical
     * calibration) from a normalized estimation result.
     *
     * @param  array<string, mixed>  $resultJson
     * @return list<StudyGate>
     */
    public function evaluateEstimationGates(Study $study, array $resultJson): array
    {
        $ps = is_array($resultJson['propensity_score'] ?? null) ? $resultJson['propensity_score'] : [];
        $gates = [
            $this->evaluate($study, GateStage::StudyDiagnostics, [
                'ps_auc' => $ps['auc'] ?? null,
                'max_smd_after' => $ps['max_smd_after'] ?? null,
                'equipoise' => $ps['equipoise'] ?? null,
            ]),
        ];

        $calibration = is_array($resultJson['calibration'] ?? null) ? $resultJson['calibration'] : null;
        $gates[] = $this->evaluate($study, GateStage::EstimationCalibration, [
            'status' => $calibration['status'] ?? 'missing',
            'informative_negative_controls' => $calibration['informative_negative_controls'] ?? 0,
        ]);

        return $gates;
    }

    /**
     * Blind an estimation result if it belongs to a study whose S5 gate has not
     * cleared. Standalone analyses (no study) and disabled gating pass through.
     *
     * @param  array<string, mixed>  $resultJson
     * @param  class-string  $analysisType
     * @return array<string, mixed>
     */
    public function blindEstimationIfGated(array $resultJson, string $analysisType, int $analysisId): array
    {
        if (! $this->gatingEnabled()) {
            return $resultJson;
        }

        $study = StudyAnalysis::query()
            ->where('analysis_type', $analysisType)
            ->where('analysis_id', $analysisId)
            ->first()?->study;

        if ($study === null || $this->mayProceed($study, GateStage::StudyDiagnostics)) {
            return $resultJson;
        }

        return EstimationResultNormalizer::blind($resultJson);
    }

    public function find(Study $study, GateStage $stage, string $gateKey = 'default'): ?StudyGate
    {
        return StudyGate::query()
            ->where('study_id', $study->id)
            ->where('stage', $stage->value)
            ->where('gate_key', $gateKey)
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function thresholdsFor(GateStage $stage): array
    {
        $all = config('studies.gate_thresholds', []);
        $stageThresholds = is_array($all) ? ($all[$stage->value] ?? []) : [];

        return is_array($stageThresholds) ? $stageThresholds : [];
    }
}
