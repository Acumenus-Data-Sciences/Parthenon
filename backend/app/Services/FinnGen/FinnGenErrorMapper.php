<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

/**
 * Pure lookup table mapping R-side pre-classified error categories to Laravel
 * wrapper codes + translated user messages. See spec §5.5 for rationale — PHP
 * does no regex matching on R error messages; classification happens in R.
 *
 * Adding a new category = one R branch in common.R + one entry here + one
 * translation key in lang/en/finngen.php.
 */
class FinnGenErrorMapper
{
    /**
     * Category → translation key. Lowercased to match Laravel lang file
     * convention. Unknown categories fall through to 'unknown'.
     *
     * @var array<string, string>
     */
    public const DARKSTAR_R_CATEGORIES = [
        'DB_CONNECTION_FAILED' => 'finngen.errors.db_connection_failed',
        'DB_SCHEMA_MISMATCH' => 'finngen.errors.db_schema_mismatch',
        'OUT_OF_MEMORY' => 'finngen.errors.out_of_memory',
        'PACKAGE_NOT_LOADED' => 'finngen.errors.package_not_loaded',
        'ANALYSIS_EXCEPTION' => 'finngen.errors.analysis_exception',
        'MIRAI_TASK_CRASHED' => 'finngen.errors.mirai_task_crashed',
        'TIMEOUT' => 'finngen.errors.timeout',
        'DISK_FULL' => 'finngen.errors.disk_full',
        'CANCELED' => 'finngen.errors.canceled',
    ];

    public const FALLBACK_KEY = 'finngen.errors.unknown';

    public function userMessage(string $darkstarCategory): string
    {
        $key = self::DARKSTAR_R_CATEGORIES[$darkstarCategory] ?? self::FALLBACK_KEY;

        return (string) __($key);
    }

    public function wrapperCode(string $darkstarCategory): string
    {
        return 'DARKSTAR_R_'.$darkstarCategory;
    }

    /**
     * @return list<string>
     */
    public function knownCategories(): array
    {
        return array_keys(self::DARKSTAR_R_CATEGORIES);
    }
}
