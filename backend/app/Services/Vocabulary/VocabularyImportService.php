<?php

declare(strict_types=1);

namespace App\Services\Vocabulary;

use Illuminate\Database\Connection;
use RuntimeException;
use Throwable;
use ZipArchive;

/**
 * Staged, fail-closed OMOP vocabulary import service.
 *
 * The service never truncates the live concept table. It loads a complete
 * replacement into an isolated schema, validates membership and references,
 * merges omitted/local vocabularies by default, and then applies the validated
 * state transactionally while retaining embeddings whose source concept is
 * unchanged.
 */
class VocabularyImportService
{
    /**
     * @var array<string, array{file: string, columns: list<string>, key: list<string>}>
     */
    public const TABLES = [
        'vocabulary' => [
            'file' => 'VOCABULARY.csv',
            'columns' => ['vocabulary_id', 'vocabulary_name', 'vocabulary_reference', 'vocabulary_version', 'vocabulary_concept_id'],
            'key' => ['vocabulary_id'],
        ],
        'domain' => [
            'file' => 'DOMAIN.csv',
            'columns' => ['domain_id', 'domain_name', 'domain_concept_id'],
            'key' => ['domain_id'],
        ],
        'concept_class' => [
            'file' => 'CONCEPT_CLASS.csv',
            'columns' => ['concept_class_id', 'concept_class_name', 'concept_class_concept_id'],
            'key' => ['concept_class_id'],
        ],
        'relationship' => [
            'file' => 'RELATIONSHIP.csv',
            'columns' => ['relationship_id', 'relationship_name', 'is_hierarchical', 'defines_ancestry', 'reverse_relationship_id', 'relationship_concept_id'],
            'key' => ['relationship_id'],
        ],
        'concept' => [
            'file' => 'CONCEPT.csv',
            'columns' => ['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'concept_class_id', 'standard_concept', 'concept_code', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
            'key' => ['concept_id'],
        ],
        'concept_relationship' => [
            'file' => 'CONCEPT_RELATIONSHIP.csv',
            'columns' => ['concept_id_1', 'concept_id_2', 'relationship_id', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
            'key' => ['concept_id_1', 'concept_id_2', 'relationship_id'],
        ],
        'concept_ancestor' => [
            'file' => 'CONCEPT_ANCESTOR.csv',
            'columns' => ['ancestor_concept_id', 'descendant_concept_id', 'min_levels_of_separation', 'max_levels_of_separation'],
            'key' => ['ancestor_concept_id', 'descendant_concept_id'],
        ],
        'concept_synonym' => [
            'file' => 'CONCEPT_SYNONYM.csv',
            'columns' => ['concept_id', 'concept_synonym_name', 'language_concept_id'],
            'key' => [],
        ],
        'drug_strength' => [
            'file' => 'DRUG_STRENGTH.csv',
            'columns' => ['drug_concept_id', 'ingredient_concept_id', 'amount_value', 'amount_unit_concept_id', 'numerator_value', 'numerator_unit_concept_id', 'denominator_value', 'denominator_unit_concept_id', 'box_size', 'valid_start_date', 'valid_end_date', 'invalid_reason'],
            'key' => [],
        ],
    ];

    /**
     * @param  callable(string): void|null  $logger
     * @return array<string, mixed>
     */
    public function import(
        Connection $connection,
        string $inputPath,
        string $targetSchema = 'vocab',
        bool $removeOmitted = false,
        ?callable $logger = null,
        bool $preflightOnly = false,
        ?string $backupPath = null,
    ): array {
        $this->assertPostgres($connection);
        $targetSchema = $this->validateIdentifier($targetSchema, 'target schema');
        [$directory, $cleanup] = $this->prepareInput($inputPath);
        $stagingSchema = substr($targetSchema.'_import_'.now()->format('YmdHis').'_'.bin2hex(random_bytes(3)), 0, 63);
        $stagingCreated = false;
        $startedAt = microtime(true);

        try {
            $files = $this->inspectDirectory($directory);
            $this->log($logger, 'Validated required file set, headers, row counts, and SHA-256 hashes.');
            if (! $preflightOnly) {
                $this->assertBackupEvidence($connection, $targetSchema, $backupPath);
            }

            $this->createStagingSchema($connection, $targetSchema, $stagingSchema);
            $stagingCreated = true;
            $this->log($logger, "Created isolated staging schema {$stagingSchema}.");

            $loadedCounts = $this->loadStagingTables($connection, $directory, $stagingSchema, $files, $logger);
            $this->applyPreparedCptOverlay($connection, $directory, $stagingSchema, $files, $logger);
            $this->validateStaging($connection, $stagingSchema);

            $omitted = $this->omittedVocabularies($connection, $targetSchema, $stagingSchema);
            if ($omitted !== [] && ! $removeOmitted) {
                $this->preserveOmittedVocabularies($connection, $targetSchema, $stagingSchema, $omitted);
                $this->log($logger, 'Preserved omitted vocabularies: '.implode(', ', $omitted));
            } elseif ($omitted !== []) {
                $this->log($logger, 'Explicit removal override accepted for omitted vocabularies: '.implode(', ', $omitted));
            }

            $this->validateStaging($connection, $stagingSchema);
            $this->validatePreservedSourceMaps($connection, $targetSchema, $stagingSchema);
            $releases = $connection->select(
                'SELECT vocabulary_id, vocabulary_version FROM '.$this->qualified($stagingSchema, 'vocabulary').' ORDER BY vocabulary_id'
            );
            $beforeCounts = $this->tableCounts($connection, $targetSchema);
            $stagedCounts = $this->tableCounts($connection, $stagingSchema);

            if ($preflightOnly) {
                $connection->statement('DROP SCHEMA '.$this->quote($stagingSchema).' CASCADE');
                $stagingCreated = false;

                return [
                    'status' => 'preflight_passed',
                    'target_schema' => $targetSchema,
                    'staging_schema' => $stagingSchema,
                    'remove_omitted' => $removeOmitted,
                    'preserved_vocabularies' => $removeOmitted ? [] : $omitted,
                    'files' => $files,
                    'loaded_counts' => $loadedCounts,
                    'before_counts' => $beforeCounts,
                    'validated_counts' => $stagedCounts,
                    'vocabulary_versions' => array_map(static fn (object $row): array => [
                        'vocabulary_id' => $row->vocabulary_id,
                        'vocabulary_version' => $row->vocabulary_version,
                    ], $releases),
                    'duration_seconds' => round(microtime(true) - $startedAt, 3),
                ];
            }

            $embeddingInvalidations = $this->applyTransactionalMerge(
                $connection,
                $targetSchema,
                $stagingSchema,
                $logger,
            );
            $afterCounts = $this->tableCounts($connection, $targetSchema);
            if ($afterCounts !== $stagedCounts) {
                throw new RuntimeException('Post-cutover table counts do not match the validated staging schema.');
            }

            $connection->statement('DROP SCHEMA '.$this->quote($stagingSchema).' CASCADE');
            $stagingCreated = false;

            return [
                'status' => 'database_completed_downstreams_pending',
                'target_schema' => $targetSchema,
                'staging_schema' => $stagingSchema,
                'remove_omitted' => $removeOmitted,
                'backup_path' => $backupPath,
                'preserved_vocabularies' => $removeOmitted ? [] : $omitted,
                'files' => $files,
                'loaded_counts' => $loadedCounts,
                'before_counts' => $beforeCounts,
                'after_counts' => $afterCounts,
                'embedding_rows_invalidated' => $embeddingInvalidations,
                'vocabulary_versions' => array_map(static fn (object $row): array => [
                    'vocabulary_id' => $row->vocabulary_id,
                    'vocabulary_version' => $row->vocabulary_version,
                ], $releases),
                'downstream_required' => [
                    'concept_tree_and_results_hierarchies',
                    'vsac_value_set_omop_concepts',
                    'bge_embeddings',
                    'solr_versioned_core',
                    'chroma_versioned_collection',
                    'hecate_versioned_collection',
                ],
                'duration_seconds' => round(microtime(true) - $startedAt, 3),
            ];
        } catch (Throwable $error) {
            if ($stagingCreated) {
                $this->log($logger, "Import failed; retained staging schema {$stagingSchema} for inspection.");
            }
            throw $error;
        } finally {
            $cleanup();
        }
    }

    private function assertBackupEvidence(Connection $connection, string $targetSchema, ?string $backupPath): void
    {
        $hasLiveData = (int) $connection->scalar(
            'SELECT count(*) FROM '.$this->qualified($targetSchema, 'concept').' LIMIT 1'
        ) > 0;
        if (! $hasLiveData) {
            return;
        }
        if ($backupPath === null || trim($backupPath) === '') {
            throw new RuntimeException('A verified pre-import pg_dump directory is required before changing a non-empty vocabulary schema.');
        }
        $realPath = realpath($backupPath);
        if ($realPath === false || ! is_dir($realPath) || ! is_readable($realPath.'/toc.dat')) {
            throw new RuntimeException('The vocabulary backup path must be a readable pg_dump directory containing toc.dat.');
        }
    }

    private function assertPostgres(Connection $connection): void
    {
        if ($connection->getDriverName() !== 'pgsql') {
            throw new RuntimeException('Vocabulary imports require PostgreSQL.');
        }
    }

    /**
     * @return array{0: string, 1: callable(): void}
     */
    private function prepareInput(string $inputPath): array
    {
        $realPath = realpath($inputPath);
        if ($realPath === false) {
            throw new RuntimeException("Vocabulary input does not exist: {$inputPath}");
        }
        if (is_dir($realPath)) {
            return [$this->resolveCsvDirectory($realPath), static function (): void {}];
        }
        if (strtolower(pathinfo($realPath, PATHINFO_EXTENSION)) !== 'zip') {
            throw new RuntimeException('Vocabulary input must be an Athena directory or ZIP archive.');
        }

        $extractDirectory = sys_get_temp_dir().'/parthenon_vocab_'.bin2hex(random_bytes(8));
        if (! mkdir($extractDirectory, 0700, true) && ! is_dir($extractDirectory)) {
            throw new RuntimeException("Could not create extraction directory: {$extractDirectory}");
        }
        $zip = new ZipArchive;
        if ($zip->open($realPath) !== true) {
            throw new RuntimeException('Failed to open vocabulary ZIP archive.');
        }
        try {
            for ($index = 0; $index < $zip->numFiles; $index++) {
                $entry = str_replace('\\', '/', (string) $zip->getNameIndex($index));
                $segments = explode('/', $entry);
                if ($entry === '' || str_starts_with($entry, '/') || in_array('..', $segments, true) || str_contains($entry, "\0")) {
                    throw new RuntimeException('Vocabulary ZIP contains an unsafe entry path.');
                }
            }
            if (! $zip->extractTo($extractDirectory)) {
                throw new RuntimeException('Failed to extract vocabulary ZIP archive.');
            }
        } finally {
            $zip->close();
        }

        return [
            $this->resolveCsvDirectory($extractDirectory),
            function () use ($extractDirectory): void {
                $this->removeDirectory($extractDirectory);
            },
        ];
    }

    private function resolveCsvDirectory(string $root): string
    {
        $matches = [];
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
        );
        foreach ($iterator as $file) {
            if ($file->isFile() && strtoupper($file->getFilename()) === 'CONCEPT.CSV') {
                $matches[] = $file->getPath();
            }
        }
        $matches = array_values(array_unique($matches));
        if (count($matches) !== 1) {
            throw new RuntimeException('Vocabulary input must contain exactly one directory with CONCEPT.csv.');
        }

        return $matches[0];
    }

    /**
     * @return array<string, array{path: string, rows: int, bytes: int, sha256: string, header: list<string>}>
     */
    public function inspectDirectory(string $directory): array
    {
        $result = [];
        foreach (self::TABLES as $config) {
            $path = $directory.'/'.$config['file'];
            if (! is_file($path) || ! is_readable($path)) {
                throw new RuntimeException("Required vocabulary file is missing or unreadable: {$config['file']}");
            }
            $result[$config['file']] = $this->inspectFile($path, $config['columns']);
        }
        $cptPath = $directory.'/CONCEPT_CPT4.csv';
        if (is_file($cptPath)) {
            $result['CONCEPT_CPT4.csv'] = $this->inspectFile($cptPath, self::TABLES['concept']['columns']);
        }

        return $result;
    }

    /**
     * @param  list<string>  $expectedHeader
     * @return array{path: string, rows: int, bytes: int, sha256: string, header: list<string>}
     */
    private function inspectFile(string $path, array $expectedHeader): array
    {
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw new RuntimeException("Cannot open vocabulary file: {$path}");
        }
        $headerLine = fgets($stream);
        if ($headerLine === false) {
            fclose($stream);
            throw new RuntimeException('Vocabulary file is empty: '.basename($path));
        }
        $header = explode("\t", rtrim($headerLine, "\r\n"));
        if ($header !== $expectedHeader) {
            fclose($stream);
            throw new RuntimeException('Unexpected header in '.basename($path).'.');
        }
        $hash = hash_init('sha256');
        hash_update($hash, $headerLine);
        $dataNewlines = 0;
        $dataBytes = 0;
        $lastByte = null;
        while (! feof($stream)) {
            $chunk = fread($stream, 8 * 1024 * 1024);
            if ($chunk === false) {
                fclose($stream);
                throw new RuntimeException('Failed while reading '.basename($path).'.');
            }
            hash_update($hash, $chunk);
            $dataNewlines += substr_count($chunk, "\n");
            $dataBytes += strlen($chunk);
            if ($chunk !== '') {
                $lastByte = $chunk[strlen($chunk) - 1];
            }
        }
        fclose($stream);
        $rows = $dataNewlines + ($dataBytes > 0 && $lastByte !== "\n" ? 1 : 0);
        if ($rows === 0) {
            throw new RuntimeException('Vocabulary file has no data rows: '.basename($path));
        }

        return [
            'path' => $path,
            'rows' => $rows,
            'bytes' => (int) filesize($path),
            'sha256' => hash_final($hash),
            'header' => $header,
        ];
    }

    private function createStagingSchema(Connection $connection, string $targetSchema, string $stagingSchema): void
    {
        $connection->statement('CREATE SCHEMA '.$this->quote($stagingSchema));
        foreach (array_keys(self::TABLES) as $table) {
            $connection->statement(
                'CREATE UNLOGGED TABLE '.$this->qualified($stagingSchema, $table)
                .' (LIKE '.$this->qualified($targetSchema, $table).' INCLUDING ALL)'
            );
        }
        $connection->statement(
            'CREATE UNLOGGED TABLE '.$this->qualified($stagingSchema, 'concept_cpt4')
            .' (LIKE '.$this->qualified($targetSchema, 'concept').' INCLUDING ALL)'
        );
    }

    /**
     * @param  array<string, array{path: string, rows: int, bytes: int, sha256: string, header: list<string>}>  $files
     * @param  callable(string): void|null  $logger
     * @return array<string, int>
     */
    private function loadStagingTables(
        Connection $connection,
        string $directory,
        string $stagingSchema,
        array $files,
        ?callable $logger,
    ): array {
        $counts = [];
        foreach (self::TABLES as $table => $config) {
            $this->log($logger, "Loading {$config['file']} into staging.");
            $this->copyFile($connection, $stagingSchema, $table, $directory.'/'.$config['file'], $config['columns']);
            $count = (int) $connection->scalar('SELECT count(*) FROM '.$this->qualified($stagingSchema, $table));
            if ($count !== $files[$config['file']]['rows']) {
                throw new RuntimeException("Loaded row count mismatch for {$config['file']}: expected {$files[$config['file']]['rows']}, got {$count}.");
            }
            $counts[$table] = $count;
        }

        return $counts;
    }

    /**
     * @param  list<string>  $columns
     */
    private function copyFile(Connection $connection, string $schema, string $table, string $path, array $columns): void
    {
        $bodyPath = tempnam(sys_get_temp_dir(), 'parthenon_vocab_body_');
        if ($bodyPath === false) {
            throw new RuntimeException('Unable to create a temporary COPY file.');
        }
        $input = fopen($path, 'rb');
        $output = fopen($bodyPath, 'wb');
        if ($input === false || $output === false) {
            @unlink($bodyPath);
            throw new RuntimeException('Unable to stream vocabulary file for PostgreSQL COPY.');
        }
        try {
            fgets($input);
            $carry = '';
            while (! feof($input)) {
                $chunk = fread($input, 8 * 1024 * 1024);
                if ($chunk === false) {
                    throw new RuntimeException('Failed while preparing PostgreSQL COPY input.');
                }
                $buffer = $carry.$chunk;
                $lastNewline = strrpos($buffer, "\n");
                if ($lastNewline === false) {
                    $carry = $buffer;

                    continue;
                }
                $complete = substr($buffer, 0, $lastNewline + 1);
                $carry = substr($buffer, $lastNewline + 1);
                fwrite($output, $this->normalizeCopyNulls($complete));
            }
            if ($carry !== '') {
                fwrite($output, $this->normalizeCopyNulls($carry));
            }
        } finally {
            fclose($input);
            fclose($output);
        }

        try {
            /** @var \PDO $pdo */
            $pdo = $connection->getPdo();
            $ok = $pdo->pgsqlCopyFromFile(
                $this->qualified($schema, $table),
                $bodyPath,
                "\t",
                '\\\\N',
                implode(',', array_map($this->quote(...), $columns)),
            );
            if (! $ok) {
                throw new RuntimeException("PostgreSQL COPY failed for {$table}.");
            }
        } finally {
            @unlink($bodyPath);
        }
    }

    /** Convert Athena's empty TSV fields to PostgreSQL text-COPY NULL markers. */
    private function normalizeCopyNulls(string $contents): string
    {
        $normalized = preg_replace('/(^|\t)(?=\t|\r?$)/m', '$1\\N', $contents);
        if ($normalized === null) {
            throw new RuntimeException('Failed to normalize vocabulary NULL fields.');
        }

        return $normalized;
    }

    /**
     * @param  array<string, array{path: string, rows: int, bytes: int, sha256: string, header: list<string>}>  $files
     * @param  callable(string): void|null  $logger
     */
    private function applyPreparedCptOverlay(
        Connection $connection,
        string $directory,
        string $stagingSchema,
        array $files,
        ?callable $logger,
    ): void {
        if (isset($files['CONCEPT_CPT4.csv'])) {
            $this->copyFile(
                $connection,
                $stagingSchema,
                'concept_cpt4',
                $directory.'/CONCEPT_CPT4.csv',
                self::TABLES['concept']['columns'],
            );
            $notCpt = (int) $connection->scalar(
                'SELECT count(*) FROM '.$this->qualified($stagingSchema, 'concept_cpt4')." WHERE vocabulary_id <> 'CPT4'"
            );
            if ($notCpt !== 0) {
                throw new RuntimeException('CONCEPT_CPT4.csv contains non-CPT4 concepts.');
            }
            $this->upsertFromStagingTable($connection, $stagingSchema, 'concept_cpt4', $stagingSchema, 'concept', self::TABLES['concept']);
            $this->log($logger, "Applied {$files['CONCEPT_CPT4.csv']['rows']} prepared CPT4 rows without reading or logging licensed content.");
        }

        $unprepared = (int) $connection->scalar(
            'SELECT count(*) FROM '.$this->qualified($stagingSchema, 'concept')
            ." WHERE vocabulary_id = 'CPT4' AND (btrim(concept_name) = '' OR lower(concept_name) IN ('omop generated', 'cpt4'))"
        );
        if ($unprepared > 0) {
            throw new RuntimeException('CPT4 rows are not prepared. Run the licensed CPT utility before importing; no UMLS key is consumed by Parthenon.');
        }
    }

    private function validateStaging(Connection $connection, string $schema): void
    {
        $checks = [
            'concept date ranges' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept').' WHERE valid_start_date > valid_end_date',
            'concept relationship date ranges' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_relationship').' WHERE valid_start_date > valid_end_date',
            'drug strength date ranges' => 'SELECT count(*) FROM '.$this->qualified($schema, 'drug_strength').' WHERE valid_start_date > valid_end_date',
            'concept vocabulary references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept').' c LEFT JOIN '.$this->qualified($schema, 'vocabulary').' v USING (vocabulary_id) WHERE v.vocabulary_id IS NULL',
            'concept domain references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept').' c LEFT JOIN '.$this->qualified($schema, 'domain').' d USING (domain_id) WHERE d.domain_id IS NULL',
            'concept class references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept').' c LEFT JOIN '.$this->qualified($schema, 'concept_class').' cc USING (concept_class_id) WHERE cc.concept_class_id IS NULL',
            'concept relationship source references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_relationship').' cr LEFT JOIN '.$this->qualified($schema, 'concept').' c ON c.concept_id = cr.concept_id_1 WHERE c.concept_id IS NULL',
            'concept relationship target references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_relationship').' cr LEFT JOIN '.$this->qualified($schema, 'concept').' c ON c.concept_id = cr.concept_id_2 WHERE c.concept_id IS NULL',
            'concept relationship type references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_relationship').' cr LEFT JOIN '.$this->qualified($schema, 'relationship').' r USING (relationship_id) WHERE r.relationship_id IS NULL',
            'ancestor references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_ancestor').' ca LEFT JOIN '.$this->qualified($schema, 'concept').' a ON a.concept_id = ca.ancestor_concept_id LEFT JOIN '.$this->qualified($schema, 'concept').' d ON d.concept_id = ca.descendant_concept_id WHERE a.concept_id IS NULL OR d.concept_id IS NULL',
            'synonym concept references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_synonym').' cs LEFT JOIN '.$this->qualified($schema, 'concept').' c USING (concept_id) WHERE c.concept_id IS NULL',
            'synonym language references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'concept_synonym').' cs LEFT JOIN '.$this->qualified($schema, 'concept').' c ON c.concept_id = cs.language_concept_id WHERE c.concept_id IS NULL',
            'drug strength drug references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'drug_strength').' ds LEFT JOIN '.$this->qualified($schema, 'concept').' c ON c.concept_id = ds.drug_concept_id WHERE c.concept_id IS NULL',
            'drug strength ingredient references' => 'SELECT count(*) FROM '.$this->qualified($schema, 'drug_strength').' ds LEFT JOIN '.$this->qualified($schema, 'concept').' c ON c.concept_id = ds.ingredient_concept_id WHERE c.concept_id IS NULL',
            'duplicate synonyms' => 'SELECT count(*) FROM (SELECT 1 FROM '.$this->qualified($schema, 'concept_synonym').' GROUP BY concept_id, concept_synonym_name, language_concept_id HAVING count(*) > 1) duplicate',
            'duplicate drug strengths' => 'SELECT count(*) FROM (SELECT 1 FROM '.$this->qualified($schema, 'drug_strength').' GROUP BY drug_concept_id, ingredient_concept_id, amount_value, amount_unit_concept_id, numerator_value, numerator_unit_concept_id, denominator_value, denominator_unit_concept_id, box_size, valid_start_date, valid_end_date, invalid_reason HAVING count(*) > 1) duplicate',
            'required vocabulary metadata' => 'SELECT count(*) FROM '.$this->qualified($schema, 'vocabulary')." WHERE btrim(vocabulary_id) = '' OR btrim(vocabulary_name) = '' OR vocabulary_concept_id IS NULL",
        ];
        foreach ($checks as $label => $sql) {
            $count = (int) $connection->scalar($sql);
            if ($count !== 0) {
                throw new RuntimeException("Staging validation failed for {$label}: {$count} row(s).");
            }
        }
    }

    /** @return list<string> */
    private function omittedVocabularies(Connection $connection, string $targetSchema, string $stagingSchema): array
    {
        return array_values(array_map(
            static fn (object $row): string => (string) $row->vocabulary_id,
            $connection->select(
                'SELECT live.vocabulary_id FROM '.$this->qualified($targetSchema, 'vocabulary').' live '
                .'LEFT JOIN '.$this->qualified($stagingSchema, 'vocabulary').' staged USING (vocabulary_id) '
                .'WHERE staged.vocabulary_id IS NULL ORDER BY live.vocabulary_id'
            ),
        ));
    }

    /** @param list<string> $omitted */
    private function preserveOmittedVocabularies(
        Connection $connection,
        string $targetSchema,
        string $stagingSchema,
        array $omitted,
    ): void {
        $placeholders = implode(',', array_fill(0, count($omitted), '?'));
        foreach (['domain', 'concept_class', 'relationship'] as $table) {
            $this->upsertFromStagingTable($connection, $targetSchema, $table, $stagingSchema, $table, self::TABLES[$table], true);
        }
        $connection->insert(
            'INSERT INTO '.$this->qualified($stagingSchema, 'vocabulary').' SELECT * FROM '.$this->qualified($targetSchema, 'vocabulary')
            ." WHERE vocabulary_id IN ({$placeholders}) ON CONFLICT (vocabulary_id) DO NOTHING",
            $omitted,
        );
        $connection->insert(
            'INSERT INTO '.$this->qualified($stagingSchema, 'concept').' SELECT * FROM '.$this->qualified($targetSchema, 'concept')
            ." WHERE vocabulary_id IN ({$placeholders}) ON CONFLICT (concept_id) DO NOTHING",
            $omitted,
        );

        $preservedConcept = 'SELECT concept_id FROM '.$this->qualified($targetSchema, 'concept')." WHERE vocabulary_id IN ({$placeholders})";
        $connection->insert(
            'INSERT INTO '.$this->qualified($stagingSchema, 'concept_relationship').' SELECT * FROM '.$this->qualified($targetSchema, 'concept_relationship')
            ." WHERE concept_id_1 IN ({$preservedConcept}) OR concept_id_2 IN ({$preservedConcept}) ON CONFLICT DO NOTHING",
            array_merge($omitted, $omitted),
        );
        $connection->insert(
            'INSERT INTO '.$this->qualified($stagingSchema, 'concept_ancestor').' SELECT * FROM '.$this->qualified($targetSchema, 'concept_ancestor')
            ." WHERE ancestor_concept_id IN ({$preservedConcept}) OR descendant_concept_id IN ({$preservedConcept}) ON CONFLICT DO NOTHING",
            array_merge($omitted, $omitted),
        );
        $connection->insert(
            'INSERT INTO '.$this->qualified($stagingSchema, 'concept_synonym').' SELECT * FROM '.$this->qualified($targetSchema, 'concept_synonym')
            ." WHERE concept_id IN ({$preservedConcept})",
            $omitted,
        );
        $connection->insert(
            'INSERT INTO '.$this->qualified($stagingSchema, 'drug_strength').' SELECT * FROM '.$this->qualified($targetSchema, 'drug_strength')
            ." WHERE drug_concept_id IN ({$preservedConcept}) OR ingredient_concept_id IN ({$preservedConcept})",
            array_merge($omitted, $omitted),
        );
    }

    private function validatePreservedSourceMaps(Connection $connection, string $targetSchema, string $stagingSchema): void
    {
        $mapping = $connection->selectOne('SELECT to_regclass(?) AS relation', [$targetSchema.'.source_to_concept_map']);
        if (! $mapping || $mapping->relation === null) {
            return;
        }
        $orphans = (int) $connection->scalar(
            'SELECT count(*) FROM '.$this->qualified($targetSchema, 'source_to_concept_map').' map '
            .'WHERE (map.source_concept_id > 0 AND NOT EXISTS (SELECT 1 FROM '.$this->qualified($stagingSchema, 'concept').' c WHERE c.concept_id = map.source_concept_id)) '
            .'OR (map.target_concept_id > 0 AND NOT EXISTS (SELECT 1 FROM '.$this->qualified($stagingSchema, 'concept').' c WHERE c.concept_id = map.target_concept_id))'
        );
        if ($orphans !== 0) {
            throw new RuntimeException("Validated import would orphan {$orphans} source-to-concept mapping reference(s).");
        }
    }

    /**
     * @param  callable(string): void|null  $logger
     */
    private function applyTransactionalMerge(
        Connection $connection,
        string $targetSchema,
        string $stagingSchema,
        ?callable $logger,
    ): int {
        return $connection->transaction(function () use ($connection, $targetSchema, $stagingSchema, $logger): int {
            $connection->statement("SET LOCAL lock_timeout = '30s'");
            $connection->statement("SET LOCAL statement_timeout = '0'");
            $this->log($logger, 'Applying validated vocabulary state in one database transaction.');

            $embeddingInvalidations = 0;
            $embedding = $connection->selectOne('SELECT to_regclass(?) AS relation', [$targetSchema.'.concept_embedding_bge']);
            if ($embedding && $embedding->relation !== null) {
                $embeddingInvalidations = $connection->delete(
                    'DELETE FROM '.$this->qualified($targetSchema, 'concept_embedding_bge').' embedding USING '
                    .$this->qualified($targetSchema, 'concept').' live WHERE embedding.concept_id = live.concept_id AND ('
                    .'NOT EXISTS (SELECT 1 FROM '.$this->qualified($stagingSchema, 'concept').' staged WHERE staged.concept_id = live.concept_id) OR '
                    .'EXISTS (SELECT 1 FROM '.$this->qualified($stagingSchema, 'concept').' staged WHERE staged.concept_id = live.concept_id AND '
                    .'(staged.concept_name, staged.domain_id, staged.vocabulary_id, staged.standard_concept, staged.invalid_reason) '
                    .'IS DISTINCT FROM (live.concept_name, live.domain_id, live.vocabulary_id, live.standard_concept, live.invalid_reason)))'
                );
            }

            $connection->statement(
                'TRUNCATE TABLE '.implode(', ', array_map(
                    fn (string $table): string => $this->qualified($targetSchema, $table),
                    ['concept_relationship', 'concept_ancestor', 'concept_synonym', 'drug_strength'],
                ))
            );

            foreach (['vocabulary', 'domain', 'concept_class', 'relationship', 'concept'] as $table) {
                $config = self::TABLES[$table];
                $keyJoin = implode(' AND ', array_map(
                    fn (string $column): string => 'staged.'.$this->quote($column).' = live.'.$this->quote($column),
                    $config['key'],
                ));
                $connection->delete(
                    'DELETE FROM '.$this->qualified($targetSchema, $table).' live WHERE NOT EXISTS (SELECT 1 FROM '
                    .$this->qualified($stagingSchema, $table).' staged WHERE '.$keyJoin.')'
                );
                $this->upsertFromStagingTable($connection, $stagingSchema, $table, $targetSchema, $table, $config);
            }

            foreach (['concept_relationship', 'concept_ancestor', 'concept_synonym', 'drug_strength'] as $table) {
                $columns = self::TABLES[$table]['columns'];
                $columnList = implode(', ', array_map($this->quote(...), $columns));
                $connection->insert(
                    'INSERT INTO '.$this->qualified($targetSchema, $table).' ('.$columnList.') SELECT '.$columnList
                    .' FROM '.$this->qualified($stagingSchema, $table)
                );
            }
            foreach (array_keys(self::TABLES) as $table) {
                $connection->statement('ANALYZE '.$this->qualified($targetSchema, $table));
            }

            return $embeddingInvalidations;
        }, 1);
    }

    /**
     * @param  array{file: string, columns: list<string>, key: list<string>}  $config
     */
    private function upsertFromStagingTable(
        Connection $connection,
        string $sourceSchema,
        string $sourceTable,
        string $targetSchema,
        string $targetTable,
        array $config,
        bool $doNothing = false,
    ): void {
        $columns = $config['columns'];
        $keys = $config['key'];
        if ($keys === []) {
            throw new RuntimeException("Cannot upsert {$targetTable} without a key.");
        }
        $columnList = implode(', ', array_map($this->quote(...), $columns));
        $keyList = implode(', ', array_map($this->quote(...), $keys));
        $updates = array_values(array_diff($columns, $keys));
        $conflict = $doNothing || $updates === []
            ? 'DO NOTHING'
            : 'DO UPDATE SET '.implode(', ', array_map(
                fn (string $column): string => $this->quote($column).' = EXCLUDED.'.$this->quote($column),
                $updates,
            )).' WHERE ('.implode(', ', array_map(
                fn (string $column): string => $this->quote($targetTable).'.'.$this->quote($column),
                $updates,
            )).') IS DISTINCT FROM ('.implode(', ', array_map(
                fn (string $column): string => 'EXCLUDED.'.$this->quote($column),
                $updates,
            )).')';
        $connection->insert(
            'INSERT INTO '.$this->qualified($targetSchema, $targetTable).' ('.$columnList.') SELECT '.$columnList
            .' FROM '.$this->qualified($sourceSchema, $sourceTable).' ON CONFLICT ('.$keyList.') '.$conflict
        );
    }

    /** @return array<string, int> */
    private function tableCounts(Connection $connection, string $schema): array
    {
        $counts = [];
        foreach (array_keys(self::TABLES) as $table) {
            $counts[$table] = (int) $connection->scalar('SELECT count(*) FROM '.$this->qualified($schema, $table));
        }

        return $counts;
    }

    private function validateIdentifier(string $value, string $label): string
    {
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $value)) {
            throw new RuntimeException("Unsafe {$label}: {$value}");
        }

        return $value;
    }

    private function quote(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }

    private function qualified(string $schema, string $table): string
    {
        return $this->quote($schema).'.'.$this->quote($table);
    }

    /** @param callable(string): void|null $logger */
    private function log(?callable $logger, string $message): void
    {
        if ($logger !== null) {
            $logger($message);
        }
    }

    private function removeDirectory(string $directory): bool
    {
        if (! is_dir($directory)) {
            return true;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $file) {
            $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        }

        return rmdir($directory);
    }
}
