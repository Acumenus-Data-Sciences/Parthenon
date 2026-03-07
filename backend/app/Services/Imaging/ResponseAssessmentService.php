<?php

namespace App\Services\Imaging;

use App\Models\App\ImagingMeasurement;
use App\Models\App\ImagingResponseAssessment;
use App\Models\App\ImagingStudy;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Automated response assessment engine.
 *
 * Computes treatment response categories based on established clinical criteria:
 * - RECIST 1.1: Sum of longest diameters for solid tumors
 * - CT Severity: COVID-19 CT severity index (0-25 scale)
 * - Deauville/Lugano: PET response for lymphoma (SUVmax-based)
 * - RANO: Brain tumor response (bidimensional measurements)
 *
 * @see https://recist.eortc.org/ — RECIST 1.1 guidelines
 */
class ResponseAssessmentService
{
    /**
     * Compute response assessment for a patient at a given study timepoint.
     *
     * @return array{response_category: string, criteria_type: string, rationale: string, baseline_value: float|null, nadir_value: float|null, current_value: float|null, percent_change_from_baseline: float|null, percent_change_from_nadir: float|null}
     */
    public function assessResponse(int $personId, int $currentStudyId, string $criteriaType = 'auto'): array
    {
        $currentStudy = ImagingStudy::findOrFail($currentStudyId);

        if ($criteriaType === 'auto') {
            $criteriaType = $this->inferCriteriaType($currentStudy);
        }

        return match ($criteriaType) {
            'recist' => $this->assessRecist($personId, $currentStudy),
            'ct_severity' => $this->assessCtSeverity($personId, $currentStudy),
            'deauville' => $this->assessDeauville($personId, $currentStudy),
            'rano' => $this->assessRano($personId, $currentStudy),
            default => $this->assessRecist($personId, $currentStudy),
        };
    }

    /**
     * Compute and persist a response assessment.
     */
    public function computeAndSave(int $personId, int $currentStudyId, ?int $baselineStudyId = null, string $criteriaType = 'auto'): ImagingResponseAssessment
    {
        $result = $this->assessResponse($personId, $currentStudyId, $criteriaType);

        // Find or auto-detect baseline study
        if (! $baselineStudyId) {
            $baselineStudyId = $this->findBaselineStudy($personId, $currentStudyId);
        }

        return ImagingResponseAssessment::create([
            'person_id' => $personId,
            'criteria_type' => $result['criteria_type'],
            'assessment_date' => now()->format('Y-m-d'),
            'baseline_study_id' => $baselineStudyId ?? $currentStudyId,
            'current_study_id' => $currentStudyId,
            'baseline_value' => $result['baseline_value'],
            'nadir_value' => $result['nadir_value'],
            'current_value' => $result['current_value'],
            'percent_change_from_baseline' => $result['percent_change_from_baseline'],
            'percent_change_from_nadir' => $result['percent_change_from_nadir'],
            'response_category' => $result['response_category'],
            'rationale' => $result['rationale'],
        ]);
    }

    /**
     * RECIST 1.1 — Sum of Longest Diameters.
     *
     * CR: All target lesions disappeared
     * PR: >= 30% decrease from baseline SLD
     * PD: >= 20% increase from nadir SLD (and >= 5mm absolute increase)
     * SD: Neither sufficient decrease nor increase
     */
    private function assessRecist(int $personId, ImagingStudy $currentStudy): array
    {
        // Get all target lesion measurements for this patient
        $allMeasurements = ImagingMeasurement::where('person_id', $personId)
            ->where('measurement_type', 'longest_diameter')
            ->where('is_target_lesion', true)
            ->orderBy('measured_at')
            ->get();

        if ($allMeasurements->isEmpty()) {
            return $this->noDataResult('recist', 'No target lesion measurements found');
        }

        // Group by study_id to get SLD per timepoint
        $sldByStudy = $allMeasurements->groupBy('study_id')
            ->map(fn (Collection $group) => $group->sum('value_as_number'));

        $currentSld = $sldByStudy->get($currentStudy->id);
        if ($currentSld === null) {
            return $this->noDataResult('recist', 'No target lesion measurements for current study');
        }

        // Baseline = first study's SLD
        $baselineSld = $sldByStudy->first();
        // Nadir = minimum SLD across all prior timepoints
        $nadirSld = $sldByStudy->min();

        $pctFromBaseline = $baselineSld > 0 ? (($currentSld - $baselineSld) / $baselineSld) * 100 : null;
        $pctFromNadir = $nadirSld > 0 ? (($currentSld - $nadirSld) / $nadirSld) * 100 : null;
        $absIncreaseFromNadir = $currentSld - $nadirSld;

        // RECIST classification
        if ($currentSld == 0) {
            $category = 'CR';
            $rationale = 'Complete Response: All target lesions have disappeared (SLD = 0)';
        } elseif ($pctFromBaseline !== null && $pctFromBaseline <= -30) {
            $category = 'PR';
            $rationale = sprintf('Partial Response: %.1f%% decrease from baseline SLD (threshold: -30%%)', $pctFromBaseline);
        } elseif ($pctFromNadir !== null && $pctFromNadir >= 20 && $absIncreaseFromNadir >= 5) {
            $category = 'PD';
            $rationale = sprintf('Progressive Disease: %.1f%% increase from nadir (threshold: +20%%) with %.1fmm absolute increase (threshold: 5mm)', $pctFromNadir, $absIncreaseFromNadir);
        } else {
            $category = 'SD';
            $rationale = sprintf('Stable Disease: %.1f%% change from baseline, %.1f%% change from nadir (insufficient for PR or PD)', $pctFromBaseline ?? 0, $pctFromNadir ?? 0);
        }

        return [
            'response_category' => $category,
            'criteria_type' => 'recist',
            'rationale' => $rationale,
            'baseline_value' => $baselineSld,
            'nadir_value' => $nadirSld,
            'current_value' => $currentSld,
            'percent_change_from_baseline' => $pctFromBaseline ? round($pctFromBaseline, 2) : null,
            'percent_change_from_nadir' => $pctFromNadir ? round($pctFromNadir, 2) : null,
        ];
    }

    /**
     * COVID CT Severity Index (0-25 scale).
     *
     * Improvement: >= 25% decrease from peak severity
     * Worsening:   >= 25% increase from nadir
     * Stable:      Neither
     */
    private function assessCtSeverity(int $personId, ImagingStudy $currentStudy): array
    {
        $allScores = ImagingMeasurement::where('person_id', $personId)
            ->where('measurement_type', 'ct_severity_score')
            ->orderBy('measured_at')
            ->get();

        if ($allScores->isEmpty()) {
            // Try opacity_score as fallback
            $allScores = ImagingMeasurement::where('person_id', $personId)
                ->whereIn('measurement_type', ['opacity_score', 'ground_glass_extent'])
                ->orderBy('measured_at')
                ->get();
        }

        if ($allScores->isEmpty()) {
            return $this->noDataResult('ct_severity', 'No CT severity or opacity measurements found');
        }

        $scoresByStudy = $allScores->groupBy('study_id')
            ->map(fn (Collection $group) => $group->avg('value_as_number'));

        $current = $scoresByStudy->get($currentStudy->id);
        if ($current === null) {
            return $this->noDataResult('ct_severity', 'No severity measurements for current study');
        }

        $baseline = $scoresByStudy->first();
        $peak = $scoresByStudy->max();
        $nadir = $scoresByStudy->min();

        $pctFromBaseline = $baseline > 0 ? (($current - $baseline) / $baseline) * 100 : null;
        $pctFromPeak = $peak > 0 ? (($current - $peak) / $peak) * 100 : null;

        if ($current == 0) {
            $category = 'CR';
            $rationale = 'Complete Resolution: CT severity score is 0';
        } elseif ($pctFromPeak !== null && $pctFromPeak <= -25) {
            $category = 'PR';
            $rationale = sprintf('Improvement: %.1f%% decrease from peak severity (threshold: -25%%)', $pctFromPeak);
        } elseif ($pctFromBaseline !== null && $pctFromBaseline >= 25) {
            $category = 'PD';
            $rationale = sprintf('Worsening: %.1f%% increase from baseline (threshold: +25%%)', $pctFromBaseline);
        } else {
            $category = 'SD';
            $rationale = sprintf('Stable: %.1f%% change from baseline, %.1f%% change from peak', $pctFromBaseline ?? 0, $pctFromPeak ?? 0);
        }

        return [
            'response_category' => $category,
            'criteria_type' => 'ct_severity',
            'rationale' => $rationale,
            'baseline_value' => $baseline,
            'nadir_value' => $nadir,
            'current_value' => $current,
            'percent_change_from_baseline' => $pctFromBaseline ? round($pctFromBaseline, 2) : null,
            'percent_change_from_nadir' => $pctFromPeak ? round($pctFromPeak, 2) : null,
        ];
    }

    /**
     * Deauville / Lugano — PET Response.
     *
     * Uses SUVmax relative to liver SUVmax (simplified: uses absolute thresholds).
     * CR: SUVmax <= mediastinal background (~2.5)
     * PR: >= 25% decrease in SUVmax
     * PD: >= 25% increase in SUVmax or new lesions
     * SD: Neither
     */
    private function assessDeauville(int $personId, ImagingStudy $currentStudy): array
    {
        $suvMeasurements = ImagingMeasurement::where('person_id', $personId)
            ->where('measurement_type', 'suvmax')
            ->orderBy('measured_at')
            ->get();

        if ($suvMeasurements->isEmpty()) {
            return $this->noDataResult('deauville', 'No SUVmax measurements found');
        }

        $suvByStudy = $suvMeasurements->groupBy('study_id')
            ->map(fn (Collection $group) => $group->max('value_as_number'));

        $current = $suvByStudy->get($currentStudy->id);
        if ($current === null) {
            return $this->noDataResult('deauville', 'No SUVmax measurement for current study');
        }

        $baseline = $suvByStudy->first();
        $nadir = $suvByStudy->min();
        $pctFromBaseline = $baseline > 0 ? (($current - $baseline) / $baseline) * 100 : null;

        if ($current <= 2.5) {
            $category = 'CR';
            $rationale = sprintf('Complete Metabolic Response: SUVmax %.1f <= mediastinal threshold (2.5)', $current);
        } elseif ($pctFromBaseline !== null && $pctFromBaseline <= -25) {
            $category = 'PR';
            $rationale = sprintf('Partial Metabolic Response: %.1f%% decrease in SUVmax (threshold: -25%%)', $pctFromBaseline);
        } elseif ($pctFromBaseline !== null && $pctFromBaseline >= 25) {
            $category = 'PD';
            $rationale = sprintf('Progressive Metabolic Disease: %.1f%% increase in SUVmax (threshold: +25%%)', $pctFromBaseline);
        } else {
            $category = 'SD';
            $rationale = sprintf('Stable Metabolic Disease: %.1f%% change in SUVmax', $pctFromBaseline ?? 0);
        }

        return [
            'response_category' => $category,
            'criteria_type' => 'deauville',
            'rationale' => $rationale,
            'baseline_value' => $baseline,
            'nadir_value' => $nadir,
            'current_value' => $current,
            'percent_change_from_baseline' => $pctFromBaseline ? round($pctFromBaseline, 2) : null,
            'percent_change_from_nadir' => null,
        ];
    }

    /**
     * RANO — Brain Tumor Response (simplified bidimensional).
     *
     * Uses product of longest × perpendicular diameter.
     * CR: No measurable disease
     * PR: >= 50% decrease in bidimensional product
     * PD: >= 25% increase in bidimensional product
     * SD: Neither
     */
    private function assessRano(int $personId, ImagingStudy $currentStudy): array
    {
        $longestDiam = ImagingMeasurement::where('person_id', $personId)
            ->where('measurement_type', 'longest_diameter')
            ->orderBy('measured_at')
            ->get()
            ->groupBy('study_id')
            ->map(fn (Collection $g) => $g->max('value_as_number'));

        $perpDiam = ImagingMeasurement::where('person_id', $personId)
            ->where('measurement_type', 'perpendicular_diameter')
            ->orderBy('measured_at')
            ->get()
            ->groupBy('study_id')
            ->map(fn (Collection $g) => $g->max('value_as_number'));

        // Compute bidimensional product per study
        $products = $longestDiam->intersectByKeys($perpDiam)
            ->map(fn ($longest, $studyId) => $longest * $perpDiam[$studyId]);

        if ($products->isEmpty()) {
            return $this->noDataResult('rano', 'No bidimensional measurements found (need longest + perpendicular diameter)');
        }

        $current = $products->get($currentStudy->id);
        if ($current === null) {
            return $this->noDataResult('rano', 'No bidimensional measurement for current study');
        }

        $baseline = $products->first();
        $nadir = $products->min();
        $pctFromBaseline = $baseline > 0 ? (($current - $baseline) / $baseline) * 100 : null;

        if ($current == 0) {
            $category = 'CR';
            $rationale = 'Complete Response: No measurable enhancing disease';
        } elseif ($pctFromBaseline !== null && $pctFromBaseline <= -50) {
            $category = 'PR';
            $rationale = sprintf('Partial Response: %.1f%% decrease in bidimensional product (threshold: -50%%)', $pctFromBaseline);
        } elseif ($pctFromBaseline !== null && $pctFromBaseline >= 25) {
            $category = 'PD';
            $rationale = sprintf('Progressive Disease: %.1f%% increase in bidimensional product (threshold: +25%%)', $pctFromBaseline);
        } else {
            $category = 'SD';
            $rationale = sprintf('Stable Disease: %.1f%% change in bidimensional product', $pctFromBaseline ?? 0);
        }

        return [
            'response_category' => $category,
            'criteria_type' => 'rano',
            'rationale' => $rationale,
            'baseline_value' => $baseline,
            'nadir_value' => $nadir,
            'current_value' => $current,
            'percent_change_from_baseline' => $pctFromBaseline ? round($pctFromBaseline, 2) : null,
            'percent_change_from_nadir' => null,
        ];
    }

    /**
     * Infer the best criteria type from study characteristics.
     */
    private function inferCriteriaType(ImagingStudy $study): string
    {
        $modality = $study->modality;
        $description = strtolower($study->study_description ?? '');
        $bodyPart = strtoupper($study->body_part_examined ?? '');

        if (str_contains($description, 'covid') || str_contains($description, 'lung covid')) {
            return 'ct_severity';
        }

        if ($modality === 'PT') {
            return 'deauville';
        }

        if ($modality === 'MR' && in_array($bodyPart, ['HEAD', 'BRAIN'], true)) {
            return 'rano';
        }

        return 'recist';
    }

    /**
     * Find the earliest study for this patient as the baseline.
     */
    private function findBaselineStudy(int $personId, int $currentStudyId): ?int
    {
        $baseline = ImagingStudy::where('person_id', $personId)
            ->where('id', '!=', $currentStudyId)
            ->orderBy('study_date')
            ->value('id');

        return $baseline;
    }

    /**
     * Return a no-data result with NE (Not Evaluable) category.
     *
     * @return array{response_category: string, criteria_type: string, rationale: string, baseline_value: null, nadir_value: null, current_value: null, percent_change_from_baseline: null, percent_change_from_nadir: null}
     */
    private function noDataResult(string $criteriaType, string $rationale): array
    {
        return [
            'response_category' => 'NE',
            'criteria_type' => $criteriaType,
            'rationale' => $rationale,
            'baseline_value' => null,
            'nadir_value' => null,
            'current_value' => null,
            'percent_change_from_baseline' => null,
            'percent_change_from_nadir' => null,
        ];
    }
}
