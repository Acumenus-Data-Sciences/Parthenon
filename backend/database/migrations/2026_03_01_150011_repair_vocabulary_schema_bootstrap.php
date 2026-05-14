<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * @var list<string>
     */
    private array $baseVocabularyTables = [
        'vocabulary',
        'domain',
        'concept_class',
        'relationship',
        'concept',
        'concept_relationship',
        'concept_ancestor',
        'concept_synonym',
        'drug_strength',
        'source_to_concept_map',
        'concept_embeddings',
    ];

    public function up(): void
    {
        DB::statement('CREATE SCHEMA IF NOT EXISTS vocab');

        foreach ($this->baseVocabularyTables as $table) {
            $this->repairMisplacedTable($table);
        }

        $this->ensureConceptTreeTable();
        $this->assertVocabularyTablesAreInVocab();
    }

    public function down(): void
    {
        // Intentional no-op. Moving shared vocabulary tables back to omop would
        // recreate the broken state this migration protects against.
    }

    private function repairMisplacedTable(string $table): void
    {
        $vocabTable = "vocab.{$table}";
        $omopTable = "omop.{$table}";

        if ($this->relationExists($vocabTable)) {
            if ($this->relationExists($omopTable) && $this->rowCount($omopTable) > 0) {
                throw new RuntimeException(
                    "{$omopTable} still contains rows while {$vocabTable} also exists. "
                    .'Move or reconcile the duplicate vocabulary table manually before rerunning migrations.'
                );
            }

            if ($this->relationExists($omopTable)) {
                DB::statement(sprintf('DROP TABLE omop.%s', $this->quoteIdentifier($table)));
            }

            return;
        }

        if ($this->relationExists($omopTable)) {
            DB::statement(sprintf('ALTER TABLE omop.%s SET SCHEMA vocab', $this->quoteIdentifier($table)));

            return;
        }

        throw new RuntimeException(
            "Missing required vocabulary table {$vocabTable}. "
            .'Run the base vocabulary migrations on a database where schema vocab exists.'
        );
    }

    private function ensureConceptTreeTable(): void
    {
        if (! $this->relationExists('vocab.concept_tree')) {
            DB::statement('
                CREATE TABLE vocab.concept_tree (
                    parent_concept_id  INTEGER NOT NULL,
                    child_concept_id   INTEGER NOT NULL,
                    domain_id          VARCHAR(20) NOT NULL,
                    child_depth        SMALLINT NOT NULL,
                    vocabulary_id      VARCHAR(20) NOT NULL,
                    concept_class_id   VARCHAR(20) NOT NULL,
                    child_name         VARCHAR(255) NOT NULL,
                    PRIMARY KEY (parent_concept_id, child_concept_id)
                )
            ');
        }

        $this->ensureIndex('idx_concept_tree_child', 'CREATE INDEX idx_concept_tree_child ON vocab.concept_tree (child_concept_id)');
        $this->ensureIndex('idx_concept_tree_domain_parent', 'CREATE INDEX idx_concept_tree_domain_parent ON vocab.concept_tree (domain_id, parent_concept_id)');
    }

    private function ensureIndex(string $indexName, string $createSql): void
    {
        $exists = DB::selectOne(
            'SELECT 1 AS present FROM pg_indexes WHERE schemaname = ? AND indexname = ?',
            ['vocab', $indexName]
        );

        if ($exists) {
            return;
        }

        DB::statement($createSql);
    }

    private function assertVocabularyTablesAreInVocab(): void
    {
        $missing = [];

        foreach ($this->baseVocabularyTables as $table) {
            if (! $this->relationExists("vocab.{$table}")) {
                $missing[] = "vocab.{$table}";
            }
        }

        if (! $this->relationExists('vocab.concept_tree')) {
            $missing[] = 'vocab.concept_tree';
        }

        if ($missing !== []) {
            throw new RuntimeException('Missing required vocabulary relations: '.implode(', ', $missing));
        }
    }

    private function relationExists(string $relation): bool
    {
        $row = DB::selectOne('SELECT to_regclass(?) IS NOT NULL AS exists', [$relation]);

        return (bool) ($row?->exists ?? false);
    }

    private function rowCount(string $relation): int
    {
        [$schema, $table] = explode('.', $relation, 2);

        try {
            $row = DB::selectOne(sprintf(
                'SELECT count(*) AS c FROM %s.%s',
                $this->quoteIdentifier($schema),
                $this->quoteIdentifier($table)
            ));

            return (int) ($row?->c ?? 0);
        } catch (QueryException $e) {
            if (str_contains($e->getMessage(), 'permission denied')) {
                throw new RuntimeException(
                    "{$relation} exists but the migrator role lacks SELECT permission. "
                    .'Run as superuser: DROP TABLE '.$relation.' CASCADE; '
                    .'and verify any rows are already mirrored in the vocab schema before doing so.',
                    previous: $e,
                );
            }

            throw $e;
        }
    }

    private function quoteIdentifier(string $identifier): string
    {
        return '"'.str_replace('"', '""', $identifier).'"';
    }
};
