# Concept Hierarchy Mapper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified concept hierarchy system that fixes the broken Vocabulary Hierarchy tab, adds a cross-domain Browse tab, and replaces R-Achilles for populating Data Explorer treemap data.

**Architecture:** A new `vocab.concept_tree` adjacency list (~500K rows) materialized from `vocab.concept_ancestor`, with a `HierarchyBuilderService` that populates it and maps it to per-source `concept_hierarchy` tables. The Vocabulary Hierarchy tab is fixed by rewriting the backend to return proper nested trees from live `concept_ancestor` queries. A new Browse tab on the Vocabulary page lazy-loads from `concept_tree`.

**Tech Stack:** Laravel 11 / PHP 8.4 (backend), React 19 / TypeScript / TanStack Query (frontend), PostgreSQL 17 (database)

**Spec:** `docs/superpowers/specs/2026-04-03-concept-hierarchy-mapper-design.md`

---

### File Map

**Create:**
- `backend/database/migrations/2026_04_03_100000_create_vocab_concept_tree_table.php` — Migration
- `backend/app/Models/Vocabulary/ConceptTree.php` — Eloquent model
- `backend/app/Services/Vocabulary/HierarchyBuilderService.php` — Build logic
- `backend/app/Console/Commands/BuildConceptHierarchy.php` — Artisan command
- `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx` — Browse tab UI
- `frontend/src/features/vocabulary/hooks/useConceptTree.ts` — TanStack Query hook

**Modify:**
- `backend/app/Http/Controllers/Api/V1/VocabularyController.php` — Rewrite `hierarchy()`, add `tree()`
- `backend/routes/api.php` — Add tree route
- `backend/app/Console/Commands/LoadVocabularies.php` — Auto-trigger
- `frontend/src/features/vocabulary/types/vocabulary.ts` — Add `ConceptTreeNode` type
- `frontend/src/features/vocabulary/api/vocabularyApi.ts` — Add `fetchConceptTreeChildren()`
- `frontend/src/features/vocabulary/pages/VocabularyPage.tsx` — Add Browse tab

---

### Task 1: Migration & Model for `vocab.concept_tree`

**Files:**
- Create: `backend/database/migrations/2026_04_03_100000_create_vocab_concept_tree_table.php`
- Create: `backend/app/Models/Vocabulary/ConceptTree.php`

- [ ] **Step 1: Create the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('
            CREATE TABLE IF NOT EXISTS vocab.concept_tree (
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

        DB::statement('CREATE INDEX IF NOT EXISTS idx_concept_tree_child ON vocab.concept_tree (child_concept_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_concept_tree_domain_parent ON vocab.concept_tree (domain_id, parent_concept_id)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS vocab.concept_tree');
    }
};
```

- [ ] **Step 2: Create the ConceptTree model**

```php
<?php

namespace App\Models\Vocabulary;

class ConceptTree extends VocabularyModel
{
    protected $table = 'concept_tree';

    protected $primaryKey = null;

    public $incrementing = false;

    protected $fillable = [
        'parent_concept_id',
        'child_concept_id',
        'domain_id',
        'child_depth',
        'vocabulary_id',
        'concept_class_id',
        'child_name',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'parent_concept_id' => 'integer',
            'child_concept_id' => 'integer',
            'child_depth' => 'integer',
        ];
    }
}
```

- [ ] **Step 3: Run the migration**

Run: `docker compose exec -T php php artisan migrate --path=database/migrations/2026_04_03_100000_create_vocab_concept_tree_table.php`
Expected: Migration runs successfully, table created in vocab schema.

- [ ] **Step 4: Verify table exists**

Run: `psql -U smudoshi -d parthenon -c "SELECT * FROM vocab.concept_tree LIMIT 0;"`
Expected: Empty result set with correct columns.

- [ ] **Step 5: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/2026_04_03_100000_create_vocab_concept_tree_table.php backend/app/Models/Vocabulary/ConceptTree.php
git commit -m "feat: add vocab.concept_tree migration and model"
```

---

### Task 2: HierarchyBuilderService — Core Build Logic

**Files:**
- Create: `backend/app/Services/Vocabulary/HierarchyBuilderService.php`

This service builds `vocab.concept_tree` from `vocab.concept_ancestor` + `vocab.concept`. It handles SNOMED domains (Condition, Procedure, Measurement, Observation, Visit) and the Drug domain (ATC + RxNorm Ingredient).

- [ ] **Step 1: Create the service**

```php
<?php

namespace App\Services\Vocabulary;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class HierarchyBuilderService
{
    /**
     * Domains using SNOMED CT hierarchy.
     */
    private const SNOMED_DOMAINS = ['Condition', 'Procedure', 'Measurement', 'Observation', 'Visit'];

    /**
     * Build concept_tree for all supported domains.
     */
    public function buildAll(): array
    {
        $stats = [];

        foreach (self::SNOMED_DOMAINS as $domain) {
            $stats[$domain] = $this->buildSnomedDomain($domain);
        }

        $stats['Drug'] = $this->buildDrugDomain();

        return $stats;
    }

    /**
     * Build concept_tree for a single domain.
     */
    public function buildDomain(string $domain): int
    {
        if ($domain === 'Drug') {
            return $this->buildDrugDomain();
        }

        return $this->buildSnomedDomain($domain);
    }

    /**
     * Build SNOMED-based hierarchy for a given domain.
     * Finds all direct parent-child edges where both concepts are standard SNOMED in the domain.
     * Then discovers root concepts (those with no parent) and inserts synthetic root entries.
     */
    private function buildSnomedDomain(string $domain): int
    {
        $conn = DB::connection('omop');

        // Delete existing rows for this domain
        $conn->table('concept_tree')->where('domain_id', $domain)->delete();

        // Insert direct parent-child edges from concept_ancestor
        // Both parent and child must be standard SNOMED concepts in this domain
        $inserted = $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                ca.ancestor_concept_id,
                ca.descendant_concept_id,
                ?,
                0,  -- depth computed later
                child.vocabulary_id,
                child.concept_class_id,
                child.concept_name
            FROM vocab.concept_ancestor ca
            JOIN vocab.concept parent ON parent.concept_id = ca.ancestor_concept_id
            JOIN vocab.concept child ON child.concept_id = ca.descendant_concept_id
            WHERE ca.min_levels_of_separation = 1
              AND parent.vocabulary_id = 'SNOMED'
              AND parent.standard_concept = 'S'
              AND parent.domain_id = ?
              AND child.vocabulary_id = 'SNOMED'
              AND child.standard_concept = 'S'
              AND child.domain_id = ?
        ", [$domain, $domain, $domain]);

        // Find root concepts: standard SNOMED concepts in this domain with no same-domain SNOMED parent
        $roots = $conn->select("
            SELECT c.concept_id, c.concept_name, c.vocabulary_id, c.concept_class_id
            FROM vocab.concept c
            WHERE c.vocabulary_id = 'SNOMED'
              AND c.standard_concept = 'S'
              AND c.domain_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM vocab.concept_tree ct
                WHERE ct.child_concept_id = c.concept_id
                  AND ct.domain_id = ?
              )
        ", [$domain, $domain]);

        // Insert synthetic root entries (parent_concept_id = 0)
        foreach ($roots as $root) {
            $conn->table('concept_tree')->insert([
                'parent_concept_id' => 0,
                'child_concept_id' => $root->concept_id,
                'domain_id' => $domain,
                'child_depth' => 0,
                'vocabulary_id' => $root->vocabulary_id,
                'concept_class_id' => $root->concept_class_id,
                'child_name' => $root->concept_name,
            ]);
        }

        // Compute depths via iterative update from roots
        $this->computeDepths($conn, $domain);

        $count = $conn->table('concept_tree')->where('domain_id', $domain)->count();

        Log::info("HierarchyBuilderService: built {$domain}", [
            'edges' => $count,
            'roots' => count($roots),
        ]);

        return $count;
    }

    /**
     * Build Drug hierarchy using ATC classification + RxNorm Ingredient leaf nodes.
     * ATC 1st -> 2nd -> 3rd -> 4th -> 5th -> RxNorm Ingredient
     */
    private function buildDrugDomain(): int
    {
        $conn = DB::connection('omop');
        $domain = 'Drug';

        // Delete existing Drug rows
        $conn->table('concept_tree')->where('domain_id', $domain)->delete();

        // Insert ATC internal hierarchy (ATC 1st through ATC 5th)
        // ATC concepts have standard_concept = 'C' (Classification)
        $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                ca.ancestor_concept_id,
                ca.descendant_concept_id,
                'Drug',
                0,
                child.vocabulary_id,
                child.concept_class_id,
                child.concept_name
            FROM vocab.concept_ancestor ca
            JOIN vocab.concept parent ON parent.concept_id = ca.ancestor_concept_id
            JOIN vocab.concept child ON child.concept_id = ca.descendant_concept_id
            WHERE ca.min_levels_of_separation = 1
              AND parent.vocabulary_id = 'ATC'
              AND child.vocabulary_id = 'ATC'
        ");

        // Insert ATC 5th -> RxNorm Ingredient edges
        $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                ca.ancestor_concept_id,
                ca.descendant_concept_id,
                'Drug',
                0,
                child.vocabulary_id,
                child.concept_class_id,
                child.concept_name
            FROM vocab.concept_ancestor ca
            JOIN vocab.concept parent ON parent.concept_id = ca.ancestor_concept_id
            JOIN vocab.concept child ON child.concept_id = ca.descendant_concept_id
            WHERE ca.min_levels_of_separation = 1
              AND parent.vocabulary_id = 'ATC'
              AND parent.concept_class_id = 'ATC 5th'
              AND child.vocabulary_id = 'RxNorm'
              AND child.concept_class_id = 'Ingredient'
              AND child.standard_concept = 'S'
            ON CONFLICT (parent_concept_id, child_concept_id) DO NOTHING
        ");

        // Insert synthetic roots for ATC 1st-level classes (parent_concept_id = 0)
        $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                0,
                c.concept_id,
                'Drug',
                0,
                c.vocabulary_id,
                c.concept_class_id,
                c.concept_name
            FROM vocab.concept c
            WHERE c.vocabulary_id = 'ATC'
              AND c.concept_class_id = 'ATC 1st'
            ON CONFLICT (parent_concept_id, child_concept_id) DO NOTHING
        ");

        // Compute depths
        $this->computeDepths($conn, $domain);

        $count = $conn->table('concept_tree')->where('domain_id', $domain)->count();

        Log::info("HierarchyBuilderService: built Drug", ['edges' => $count]);

        return $count;
    }

    /**
     * Compute child_depth for all rows in a domain by iterating from roots (depth 0).
     */
    private function computeDepths($conn, string $domain): void
    {
        // Roots already have depth 0
        $depth = 0;
        $maxIterations = 25; // Safety limit (max observed depth is 20)

        while ($depth < $maxIterations) {
            $updated = $conn->update("
                UPDATE vocab.concept_tree ct
                SET child_depth = ?
                FROM vocab.concept_tree parent_row
                WHERE parent_row.child_concept_id = ct.parent_concept_id
                  AND parent_row.domain_id = ?
                  AND parent_row.child_depth = ?
                  AND ct.domain_id = ?
                  AND ct.child_depth = 0
                  AND ct.parent_concept_id != 0
            ", [$depth + 1, $domain, $depth, $domain]);

            if ($updated === 0) {
                break;
            }

            $depth++;
        }
    }

    /**
     * Populate {results_schema}.concept_hierarchy from concept_tree for all sources with a results daimon.
     */
    public function populateResultsSchemas(): array
    {
        $sources = DB::connection('pgsql')
            ->table('source_daimons')
            ->where('daimon_type', 'results')
            ->pluck('table_qualifier')
            ->unique()
            ->toArray();

        $stats = [];
        foreach ($sources as $schema) {
            $stats[$schema] = $this->populateResultsSchema($schema);
        }

        return $stats;
    }

    /**
     * Populate a single results schema's concept_hierarchy table from concept_tree.
     *
     * Maps concept_tree depths to the level1/level2/level3 columns:
     * - level1 = ancestor at depth 1 (SOC equivalent, direct child of domain root)
     * - level2 = ancestor at depth 2
     * - level3 = ancestor at depth 3
     * - Leaf concepts deeper than 3 roll up to their depth-3 ancestor.
     *
     * The treemap column maps domain_id to the labels expected by
     * AchillesResultReaderService::DOMAIN_TREEMAP_MAP.
     */
    public function populateResultsSchema(string $schema): int
    {
        $conn = DB::connection('omop');

        // Check table exists
        $tableExists = $conn->select("
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ? AND table_name = 'concept_hierarchy'
        ", [$schema]);

        if (empty($tableExists)) {
            Log::warning("HierarchyBuilderService: no concept_hierarchy table in {$schema}, skipping");

            return 0;
        }

        // Truncate existing data
        $conn->statement("TRUNCATE TABLE {$schema}.concept_hierarchy");

        // Build concept_hierarchy from concept_tree.
        // For each leaf concept in concept_tree, walk up to find ancestors at depth 1, 2, 3.
        // Use self-joins on concept_tree to find the ancestor path.
        $conn->statement("
            INSERT INTO {$schema}.concept_hierarchy
                (concept_id, concept_name, treemap, concept_hierarchy_type,
                 level1_concept_id, level1_concept_name,
                 level2_concept_id, level2_concept_name,
                 level3_concept_id, level3_concept_name)
            SELECT
                leaf.child_concept_id AS concept_id,
                leaf.child_name AS concept_name,
                leaf.domain_id AS treemap,
                leaf.vocabulary_id AS concept_hierarchy_type,
                l1.child_concept_id AS level1_concept_id,
                l1.child_name AS level1_concept_name,
                l2.child_concept_id AS level2_concept_id,
                l2.child_name AS level2_concept_name,
                l3.child_concept_id AS level3_concept_id,
                l3.child_name AS level3_concept_name
            FROM vocab.concept_tree leaf
            -- Walk up to find depth-1 ancestor (level1 = SOC equivalent)
            LEFT JOIN LATERAL (
                SELECT ct.child_concept_id, ct.child_name
                FROM vocab.concept_tree ct
                JOIN vocab.concept_ancestor ca ON ca.ancestor_concept_id = ct.child_concept_id
                    AND ca.descendant_concept_id = leaf.child_concept_id
                WHERE ct.domain_id = leaf.domain_id AND ct.child_depth = 1
                LIMIT 1
            ) l1 ON true
            -- Walk up to find depth-2 ancestor (level2)
            LEFT JOIN LATERAL (
                SELECT ct.child_concept_id, ct.child_name
                FROM vocab.concept_tree ct
                JOIN vocab.concept_ancestor ca ON ca.ancestor_concept_id = ct.child_concept_id
                    AND ca.descendant_concept_id = leaf.child_concept_id
                WHERE ct.domain_id = leaf.domain_id AND ct.child_depth = 2
                LIMIT 1
            ) l2 ON true
            -- Walk up to find depth-3 ancestor (level3)
            LEFT JOIN LATERAL (
                SELECT ct.child_concept_id, ct.child_name
                FROM vocab.concept_tree ct
                JOIN vocab.concept_ancestor ca ON ca.ancestor_concept_id = ct.child_concept_id
                    AND ca.descendant_concept_id = leaf.child_concept_id
                WHERE ct.domain_id = leaf.domain_id AND ct.child_depth = 3
                LIMIT 1
            ) l3 ON true
            WHERE leaf.parent_concept_id != 0  -- exclude synthetic roots
        ");

        $count = $conn->selectOne("SELECT COUNT(*) as cnt FROM {$schema}.concept_hierarchy")->cnt;

        Log::info("HierarchyBuilderService: populated {$schema}.concept_hierarchy", ['rows' => $count]);

        return $count;
    }
}
```

- [ ] **Step 2: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Vocabulary/HierarchyBuilderService.php
git commit -m "feat: add HierarchyBuilderService for concept_tree population"
```

---

### Task 3: Artisan Command & Auto-trigger

**Files:**
- Create: `backend/app/Console/Commands/BuildConceptHierarchy.php`
- Modify: `backend/app/Console/Commands/LoadVocabularies.php`

- [ ] **Step 1: Create the Artisan command**

```php
<?php

namespace App\Console\Commands;

use App\Services\Vocabulary\HierarchyBuilderService;
use Illuminate\Console\Command;

class BuildConceptHierarchy extends Command
{
    protected $signature = 'vocabulary:build-hierarchy
        {--domain= : Build for specific domain only (Condition, Drug, Procedure, Measurement, Observation, Visit)}
        {--fresh : Drop and rebuild concept_tree from scratch}
        {--populate-results : Also populate concept_hierarchy in all results schemas}';

    protected $description = 'Build vocab.concept_tree from concept_ancestor and optionally populate results schemas';

    public function handle(HierarchyBuilderService $service): int
    {
        $domain = $this->option('domain');

        if ($this->option('fresh')) {
            $this->info('Truncating vocab.concept_tree...');
            \Illuminate\Support\Facades\DB::connection('omop')->table('concept_tree')->truncate();
        }

        if ($domain) {
            $this->info("Building concept_tree for {$domain}...");
            $count = $service->buildDomain($domain);
            $this->info("  {$domain}: {$count} edges");
        } else {
            $this->info('Building concept_tree for all domains...');
            $stats = $service->buildAll();
            foreach ($stats as $d => $count) {
                $this->info("  {$d}: {$count} edges");
            }
        }

        if ($this->option('populate-results')) {
            $this->info('Populating results schemas...');
            $results = $service->populateResultsSchemas();
            foreach ($results as $schema => $count) {
                $this->info("  {$schema}: {$count} rows");
            }
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Add auto-trigger to LoadVocabularies**

Read `backend/app/Console/Commands/LoadVocabularies.php` and find the end of the `handle()` method. Add the following before the final return statement:

```php
$this->newLine();
$this->info('Building concept hierarchy tree...');
$this->call('vocabulary:build-hierarchy', ['--populate-results' => true]);
```

- [ ] **Step 3: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 4: Test the command manually**

Run: `docker compose exec -T php php artisan vocabulary:build-hierarchy --fresh --populate-results`
Expected: Output showing edge counts per domain and row counts per results schema. Should complete in under 2 minutes.

- [ ] **Step 5: Verify data**

Run: `psql -U smudoshi -d parthenon -c "SELECT domain_id, COUNT(*) as edges FROM vocab.concept_tree GROUP BY domain_id ORDER BY domain_id;"`
Expected: Rows for Condition, Drug, Measurement, Observation, Procedure, Visit.

Run: `psql -U smudoshi -d parthenon -c "SELECT treemap, COUNT(*) FROM results.concept_hierarchy GROUP BY treemap ORDER BY treemap;"`
Expected: Rows for each domain with concept_hierarchy populated.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Console/Commands/BuildConceptHierarchy.php backend/app/Console/Commands/LoadVocabularies.php
git commit -m "feat: add vocabulary:build-hierarchy command with auto-trigger"
```

---

### Task 4: Fix Vocabulary Hierarchy Endpoint (Backend)

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/VocabularyController.php` (rewrite `hierarchy()` method at line 247)

The current `hierarchy()` method returns a flat array of ancestors. Rewrite it to return a nested tree matching the `ConceptHierarchyNode` interface: ancestors above (with siblings at each level), selected concept marked `is_current: true`, and immediate children below.

- [ ] **Step 1: Rewrite the hierarchy method**

Replace the existing `hierarchy()` method (lines 247-272) in `VocabularyController.php` with:

```php
    /**
     * GET /v1/vocabulary/concepts/{id}/hierarchy
     *
     * Return a nested hierarchy tree for a concept:
     * ancestors (with siblings at each level) -> selected concept (is_current) -> children.
     */
    public function hierarchy(int $id): JsonResponse
    {
        $concept = Concept::findOrFail($id);

        // Get ancestor path ordered from root to immediate parent
        $ancestors = DB::connection($concept->getConnectionName())
            ->select("
                SELECT
                    ca.ancestor_concept_id AS concept_id,
                    c.concept_name,
                    c.domain_id,
                    c.vocabulary_id,
                    c.concept_class_id,
                    c.standard_concept,
                    ca.min_levels_of_separation AS distance
                FROM vocab.concept_ancestor ca
                JOIN vocab.concept c ON c.concept_id = ca.ancestor_concept_id
                WHERE ca.descendant_concept_id = ?
                  AND ca.min_levels_of_separation > 0
                  AND c.standard_concept IN ('S', 'C')
                ORDER BY ca.min_levels_of_separation DESC
            ", [$id]);

        // Get immediate children of the selected concept
        $children = DB::connection($concept->getConnectionName())
            ->select("
                SELECT
                    ca.descendant_concept_id AS concept_id,
                    c.concept_name,
                    c.domain_id,
                    c.vocabulary_id,
                    c.concept_class_id,
                    c.standard_concept
                FROM vocab.concept_ancestor ca
                JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
                WHERE ca.ancestor_concept_id = ?
                  AND ca.min_levels_of_separation = 1
                  AND c.standard_concept IN ('S', 'C')
                ORDER BY c.concept_name
                LIMIT 50
            ", [$id]);

        // Get siblings at each ancestor level (concepts sharing the same parent)
        $siblingsByParent = [];
        foreach ($ancestors as $i => $ancestor) {
            if ($i === 0) {
                continue; // root has no parent to find siblings under
            }
            $parentId = $ancestors[$i - 1]->concept_id;
            $siblings = DB::connection($concept->getConnectionName())
                ->select("
                    SELECT
                        ca.descendant_concept_id AS concept_id,
                        c.concept_name,
                        c.domain_id,
                        c.vocabulary_id,
                        c.concept_class_id,
                        c.standard_concept
                    FROM vocab.concept_ancestor ca
                    JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
                    WHERE ca.ancestor_concept_id = ?
                      AND ca.min_levels_of_separation = 1
                      AND ca.descendant_concept_id != ?
                      AND c.standard_concept IN ('S', 'C')
                    ORDER BY c.concept_name
                    LIMIT 50
                ", [$parentId, $ancestor->concept_id]);
            $siblingsByParent[$ancestor->concept_id] = $siblings;
        }

        // Also get siblings of the selected concept itself
        if (! empty($ancestors)) {
            $immediateParentId = $ancestors[count($ancestors) - 1]->concept_id;
            $selfSiblings = DB::connection($concept->getConnectionName())
                ->select("
                    SELECT
                        ca.descendant_concept_id AS concept_id,
                        c.concept_name,
                        c.domain_id,
                        c.vocabulary_id,
                        c.concept_class_id,
                        c.standard_concept
                    FROM vocab.concept_ancestor ca
                    JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
                    WHERE ca.ancestor_concept_id = ?
                      AND ca.min_levels_of_separation = 1
                      AND ca.descendant_concept_id != ?
                      AND c.standard_concept IN ('S', 'C')
                    ORDER BY c.concept_name
                    LIMIT 50
                ", [$immediateParentId, $id]);
        } else {
            $selfSiblings = [];
        }

        // Build the selected concept node
        $currentNode = [
            'concept_id' => $concept->concept_id,
            'concept_name' => $concept->concept_name,
            'domain_id' => $concept->domain_id,
            'vocabulary_id' => $concept->vocabulary_id,
            'concept_class_id' => $concept->concept_class_id,
            'standard_concept' => $concept->standard_concept,
            'depth' => 0,
            'is_current' => true,
            'children' => array_map(fn ($c) => [
                'concept_id' => $c->concept_id,
                'concept_name' => $c->concept_name,
                'domain_id' => $c->domain_id,
                'vocabulary_id' => $c->vocabulary_id,
                'concept_class_id' => $c->concept_class_id,
                'standard_concept' => $c->standard_concept,
                'depth' => 1,
            ], $children),
        ];

        // Build sibling nodes for the selected concept
        $selfSiblingNodes = array_map(fn ($s) => [
            'concept_id' => $s->concept_id,
            'concept_name' => $s->concept_name,
            'domain_id' => $s->domain_id,
            'vocabulary_id' => $s->vocabulary_id,
            'concept_class_id' => $s->concept_class_id,
            'standard_concept' => $s->standard_concept,
            'depth' => 0,
        ], $selfSiblings);

        // Wrap: immediate parent contains current node + its siblings
        $currentLevel = array_merge([$currentNode], $selfSiblingNodes);

        // Build tree bottom-up: wrap each ancestor level around the current level
        $depth = 0;
        for ($i = count($ancestors) - 1; $i >= 0; $i--) {
            $ancestor = $ancestors[$i];
            $depth++;

            // Sibling nodes at this level
            $levelSiblings = array_map(fn ($s) => [
                'concept_id' => $s->concept_id,
                'concept_name' => $s->concept_name,
                'domain_id' => $s->domain_id,
                'vocabulary_id' => $s->vocabulary_id,
                'concept_class_id' => $s->concept_class_id,
                'standard_concept' => $s->standard_concept,
                'depth' => $depth,
            ], $siblingsByParent[$ancestor->concept_id] ?? []);

            $ancestorNode = [
                'concept_id' => $ancestor->concept_id,
                'concept_name' => $ancestor->concept_name,
                'domain_id' => $ancestor->domain_id,
                'vocabulary_id' => $ancestor->vocabulary_id,
                'concept_class_id' => $ancestor->concept_class_id,
                'standard_concept' => $ancestor->standard_concept,
                'depth' => $depth,
                'children' => $currentLevel,
            ];

            $currentLevel = array_merge([$ancestorNode], $levelSiblings);
        }

        // If there's a single root, return it directly. Otherwise wrap in a virtual root.
        $tree = count($currentLevel) === 1 ? $currentLevel[0] : [
            'concept_id' => 0,
            'concept_name' => $concept->domain_id,
            'domain_id' => $concept->domain_id,
            'vocabulary_id' => '',
            'concept_class_id' => '',
            'standard_concept' => null,
            'depth' => $depth + 1,
            'children' => $currentLevel,
        ];

        return response()->json(['data' => $tree]);
    }
```

- [ ] **Step 2: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 3: Test the endpoint**

Run: `curl -s -H "Authorization: Bearer $(curl -s -X POST http://localhost:8082/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@acumenus.net","password":"REDACTED"}' | jq -r '.token')" http://localhost:8082/api/v1/vocabulary/concepts/201826/hierarchy | jq '.data.concept_name, .data.children[0].concept_name'`

Test with concept 201826 (Type 2 diabetes mellitus). Expected: nested tree with `is_current: true` on the selected concept, ancestors above, children below.

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/VocabularyController.php
git commit -m "fix: rewrite vocabulary hierarchy endpoint to return nested tree"
```

---

### Task 5: Add Vocabulary Tree Browse Endpoint (Backend)

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/VocabularyController.php` — add `tree()` method
- Modify: `backend/routes/api.php` — add route

- [ ] **Step 1: Add the tree method to VocabularyController**

Add this method to `VocabularyController`:

```php
    /**
     * GET /v1/vocabulary/tree
     *
     * Browse the concept_tree. Returns children of a given parent concept.
     * parent_concept_id=0 (default) returns domain roots.
     */
    public function tree(Request $request): JsonResponse
    {
        $parentId = (int) $request->query('parent_concept_id', '0');
        $domainId = $request->query('domain_id');

        $query = DB::connection('omop')
            ->table('concept_tree AS ct')
            ->select([
                'ct.child_concept_id AS concept_id',
                'ct.child_name AS concept_name',
                'ct.domain_id',
                'ct.vocabulary_id',
                'ct.concept_class_id',
                'ct.child_depth AS depth',
            ])
            ->selectRaw('(SELECT COUNT(*) FROM vocab.concept_tree ct2 WHERE ct2.parent_concept_id = ct.child_concept_id AND ct2.domain_id = ct.domain_id) AS child_count')
            ->where('ct.parent_concept_id', $parentId);

        if ($domainId) {
            $query->where('ct.domain_id', $domainId);
        }

        $results = $query->orderBy('ct.child_name')->limit(500)->get();

        return response()->json([
            'data' => $results,
            'parent_concept_id' => $parentId,
        ]);
    }
```

- [ ] **Step 2: Add the route**

In `backend/routes/api.php`, add the route near the other vocabulary routes (around line 195, after the semantic-search route):

```php
        Route::get('/vocabulary/tree', [VocabularyController::class, 'tree']);
```

Note: this must come BEFORE the `/vocabulary/concepts/{id}` route to avoid `tree` being interpreted as an `{id}` parameter.

- [ ] **Step 3: Add `use Illuminate\Http\Request;` import if not already present**

Check the top of `VocabularyController.php` for the Request import. Add if missing:
```php
use Illuminate\Http\Request;
```

- [ ] **Step 4: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 5: Verify route registration**

Run: `docker compose exec -T php php artisan route:list --path=vocabulary/tree`
Expected: Shows the GET route for vocabulary/tree.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/VocabularyController.php backend/routes/api.php
git commit -m "feat: add vocabulary tree browse endpoint"
```

---

### Task 6: Frontend Types and API Function

**Files:**
- Modify: `frontend/src/features/vocabulary/types/vocabulary.ts` — add `ConceptTreeNode`
- Modify: `frontend/src/features/vocabulary/api/vocabularyApi.ts` — add `fetchConceptTreeChildren()`
- Create: `frontend/src/features/vocabulary/hooks/useConceptTree.ts`

- [ ] **Step 1: Add ConceptTreeNode type**

Add to the end of `frontend/src/features/vocabulary/types/vocabulary.ts` (before the closing, after `MapsFromResult`):

```typescript
export interface ConceptTreeNode {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  child_count: number;
  depth: number;
}
```

- [ ] **Step 2: Add fetchConceptTreeChildren API function**

Add to `frontend/src/features/vocabulary/api/vocabularyApi.ts` (before the final `export type` line):

```typescript
export async function fetchConceptTreeChildren(
  parentConceptId: number,
  domainId?: string,
): Promise<ConceptTreeNode[]> {
  const params: Record<string, unknown> = { parent_concept_id: parentConceptId };
  if (domainId) {
    params.domain_id = domainId;
  }
  const { data } = await apiClient.get(`${BASE}/tree`, { params });
  return data.data ?? [];
}
```

Also add `ConceptTreeNode` to the import list at the top of the file:

```typescript
import type {
  // ... existing imports ...
  ConceptTreeNode,
} from "../types/vocabulary";
```

- [ ] **Step 3: Create useConceptTree hook**

Create `frontend/src/features/vocabulary/hooks/useConceptTree.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchConceptTreeChildren } from "../api/vocabularyApi";

export function useConceptTree(parentConceptId: number, domainId?: string) {
  return useQuery({
    queryKey: ["vocabulary", "tree", parentConceptId, domainId],
    queryFn: () => fetchConceptTreeChildren(parentConceptId, domainId),
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/vocabulary/types/vocabulary.ts frontend/src/features/vocabulary/api/vocabularyApi.ts frontend/src/features/vocabulary/hooks/useConceptTree.ts
git commit -m "feat: add ConceptTreeNode type, API function, and useConceptTree hook"
```

---

### Task 7: HierarchyBrowserPanel Component

**Files:**
- Create: `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx`

This component provides the cross-domain hierarchy browser. Top level shows domain roots, clicking drills into children via lazy-loaded API calls. Clicking a leaf concept opens it in the ConceptDetailPanel.

- [ ] **Step 1: Create HierarchyBrowserPanel**

```tsx
import { useState, useMemo } from "react";
import { ChevronRight, FolderTree, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConceptTree } from "../hooks/useConceptTree";
import type { ConceptTreeNode } from "../types/vocabulary";

interface HierarchyBrowserPanelProps {
  mode: "browse";
  onSelectConcept: (id: number) => void;
}

interface BreadcrumbEntry {
  concept_id: number;
  concept_name: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  Condition: "#E5A84B",
  Drug: "#60A5FA",
  Procedure: "#2DD4BF",
  Measurement: "#A855F7",
  Observation: "#F472B6",
  Visit: "#34D399",
};

export function HierarchyBrowserPanel({
  onSelectConcept,
}: HierarchyBrowserPanelProps) {
  const [parentId, setParentId] = useState(0);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);

  const { data: nodes, isLoading } = useConceptTree(parentId);

  const sortedNodes = useMemo(() => {
    if (!nodes) return [];
    return [...nodes].sort((a, b) => a.concept_name.localeCompare(b.concept_name));
  }, [nodes]);

  const handleDrillDown = (node: ConceptTreeNode) => {
    if (node.child_count > 0) {
      setBreadcrumbs((prev) => [
        ...prev,
        { concept_id: node.concept_id, concept_name: node.concept_name },
      ]);
      setParentId(node.concept_id);
    } else {
      onSelectConcept(node.concept_id);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root
      setBreadcrumbs([]);
      setParentId(0);
    } else {
      const entry = breadcrumbs[index];
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
      setParentId(entry.concept_id);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 border-b border-[#232328] bg-[#0E0E11] px-4 py-2.5 text-xs shrink-0 flex-wrap">
        <button
          type="button"
          onClick={() => handleBreadcrumbClick(-1)}
          className={cn(
            "hover:text-[#F0EDE8] transition-colors",
            breadcrumbs.length === 0 ? "text-[#C9A227] font-medium" : "text-[#8A857D]",
          )}
        >
          All Domains
        </button>
        {breadcrumbs.map((bc, i) => (
          <span key={bc.concept_id} className="flex items-center gap-1">
            <ChevronRight size={10} className="text-[#5A5650]" />
            <button
              type="button"
              onClick={() => handleBreadcrumbClick(i)}
              className={cn(
                "hover:text-[#F0EDE8] transition-colors truncate max-w-[200px]",
                i === breadcrumbs.length - 1
                  ? "text-[#C9A227] font-medium"
                  : "text-[#8A857D]",
              )}
              title={bc.concept_name}
            >
              {bc.concept_name}
            </button>
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : sortedNodes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-[#5A5650]">No concepts found</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sortedNodes.map((node) => (
              <button
                key={node.concept_id}
                type="button"
                onClick={() => handleDrillDown(node)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#1C1C20] transition-colors text-left group"
              >
                {/* Domain color indicator */}
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: DOMAIN_COLORS[node.domain_id] ?? "#8A857D",
                  }}
                />

                {/* Icon */}
                {node.child_count > 0 ? (
                  <FolderTree size={12} className="text-[#8A857D] shrink-0" />
                ) : (
                  <span className="w-3 shrink-0" />
                )}

                {/* Name */}
                <span className="text-xs text-[#F0EDE8] truncate flex-1">
                  {node.concept_name}
                </span>

                {/* Metadata */}
                <span className="text-[9px] text-[#5A5650] font-['IBM_Plex_Mono',monospace] shrink-0">
                  {node.concept_id}
                </span>

                {node.child_count > 0 && (
                  <span className="text-[9px] text-[#8A857D] shrink-0">
                    ({node.child_count})
                  </span>
                )}

                {node.child_count > 0 && (
                  <ChevronRight
                    size={10}
                    className="text-[#5A5650] group-hover:text-[#8A857D] shrink-0"
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx
git commit -m "feat: add HierarchyBrowserPanel for cross-domain vocabulary browsing"
```

---

### Task 8: Add Browse Tab to VocabularyPage

**Files:**
- Modify: `frontend/src/features/vocabulary/pages/VocabularyPage.tsx`

- [ ] **Step 1: Add the Browse tab**

In `VocabularyPage.tsx`, make these changes:

1. Add import at the top:
```typescript
import { FolderTree } from "lucide-react";
import { HierarchyBrowserPanel } from "../components/HierarchyBrowserPanel";
```

2. Change the `SearchTab` type (line 8):
```typescript
type SearchTab = "keyword" | "semantic" | "browse";
```

3. Add the third tab to the `tabs` array (after the "semantic" entry, around line 43):
```typescript
    {
      id: "browse",
      label: "Browse Hierarchy",
      icon: <FolderTree size={13} />,
    },
```

4. Add the third rendering branch in the active search panel (after the SemanticSearchPanel, around line 103):
```typescript
              ) : activeTab === "browse" ? (
                <HierarchyBrowserPanel
                  mode="browse"
                  onSelectConcept={handleSelectConcept}
                />
```

The full conditional becomes:
```typescript
              {activeTab === "keyword" ? (
                <VocabularySearchPanel
                  mode="browse"
                  selectedConceptId={selectedConceptId}
                  onSelectConcept={handleSelectConcept}
                />
              ) : activeTab === "semantic" ? (
                <SemanticSearchPanel
                  mode="browse"
                  onSelectConcept={handleSelectConcept}
                />
              ) : activeTab === "browse" ? (
                <HierarchyBrowserPanel
                  mode="browse"
                  onSelectConcept={handleSelectConcept}
                />
              ) : null}
```

5. Update the tab active color for browse (match the semantic tab pattern — use teal for Browse):

In the tab button className (around line 80), update the ternary:
```typescript
                    activeTab === tab.id
                      ? tab.id === "keyword"
                        ? "border-b-2 border-[#C9A227] text-[#C9A227] bg-[#C9A227]/5"
                        : "border-b-2 border-[#2DD4BF] text-[#2DD4BF] bg-[#2DD4BF]/5"
                      : "text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1C1C20]",
```

This gives keyword gold styling and both semantic + browse teal styling (consistent with the clinical theme).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors.

- [ ] **Step 3: Verify Vite build**

Run: `docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/vocabulary/pages/VocabularyPage.tsx
git commit -m "feat: add Browse Hierarchy tab to Vocabulary page"
```

---

### Task 9: Verify End-to-End & Deploy

- [ ] **Step 1: Run TypeScript check**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors.

- [ ] **Step 2: Run Vite build**

Run: `docker compose exec -T node sh -c "cd /app && npx vite build"`
Expected: Build succeeds.

- [ ] **Step 3: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test"`
Expected: No formatting issues.

- [ ] **Step 4: Verify Vocabulary Hierarchy tab works**

1. Open http://localhost:5175 (or localhost:8082)
2. Navigate to Vocabulary Browser
3. Search for "Type 2 diabetes mellitus" (concept 201826)
4. Click the concept to open detail panel
5. Click the "Hierarchy" tab
6. Expected: nested tree showing ancestors above, concept highlighted in teal, children below

- [ ] **Step 5: Verify Browse tab works**

1. Click the "Browse Hierarchy" tab
2. Expected: domain roots listed (Condition, Drug, Procedure, etc.)
3. Click "Condition" root → should show 25 direct children
4. Click a child → drill deeper
5. Breadcrumb navigation works
6. Clicking a leaf concept opens it in the detail panel

- [ ] **Step 6: Verify Data Explorer treemaps populated**

1. Navigate to Data Explorer
2. Select a source (e.g., Acumenus)
3. Click Conditions tab
4. Expected: treemap should show hierarchical data (if Achilles results exist for the source)

- [ ] **Step 7: Deploy frontend**

Run: `./deploy.sh --frontend`
Expected: Production build deployed.
