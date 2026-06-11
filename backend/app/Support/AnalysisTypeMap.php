<?php

namespace App\Support;

use App\Models\App\Characterization;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;

/**
 * Single source of truth for analysis-type identity across the study pipeline.
 *
 * The polymorphic `analysis_type` column stores the fully-qualified class name
 * (e.g. App\Models\App\EstimationAnalysis), while the API and frontend speak in
 * short slugs (estimation, incidence_rate, …). Historically that translation was
 * duplicated in StudyAnalysis::toArray, StudyController::normalizeLatestExecution,
 * StudyService::addAnalysis and StudyService::EXECUTION_ORDER — and one copy
 * matched slugs against an FQCN input, silently no-op'ing. This map centralizes
 * the mapping so every caller agrees.
 */
final class AnalysisTypeMap
{
    /**
     * slug => fully-qualified class name. Order is the canonical execution order
     * (characterization first, evidence synthesis last).
     *
     * @var array<string, class-string>
     */
    public const SLUG_TO_CLASS = [
        'characterization' => Characterization::class,
        'incidence_rate' => IncidenceRateAnalysis::class,
        'pathway' => PathwayAnalysis::class,
        'estimation' => EstimationAnalysis::class,
        'prediction' => PredictionAnalysis::class,
        'sccs' => SccsAnalysis::class,
        'evidence_synthesis' => EvidenceSynthesisAnalysis::class,
    ];

    /**
     * Resolve a stored analysis_type (FQCN) — or an already-short slug — to its
     * short slug. Unknown values are returned unchanged so callers can decide
     * how to handle them.
     */
    public static function slug(string $analysisType): string
    {
        static $classToSlug = null;
        $classToSlug ??= array_flip(self::SLUG_TO_CLASS);

        return $classToSlug[$analysisType] ?? $analysisType;
    }

    /**
     * Resolve a short slug to its fully-qualified class name, or null if unknown.
     *
     * @return class-string|null
     */
    public static function class(string $slug): ?string
    {
        return self::SLUG_TO_CLASS[$slug] ?? null;
    }

    /**
     * @return array<string, class-string>
     */
    public static function validTypes(): array
    {
        return self::SLUG_TO_CLASS;
    }

    /**
     * Canonical execution order keyed by FQCN (lower = earlier).
     *
     * @return array<class-string, int>
     */
    public static function executionOrder(): array
    {
        $order = [];
        $i = 1;
        foreach (self::SLUG_TO_CLASS as $class) {
            $order[$class] = $i++;
        }

        return $order;
    }
}
