<?php

/**
 * Static audit of all migration files for idempotency and rollback safety.
 *
 * This does NOT execute migrations — it reads file contents and flags
 * common patterns that break idempotent rollback/re-run behavior.
 */
$migrationsPath = __DIR__.'/../../../database/migrations';

/**
 * Helper: read a migration file and split into up() and down() method bodies.
 *
 * Returns ['up' => string|null, 'down' => string|null, 'full' => string].
 */
function extractMethodBodies(string $filePath): array
{
    $content = file_get_contents($filePath);

    $extractBody = function (string $methodName) use ($content): ?string {
        // Match "function up(" or "function down(" and grab everything until
        // the matching closing brace at the same nesting level.
        $pattern = '/function\s+'.$methodName.'\s*\([^)]*\)[^{]*\{/s';
        if (! preg_match($pattern, $content, $match, PREG_OFFSET_CAPTURE)) {
            return null;
        }

        $braceStart = $match[0][1] + strlen($match[0][0]);
        $depth = 1;
        $i = $braceStart;
        $len = strlen($content);

        while ($i < $len && $depth > 0) {
            if ($content[$i] === '{') {
                $depth++;
            } elseif ($content[$i] === '}') {
                $depth--;
            }
            $i++;
        }

        return substr($content, $braceStart, $i - $braceStart - 1);
    };

    return [
        'up' => $extractBody('up'),
        'down' => $extractBody('down'),
        'full' => $content,
    ];
}

// ---------------------------------------------------------------------------
// Test 1: All migrations have both up() and down() methods
// ---------------------------------------------------------------------------
it('all migrations have both up and down methods', function () use ($migrationsPath) {
    $files = glob($migrationsPath.'/*.php');
    expect($files)->not->toBeEmpty('No migration files found');

    // Patterns where missing down() is acceptable (CDM/vocab DDL managed outside Laravel)
    $exemptPatterns = [
        '_create_omop_',
        '_create_vocab_',
        '_create_cdm_',
        '_create_eunomia_',
    ];

    $missingUp = [];
    $missingDown = [];
    $exemptMissingDown = [];

    foreach ($files as $file) {
        $basename = basename($file);
        $content = file_get_contents($file);

        if (! preg_match('/function\s+up\s*\(/', $content)) {
            $missingUp[] = $basename;
        }

        if (! preg_match('/function\s+down\s*\(/', $content)) {
            $isExempt = false;
            foreach ($exemptPatterns as $pattern) {
                if (str_contains($basename, $pattern)) {
                    $isExempt = true;
                    break;
                }
            }

            if ($isExempt) {
                $exemptMissingDown[] = $basename;
            } else {
                $missingDown[] = $basename;
            }
        }
    }

    // Missing up() is always a hard fail
    expect($missingUp)->toBeEmpty(
        "Migrations missing up(): \n  - ".implode("\n  - ", $missingUp)
    );

    // Log exempt files as informational
    if (count($exemptMissingDown) > 0) {
        echo "\n  [INFO] ".count($exemptMissingDown)." CDM/vocab migrations exempt from down() requirement (managed outside Laravel).\n";
    }

    // Non-exempt missing down() is a hard fail
    expect($missingDown)->toBeEmpty(
        "Migrations missing down() (non-exempt): \n  - ".implode("\n  - ", $missingDown)
    );
});

// ---------------------------------------------------------------------------
// Test 2: No migration uses dropIfExists in up() — warns but does not fail
// ---------------------------------------------------------------------------
it('flags dropIfExists usage in up() as warnings', function () use ($migrationsPath) {
    $files = glob($migrationsPath.'/*.php');
    $warnings = [];

    foreach ($files as $file) {
        $bodies = extractMethodBodies($file);

        if ($bodies['up'] === null) {
            continue;
        }

        // Check for Schema::dropIfExists or raw dropIfExists calls in up()
        if (preg_match_all('/dropIfExists\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)/', $bodies['up'], $matches)) {
            foreach ($matches[1] as $table) {
                $warnings[] = basename($file).": dropIfExists('{$table}') in up()";
            }
        }
    }

    if (count($warnings) > 0) {
        echo "\n  [WARNING] ".count($warnings)." dropIfExists() calls found in up() methods (may silently destroy data):\n";
        foreach ($warnings as $w) {
            echo "    - {$w}\n";
        }
    }

    // This test always passes — it's advisory only
    expect(true)->toBeTrue();
});

// ---------------------------------------------------------------------------
// Test 3: No migration uses raw DROP TABLE without IF EXISTS in down()
// ---------------------------------------------------------------------------
it('no migration contains raw DROP TABLE without IF EXISTS in down()', function () use ($migrationsPath) {
    $files = glob($migrationsPath.'/*.php');
    $violations = [];

    foreach ($files as $file) {
        $bodies = extractMethodBodies($file);

        if ($bodies['down'] === null) {
            continue;
        }

        // Match raw SQL DROP TABLE that does NOT include IF EXISTS
        // Pattern: DROP TABLE followed by a table name, but NOT preceded by IF EXISTS
        if (preg_match_all('/\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS)/i', $bodies['down'], $matches)) {
            $violations[] = basename($file).': raw DROP TABLE without IF EXISTS in down()';
        }
    }

    expect($violations)->toBeEmpty(
        "Migrations with unsafe DROP TABLE in down(): \n  - ".implode("\n  - ", $violations)
    );
});

// ---------------------------------------------------------------------------
// Test 4: No migration uses $guarded = [] (HIGHSEC violation)
// ---------------------------------------------------------------------------
it('no migration uses $guarded = []', function () use ($migrationsPath) {
    $files = glob($migrationsPath.'/*.php');
    $violations = [];

    foreach ($files as $file) {
        $content = file_get_contents($file);

        if (preg_match('/\$guarded\s*=\s*\[\s*\]/', $content)) {
            $violations[] = basename($file);
        }
    }

    expect($violations)->toBeEmpty(
        "HIGHSEC VIOLATION — migrations with \$guarded = []: \n  - ".implode("\n  - ", $violations)
    );
});

// ---------------------------------------------------------------------------
// Summary: total migrations audited
// ---------------------------------------------------------------------------
it('reports migration audit summary', function () use ($migrationsPath) {
    $files = glob($migrationsPath.'/*.php');
    $total = count($files);

    $withUp = 0;
    $withDown = 0;
    $dropIfExistsInUp = 0;

    foreach ($files as $file) {
        $content = file_get_contents($file);

        if (preg_match('/function\s+up\s*\(/', $content)) {
            $withUp++;
        }
        if (preg_match('/function\s+down\s*\(/', $content)) {
            $withDown++;
        }

        $bodies = extractMethodBodies($file);
        if ($bodies['up'] !== null && preg_match('/dropIfExists/', $bodies['up'])) {
            $dropIfExistsInUp++;
        }
    }

    echo "\n  === Migration Idempotency Audit ===\n";
    echo "  Total migrations:        {$total}\n";
    echo "  With up():               {$withUp}\n";
    echo "  With down():             {$withDown}\n";
    echo "  dropIfExists in up():    {$dropIfExistsInUp}\n";
    echo "  ================================\n";

    expect($total)->toBeGreaterThan(0);
});
