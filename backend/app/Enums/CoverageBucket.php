<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Phase 13.1 — endpoint coverage bucket classification.
 *
 * Paired with {@see CoverageProfile}: `coverage_profile` describes WHERE an endpoint
 * resolves (universal | partial | finland_only), `coverage_bucket` describes HOW
 * COMPLETELY its qualifying-event spec is mapped to standard concepts on the
 * target CDM.
 *
 *   - FULLY_MAPPED  — every token in qualifying_event_spec resolves to a standard concept
 *   - PARTIAL       — some tokens resolve, some do not
 *   - SPARSE        — a small fraction of tokens resolve (configurable threshold)
 *   - UNMAPPED      — no tokens resolve on the target CDM
 *   - CONTROL_ONLY  — endpoint resolves only via control/exclusion codes, not primary qualifying codes
 *
 * The string values are stored in finngen.endpoint_definitions.coverage_bucket
 * (VARCHAR(16) + CHECK constraint per Phase 13.1 D-04) and consumed by the React
 * endpoint browser. Per CLAUDE.md, enum cases are UPPERCASE. Values are UPPERCASE
 * to match the CHECK constraint written in the Wave 2 migration.
 */
enum CoverageBucket: string
{
    case FULLY_MAPPED = 'FULLY_MAPPED';
    case PARTIAL = 'PARTIAL';
    case SPARSE = 'SPARSE';
    case UNMAPPED = 'UNMAPPED';
    case CONTROL_ONLY = 'CONTROL_ONLY';

    public function label(): string
    {
        return match ($this) {
            self::FULLY_MAPPED => 'Fully mapped',
            self::PARTIAL => 'Partial',
            self::SPARSE => 'Sparse',
            self::UNMAPPED => 'Unmapped',
            self::CONTROL_ONLY => 'Control-only',
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
