<?php

declare(strict_types=1);

namespace App\Services\Analysis;

use App\DataTransferObjects\LabRangeDto;
use App\Enums\LabStatus;

final class LabStatusClassifier
{
    /**
     * Classify a numeric lab value against a reference range.
     *
     * Uses a simple 2× band-width heuristic for "Critical":
     *   band_width = high - low
     *   critical_buffer = band_width * 2.0
     *   value < low  - critical_buffer → Critical
     *   value > high + critical_buffer → Critical
     *
     * This is a rough panic-flag approximation, tunable if clinical
     * review finds it wrong. See spec §5 of the patient-labs-trend-chart
     * design for rationale.
     */
    public static function classify(float $value, ?LabRangeDto $range): LabStatus
    {
        if ($range === null) {
            return LabStatus::Unknown;
        }

        $bandWidth = $range->high - $range->low;
        $criticalBuffer = $bandWidth * 2.0;

        if ($value < $range->low - $criticalBuffer || $value > $range->high + $criticalBuffer) {
            return LabStatus::Critical;
        }
        if ($value < $range->low) {
            return LabStatus::Low;
        }
        if ($value > $range->high) {
            return LabStatus::High;
        }

        return LabStatus::Normal;
    }
}
