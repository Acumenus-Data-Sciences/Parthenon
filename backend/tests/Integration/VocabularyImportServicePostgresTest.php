<?php

declare(strict_types=1);

use App\Services\Vocabulary\VocabularyImportService;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;

function createVocabularyImportTarget(Connection $connection, string $schema): void
{
    $q = static fn (string $identifier): string => '"'.str_replace('"', '""', $identifier).'"';
    $s = $q($schema);
    $connection->unprepared(<<<SQL
        CREATE SCHEMA {$s};
        CREATE TABLE {$s}.vocabulary (vocabulary_id varchar PRIMARY KEY, vocabulary_name varchar NOT NULL, vocabulary_reference varchar, vocabulary_version varchar, vocabulary_concept_id bigint NOT NULL);
        CREATE TABLE {$s}.domain (domain_id varchar PRIMARY KEY, domain_name varchar NOT NULL, domain_concept_id bigint NOT NULL);
        CREATE TABLE {$s}.concept_class (concept_class_id varchar PRIMARY KEY, concept_class_name varchar NOT NULL, concept_class_concept_id bigint NOT NULL);
        CREATE TABLE {$s}.relationship (relationship_id varchar PRIMARY KEY, relationship_name varchar NOT NULL, is_hierarchical varchar NOT NULL, defines_ancestry varchar NOT NULL, reverse_relationship_id varchar NOT NULL, relationship_concept_id bigint NOT NULL);
        CREATE TABLE {$s}.concept (concept_id bigint PRIMARY KEY, concept_name varchar NOT NULL, domain_id varchar NOT NULL, vocabulary_id varchar NOT NULL, concept_class_id varchar NOT NULL, standard_concept varchar, concept_code varchar NOT NULL, valid_start_date date NOT NULL, valid_end_date date NOT NULL, invalid_reason varchar);
        CREATE TABLE {$s}.concept_relationship (concept_id_1 bigint NOT NULL, concept_id_2 bigint NOT NULL, relationship_id varchar NOT NULL, valid_start_date date NOT NULL, valid_end_date date NOT NULL, invalid_reason varchar, PRIMARY KEY (concept_id_1, concept_id_2, relationship_id));
        CREATE TABLE {$s}.concept_ancestor (ancestor_concept_id bigint NOT NULL, descendant_concept_id bigint NOT NULL, min_levels_of_separation integer NOT NULL, max_levels_of_separation integer NOT NULL, PRIMARY KEY (ancestor_concept_id, descendant_concept_id));
        CREATE TABLE {$s}.concept_synonym (concept_id bigint NOT NULL, concept_synonym_name varchar NOT NULL, language_concept_id bigint NOT NULL);
        CREATE TABLE {$s}.drug_strength (drug_concept_id bigint NOT NULL, ingredient_concept_id bigint NOT NULL, amount_value numeric, amount_unit_concept_id bigint, numerator_value numeric, numerator_unit_concept_id bigint, denominator_value numeric, denominator_unit_concept_id bigint, box_size integer, valid_start_date date NOT NULL, valid_end_date date NOT NULL, invalid_reason varchar);
        CREATE TABLE {$s}.concept_embedding_bge (concept_id bigint PRIMARY KEY REFERENCES {$s}.concept(concept_id) ON DELETE CASCADE, model varchar NOT NULL);
        CREATE TABLE {$s}.source_to_concept_map (source_concept_id bigint NOT NULL, target_concept_id bigint NOT NULL);
    SQL);
}

function createValidVocabularyPackage(string $conceptName = 'New master concept'): string
{
    $directory = sys_get_temp_dir().'/parthenon_vocab_pg_'.bin2hex(random_bytes(6));
    mkdir($directory, 0700, true);
    $rows = [
        'VOCABULARY.csv' => ['SNOMED', 'SNOMED', 'fixture', '2026-02-27', '1'],
        'DOMAIN.csv' => ['Condition', 'Condition', '1'],
        'CONCEPT_CLASS.csv' => ['Clinical', 'Clinical', '1'],
        'RELATIONSHIP.csv' => ['Is a', 'Is a', '1', '1', 'Subsumes', '1'],
        'CONCEPT.csv' => ['1', $conceptName, 'Condition', 'SNOMED', 'Clinical', 'S', 'MASTER-1', '2020-01-01', '2099-12-31', ''],
        'CONCEPT_RELATIONSHIP.csv' => ['1', '1', 'Is a', '2020-01-01', '2099-12-31', ''],
        'CONCEPT_ANCESTOR.csv' => ['1', '1', '0', '0'],
        'CONCEPT_SYNONYM.csv' => ['1', $conceptName, '1'],
        'DRUG_STRENGTH.csv' => ['1', '1', '', '', '', '', '', '', '', '2020-01-01', '2099-12-31', ''],
    ];
    foreach (VocabularyImportService::TABLES as $config) {
        file_put_contents(
            $directory.'/'.$config['file'],
            implode("\t", $config['columns'])."\n".implode("\t", $rows[$config['file']])."\n",
        );
    }

    return $directory;
}

function removeVocabularyPackage(string $directory): void
{
    foreach (glob($directory.'/*') ?: [] as $file) {
        unlink($file);
    }
    rmdir($directory);
}

test('staged import preserves omitted IRSF rows and only invalidates changed embeddings', function () {
    $connection = DB::connection('pgsql_testing');
    $schema = 'vocab_import_it_'.bin2hex(random_bytes(4));
    $directory = createValidVocabularyPackage();
    $backupDirectory = sys_get_temp_dir().'/parthenon_vocab_backup_'.bin2hex(random_bytes(6));
    mkdir($backupDirectory, 0700, true);
    file_put_contents($backupDirectory.'/toc.dat', 'verified test backup');
    createVocabularyImportTarget($connection, $schema);
    try {
        $connection->table($schema.'.vocabulary')->insert([
            ['vocabulary_id' => 'SNOMED', 'vocabulary_name' => 'SNOMED', 'vocabulary_reference' => 'old', 'vocabulary_version' => 'old', 'vocabulary_concept_id' => 1],
            ['vocabulary_id' => 'IRSF-NHS', 'vocabulary_name' => 'IRSF', 'vocabulary_reference' => 'local', 'vocabulary_version' => '1.0', 'vocabulary_concept_id' => 2000],
        ]);
        $connection->table($schema.'.domain')->insert(['domain_id' => 'Condition', 'domain_name' => 'Condition', 'domain_concept_id' => 1]);
        $connection->table($schema.'.concept_class')->insert(['concept_class_id' => 'Clinical', 'concept_class_name' => 'Clinical', 'concept_class_concept_id' => 1]);
        $connection->table($schema.'.relationship')->insert(['relationship_id' => 'Is a', 'relationship_name' => 'Is a', 'is_hierarchical' => '1', 'defines_ancestry' => '1', 'reverse_relationship_id' => 'Subsumes', 'relationship_concept_id' => 1]);
        $connection->table($schema.'.concept')->insert([
            ['concept_id' => 1, 'concept_name' => 'Old master concept', 'domain_id' => 'Condition', 'vocabulary_id' => 'SNOMED', 'concept_class_id' => 'Clinical', 'standard_concept' => 'S', 'concept_code' => 'MASTER-1', 'valid_start_date' => '2020-01-01', 'valid_end_date' => '2099-12-31'],
            ['concept_id' => 2000, 'concept_name' => 'IRSF local concept', 'domain_id' => 'Condition', 'vocabulary_id' => 'IRSF-NHS', 'concept_class_id' => 'Clinical', 'standard_concept' => 'S', 'concept_code' => 'IRSF-1', 'valid_start_date' => '2020-01-01', 'valid_end_date' => '2099-12-31'],
        ]);
        $connection->table($schema.'.concept_relationship')->insert(['concept_id_1' => 2000, 'concept_id_2' => 1, 'relationship_id' => 'Is a', 'valid_start_date' => '2020-01-01', 'valid_end_date' => '2099-12-31']);
        $connection->table($schema.'.concept_ancestor')->insert(['ancestor_concept_id' => 2000, 'descendant_concept_id' => 2000, 'min_levels_of_separation' => 0, 'max_levels_of_separation' => 0]);
        $connection->table($schema.'.concept_synonym')->insert(['concept_id' => 2000, 'concept_synonym_name' => 'IRSF local concept', 'language_concept_id' => 2000]);
        $connection->table($schema.'.drug_strength')->insert(['drug_concept_id' => 2000, 'ingredient_concept_id' => 2000, 'valid_start_date' => '2020-01-01', 'valid_end_date' => '2099-12-31']);
        $connection->table($schema.'.concept_embedding_bge')->insert([['concept_id' => 1, 'model' => 'model'], ['concept_id' => 2000, 'model' => 'model']]);
        $connection->table($schema.'.source_to_concept_map')->insert(['source_concept_id' => 2000, 'target_concept_id' => 1]);

        $report = (new VocabularyImportService)->import($connection, $directory, $schema, backupPath: $backupDirectory);

        expect($report['preserved_vocabularies'])->toContain('IRSF-NHS')
            ->and($report['embedding_rows_invalidated'])->toBe(1)
            ->and($connection->table($schema.'.concept')->count())->toBe(2)
            ->and($connection->table($schema.'.concept')->where('concept_id', 2000)->value('concept_name'))->toBe('IRSF local concept')
            ->and($connection->table($schema.'.concept_embedding_bge')->pluck('concept_id')->all())->toBe([2000]);
    } finally {
        $connection->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        removeVocabularyPackage($directory);
        unlink($backupDirectory.'/toc.dat');
        rmdir($backupDirectory);
    }
});

test('source map validation fails before cutover and leaves live rows unchanged', function () {
    $connection = DB::connection('pgsql_testing');
    $schema = 'vocab_import_it_'.bin2hex(random_bytes(4));
    $directory = createValidVocabularyPackage();
    $backupDirectory = sys_get_temp_dir().'/parthenon_vocab_backup_'.bin2hex(random_bytes(6));
    mkdir($backupDirectory, 0700, true);
    file_put_contents($backupDirectory.'/toc.dat', 'verified test backup');
    createVocabularyImportTarget($connection, $schema);
    try {
        $connection->table($schema.'.vocabulary')->insert(['vocabulary_id' => 'SNOMED', 'vocabulary_name' => 'SNOMED', 'vocabulary_reference' => 'old', 'vocabulary_version' => 'old', 'vocabulary_concept_id' => 1]);
        $connection->table($schema.'.domain')->insert(['domain_id' => 'Condition', 'domain_name' => 'Condition', 'domain_concept_id' => 1]);
        $connection->table($schema.'.concept_class')->insert(['concept_class_id' => 'Clinical', 'concept_class_name' => 'Clinical', 'concept_class_concept_id' => 1]);
        $connection->table($schema.'.relationship')->insert(['relationship_id' => 'Is a', 'relationship_name' => 'Is a', 'is_hierarchical' => '1', 'defines_ancestry' => '1', 'reverse_relationship_id' => 'Subsumes', 'relationship_concept_id' => 1]);
        $connection->table($schema.'.concept')->insert([
            ['concept_id' => 1, 'concept_name' => 'Old master concept', 'domain_id' => 'Condition', 'vocabulary_id' => 'SNOMED', 'concept_class_id' => 'Clinical', 'standard_concept' => 'S', 'concept_code' => 'MASTER-1', 'valid_start_date' => '2020-01-01', 'valid_end_date' => '2099-12-31'],
            ['concept_id' => 99, 'concept_name' => 'Mapped old master', 'domain_id' => 'Condition', 'vocabulary_id' => 'SNOMED', 'concept_class_id' => 'Clinical', 'standard_concept' => 'S', 'concept_code' => 'MASTER-99', 'valid_start_date' => '2020-01-01', 'valid_end_date' => '2099-12-31'],
        ]);
        $connection->table($schema.'.source_to_concept_map')->insert(['source_concept_id' => 99, 'target_concept_id' => 1]);

        expect(fn () => (new VocabularyImportService)->import($connection, $directory, $schema, backupPath: $backupDirectory))
            ->toThrow(RuntimeException::class, 'orphan');
        expect($connection->table($schema.'.concept')->count())->toBe(2)
            ->and($connection->table($schema.'.concept')->where('concept_id', 99)->exists())->toBeTrue();
    } finally {
        $connection->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        removeVocabularyPackage($directory);
        unlink($backupDirectory.'/toc.dat');
        rmdir($backupDirectory);
    }
});

test('preflight performs staging validation and drops staging without changing live rows', function () {
    $connection = DB::connection('pgsql_testing');
    $schema = 'vocab_import_it_'.bin2hex(random_bytes(4));
    $directory = createValidVocabularyPackage();
    createVocabularyImportTarget($connection, $schema);
    try {
        $connection->table($schema.'.vocabulary')->insert([
            'vocabulary_id' => 'SNOMED',
            'vocabulary_name' => 'SNOMED',
            'vocabulary_reference' => 'old',
            'vocabulary_version' => 'old',
            'vocabulary_concept_id' => 1,
        ]);
        $connection->table($schema.'.domain')->insert(['domain_id' => 'Condition', 'domain_name' => 'Condition', 'domain_concept_id' => 1]);
        $connection->table($schema.'.concept_class')->insert(['concept_class_id' => 'Clinical', 'concept_class_name' => 'Clinical', 'concept_class_concept_id' => 1]);
        $connection->table($schema.'.relationship')->insert(['relationship_id' => 'Is a', 'relationship_name' => 'Is a', 'is_hierarchical' => '1', 'defines_ancestry' => '1', 'reverse_relationship_id' => 'Subsumes', 'relationship_concept_id' => 1]);
        $connection->table($schema.'.concept')->insert([
            'concept_id' => 1,
            'concept_name' => 'Old master concept',
            'domain_id' => 'Condition',
            'vocabulary_id' => 'SNOMED',
            'concept_class_id' => 'Clinical',
            'standard_concept' => 'S',
            'concept_code' => 'MASTER-1',
            'valid_start_date' => '2020-01-01',
            'valid_end_date' => '2099-12-31',
        ]);

        $report = (new VocabularyImportService)->import(
            $connection,
            $directory,
            $schema,
            preflightOnly: true,
        );

        expect($report['status'])->toBe('preflight_passed')
            ->and($report['validated_counts']['concept'])->toBe(1)
            ->and($connection->table($schema.'.concept')->value('concept_name'))->toBe('Old master concept')
            ->and($connection->scalar('SELECT to_regnamespace(?)', [$report['staging_schema']]))->toBeNull();
    } finally {
        $connection->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        removeVocabularyPackage($directory);
    }
});
