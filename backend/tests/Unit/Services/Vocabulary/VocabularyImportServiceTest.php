<?php

declare(strict_types=1);

use App\Services\Vocabulary\VocabularyImportService;

function writeVocabularyFixtureDirectory(array $overrides = []): string
{
    $directory = sys_get_temp_dir().'/parthenon_vocab_service_'.bin2hex(random_bytes(6));
    mkdir($directory, 0700, true);
    foreach (VocabularyImportService::TABLES as $config) {
        $contents = implode("\t", $config['columns'])."\n";
        $contents .= $overrides[$config['file']] ?? implode("\t", array_fill(0, count($config['columns']), 'fixture'))."\n";
        file_put_contents($directory.'/'.$config['file'], $contents);
    }

    return $directory;
}

function removeVocabularyFixtureDirectory(string $directory): void
{
    foreach (glob($directory.'/*') ?: [] as $file) {
        unlink($file);
    }
    rmdir($directory);
}

test('inspector validates the singular OMOP file set and records hashes', function () {
    $directory = writeVocabularyFixtureDirectory();
    try {
        $report = (new VocabularyImportService)->inspectDirectory($directory);
    } finally {
        removeVocabularyFixtureDirectory($directory);
    }

    expect($report)->toHaveCount(9)
        ->and($report['CONCEPT.csv']['rows'])->toBe(1)
        ->and($report['CONCEPT.csv']['sha256'])->toHaveLength(64);
});

test('inspector fails closed when a required vocabulary file is omitted', function () {
    $directory = writeVocabularyFixtureDirectory();
    unlink($directory.'/CONCEPT_RELATIONSHIP.csv');
    try {
        expect(fn () => (new VocabularyImportService)->inspectDirectory($directory))
            ->toThrow(RuntimeException::class, 'CONCEPT_RELATIONSHIP.csv');
    } finally {
        removeVocabularyFixtureDirectory($directory);
    }
});

test('inspector rejects a changed header before any database operation', function () {
    $directory = writeVocabularyFixtureDirectory([
        'CONCEPT.csv' => "1\tbad\n",
    ]);
    file_put_contents($directory.'/CONCEPT.csv', "concepts_id\twrong\n1\tbad\n");
    try {
        expect(fn () => (new VocabularyImportService)->inspectDirectory($directory))
            ->toThrow(RuntimeException::class, 'Unexpected header in CONCEPT.csv');
    } finally {
        removeVocabularyFixtureDirectory($directory);
    }
});

test('inspector counts a final row even when the file has no trailing newline', function () {
    $directory = writeVocabularyFixtureDirectory();
    $concept = $directory.'/CONCEPT.csv';
    file_put_contents($concept, rtrim((string) file_get_contents($concept), "\n"));
    try {
        $report = (new VocabularyImportService)->inspectDirectory($directory);
    } finally {
        removeVocabularyFixtureDirectory($directory);
    }

    expect($report['CONCEPT.csv']['rows'])->toBe(1);
});
