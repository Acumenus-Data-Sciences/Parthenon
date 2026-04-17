<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Phase 13 — endpoint portability classification.
 *
 * Distinguishes how a FinnGen endpoint resolves on non-Finnish OMOP CDMs:
 *   - UNIVERSAL    — every qualifying-event vocab group resolves to a standard concept
 *   - PARTIAL      — at least one group resolves, at least one is Finnish-only
 *   - FINLAND_ONLY — no group resolves outside Finnish source vocabularies
 *
 * The string values are stored in app.cohort_definitions.coverage_profile
 * and consumed by the React endpoint browser. Do NOT rename without
 * updating Plan 02 migration value list AND the frontend type union.
 *
 * Per ADR-002 + CONTEXT.md D-05 / D-06.
 */
enum CoverageProfile: string
{
    case UNIVERSAL = 'universal';
    case PARTIAL = 'partial';
    case FINLAND_ONLY = 'finland_only';

    public function label(): string
    {
        return match ($this) {
            self::UNIVERSAL => 'Universal',
            self::PARTIAL => 'Partial',
            self::FINLAND_ONLY => 'Finland-only',
        };
    }

    /**
     * @return list<string>
     */
    public static function allValues(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
