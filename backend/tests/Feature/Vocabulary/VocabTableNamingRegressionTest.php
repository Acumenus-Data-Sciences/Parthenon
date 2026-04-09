<?php

/*
 * Regression guard for OMOP CDM v5.4 vocabulary table naming.
 *
 * The OMOP CDM v5.4 vocabulary tables in `parthenon.vocab` are ALL singular:
 *   concept, concept_ancestor, concept_relationship, concept_synonym,
 *   drug_strength, source_to_concept_map, relationship, domain, vocabulary.
 *
 * Historical bug (fixed 2026-04-08): several services, commands, and the
 * Python AI service referenced the plural forms (`vocab.concepts`,
 * `vocab.concept_ancestors`, etc.) in raw SQL strings. Those table names do
 * not exist — the queries silently failed at runtime and the errors were
 * swallowed by broad try/except blocks. Callers returned empty results.
 *
 * This test walks the backend source tree and the Python AI service source
 * tree and fails if any forbidden plural reference reappears. It is a pure
 * filesystem scan, no DB required.
 *
 * If you need to add a new plural OMOP table to an allowlist (e.g. an
 * intentional per-CDM table like `concept_embeddings`), extend $allowlist.
 */

use Symfony\Component\Finder\Finder;

/**
 * Forbidden plural references. Matches the schema-qualified form only
 * (e.g. `vocab.concepts`) to avoid false positives on unrelated words.
 *
 * @return list<string>
 */
function forbiddenPluralVocabPatterns(): array
{
    return [
        'vocab.concepts',
        'vocab.concept_ancestors',
        'vocab.concept_relationships',
        'vocab.concept_synonyms',
        'vocab.drug_strengths',
        'vocab.source_to_concept_maps',
    ];
}

/**
 * Files that are allowed to contain the forbidden strings — typically
 * this test itself and any historical devlog/spec that documents the bug.
 *
 * @return list<string>
 */
function vocabNamingAllowlist(): array
{
    return [
        // This regression test itself mentions the forbidden strings by
        // name in the $patterns array above.
        'tests/Feature/Vocabulary/VocabTableNamingRegressionTest.php',
        // The ConceptSet resolver test contains negative assertions
        // (`->not->toContain('vocab.concepts')`) that deliberately hold the
        // forbidden strings as literals to guard the fix.
        'tests/Unit/Services/ConceptSet/ConceptSetResolverServiceTest.php',
    ];
}

it('has no backend PHP source referencing the forbidden plural OMOP vocab tables', function () {
    $patterns = forbiddenPluralVocabPatterns();
    $allowlist = vocabNamingAllowlist();
    $backendRoot = base_path();

    $finder = (new Finder)
        ->files()
        ->in([
            $backendRoot.'/app',
            $backendRoot.'/database/migrations',
            $backendRoot.'/tests',
        ])
        ->name('*.php');

    $offenders = [];

    foreach ($finder as $file) {
        $relative = ltrim(str_replace($backendRoot, '', $file->getRealPath()), '/');

        if (in_array($relative, $allowlist, true)) {
            continue;
        }

        $contents = $file->getContents();

        foreach ($patterns as $pattern) {
            if (str_contains($contents, $pattern)) {
                $offenders[] = "{$relative}: contains '{$pattern}'";
            }
        }
    }

    expect($offenders)->toBe([], implode("\n", $offenders));
});

it('has no AI service python source referencing the forbidden plural OMOP vocab tables', function () {
    $patterns = forbiddenPluralVocabPatterns();
    $aiRoot = base_path('../ai');

    if (! is_dir($aiRoot)) {
        // AI service not present in this checkout — nothing to scan.
        expect(true)->toBeTrue();

        return;
    }

    $finder = (new Finder)
        ->files()
        ->in($aiRoot)
        ->name('*.py')
        ->exclude(['__pycache__', '.venv', 'venv', '.mypy_cache', '.pytest_cache']);

    $offenders = [];

    foreach ($finder as $file) {
        $relative = 'ai/'.ltrim(str_replace(realpath($aiRoot), '', $file->getRealPath()), '/');
        $contents = $file->getContents();

        foreach ($patterns as $pattern) {
            if (str_contains($contents, $pattern)) {
                $offenders[] = "{$relative}: contains '{$pattern}'";
            }
        }
    }

    expect($offenders)->toBe([], implode("\n", $offenders));
});
