<?php

namespace App\Services\Analysis\Features;

interface FeatureBuilderInterface
{
    /**
     * Unique key identifying this feature type.
     */
    public function key(): string;

    /**
     * Human-readable label for this feature type.
     */
    public function label(): string;

    /**
     * Build SQL that computes features for cohort members.
     *
     * SQL should use {@param} placeholders for SqlRendererService.
     */
    public function buildSql(
        string $cdmSchema,
        string $vocabSchema,
        string $cohortTable,
        int $cohortDefinitionId,
        string $dialect,
    ): string;
}
