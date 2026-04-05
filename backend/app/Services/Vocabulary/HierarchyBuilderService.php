<?php

namespace App\Services\Vocabulary;

use Illuminate\Database\Connection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use RuntimeException;

class HierarchyBuilderService
{
    /**
     * @return list<string>
     */
    public static function supportedDomains(): array
    {
        return array_keys(self::DOMAIN_VIRTUAL_ROOTS);
    }

    public function ensureConceptTreeTableExists(): void
    {
        $exists = DB::connection('omop')->selectOne("
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'vocab'
              AND table_name = 'concept_tree'
        ");

        if (! $exists) {
            throw new RuntimeException('Missing vocab.concept_tree. Create the table before running vocabulary:build-hierarchy.');
        }
    }

    public function clearConceptTree(): void
    {
        DB::connection('omop')->table('concept_tree')->delete();
    }

    /**
     * Domains using SNOMED CT hierarchy.
     */
    private const SNOMED_DOMAINS = ['Condition', 'Procedure', 'Measurement', 'Observation'];

    /**
     * Virtual domain root concept IDs. parent_concept_id=0 points to these,
     * and each domain's orphan roots point to their virtual root.
     */
    private const DOMAIN_VIRTUAL_ROOTS = [
        'Condition' => -1,
        'Drug' => -2,
        'Procedure' => -3,
        'Measurement' => -4,
        'Observation' => -5,
        'Visit' => -6,
    ];

    /**
     * Build concept_tree for all supported domains.
     */
    public function buildAll(): array
    {
        $stats = [];

        // Build unified SNOMED tree for all 4 SNOMED domains at once
        // (cross-domain edges require building them together)
        $snomedStats = $this->buildUnifiedSnomedTree();
        foreach ($snomedStats as $domain => $count) {
            $stats[$domain] = $count;
        }

        $stats['Drug'] = $this->buildDrugDomain();
        $stats['Visit'] = $this->buildVisitDomain();

        // Insert virtual domain roots (parent=0 → virtual root per domain)
        $this->insertVirtualDomainRoots();

        return $stats;
    }

    /**
     * Insert virtual domain roots (parent_concept_id=0) so the top level of the tree
     * shows exactly 6 domain entries instead of thousands of orphan concepts.
     */
    private function insertVirtualDomainRoots(): void
    {
        $conn = DB::connection('omop');

        // Remove any existing virtual roots
        $conn->table('concept_tree')->where('parent_concept_id', 0)->delete();

        $domainLabels = [
            'Condition' => 'Conditions',
            'Drug' => 'Drugs',
            'Procedure' => 'Procedures',
            'Measurement' => 'Measurements',
            'Observation' => 'Observations',
            'Visit' => 'Visits',
        ];

        foreach (self::DOMAIN_VIRTUAL_ROOTS as $domain => $virtualId) {
            $conn->table('concept_tree')->insert([
                'parent_concept_id' => 0,
                'child_concept_id' => $virtualId,
                'domain_id' => $domain,
                'child_depth' => 0,
                'vocabulary_id' => 'OMOP',
                'concept_class_id' => 'Domain',
                'child_name' => $domainLabels[$domain] ?? $domain,
            ]);
        }
    }

    /**
     * Build concept_tree for a single domain.
     *
     * SNOMED domains always rebuild all 4 together because they share
     * cross-domain edges. Drug and Visit build independently.
     */
    public function buildDomain(string $domain): int
    {
        if ($domain === 'Drug') {
            $count = $this->buildDrugDomain();
            $this->insertVirtualDomainRoots();

            return $count;
        }

        if ($domain === 'Visit') {
            $count = $this->buildVisitDomain();
            $this->insertVirtualDomainRoots();

            return $count;
        }

        if (in_array($domain, self::SNOMED_DOMAINS, true)) {
            Log::info("HierarchyBuilderService: rebuilding all SNOMED domains (requested: {$domain})");
            $stats = $this->buildUnifiedSnomedTree();
            $this->insertVirtualDomainRoots();

            return $stats[$domain] ?? 0;
        }

        throw new InvalidArgumentException("Unsupported domain: {$domain}");
    }

    /**
     * Build a unified SNOMED tree for all 4 SNOMED domains at once.
     *
     * The key fix: SNOMED's hierarchy crosses OMOP domain boundaries. For example,
     * "Cardiovascular finding" lives in the Observation domain but parents many
     * Condition concepts. The old approach filtered BOTH parent and child by the
     * same domain_id, producing hundreds of orphan roots in Condition, Measurement,
     * and Observation. This method removes the parent domain_id filter so cross-domain
     * edges are preserved, and tags each edge with the CHILD's domain_id.
     *
     * @return array<string, int> Per-domain edge counts
     */
    private function buildUnifiedSnomedTree(): array
    {
        $conn = DB::connection('omop');
        $stats = [];

        // Delete existing rows for all SNOMED domains
        $conn->table('concept_tree')
            ->whereIn('domain_id', self::SNOMED_DOMAINS)
            ->delete();

        // Insert ALL direct parent-child edges from concept_ancestor where both
        // parent and child are standard SNOMED concepts. The critical fix vs the old
        // buildSnomedDomain(): NO domain_id filter on the parent. SNOMED's hierarchy
        // crosses OMOP domain boundaries (e.g., "Cardiovascular finding" in Observation
        // parents "Heart disease" in Condition). Each edge is tagged with the CHILD's
        // domain_id so domain-filtered tree queries work correctly.
        $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                ca.ancestor_concept_id,
                ca.descendant_concept_id,
                child.domain_id,
                -1,
                child.vocabulary_id,
                child.concept_class_id,
                child.concept_name
            FROM vocab.concept_ancestor ca
            JOIN vocab.concept parent ON parent.concept_id = ca.ancestor_concept_id
            JOIN vocab.concept child ON child.concept_id = ca.descendant_concept_id
            WHERE ca.min_levels_of_separation = 1
              AND parent.vocabulary_id = 'SNOMED'
              AND parent.standard_concept = 'S'
              AND child.vocabulary_id = 'SNOMED'
              AND child.standard_concept = 'S'
              AND child.domain_id IN ('Condition', 'Procedure', 'Measurement', 'Observation')
            ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
        ");

        // For each domain, propagate cross-domain parent chains and find roots.
        //
        // Problem: Edge (CardiovascularFinding[Obs] → HeartDisease[Cond]) is tagged
        // domain=Condition. But (ClinicalFinding[Cond] → CardiovascularFinding[Obs])
        // is tagged domain=Observation. So CardiovascularFinding becomes an orphan
        // root in the Condition tree — 688 such orphans for Condition alone.
        //
        // Fix: Iteratively walk UP from cross-domain roots, adding their parent edges
        // tagged with the target domain, until we reach true SNOMED roots.
        foreach (self::SNOMED_DOMAINS as $domain) {
            $virtualRootId = self::DOMAIN_VIRTUAL_ROOTS[$domain];

            // Phase 1: Insert initial virtual roots (concepts that parent domain edges
            // but have no incoming domain edge)
            $conn->statement("
                INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
                SELECT DISTINCT
                    {$virtualRootId},
                    c.concept_id,
                    ?,
                    1,
                    c.vocabulary_id,
                    c.concept_class_id,
                    c.concept_name
                FROM vocab.concept c
                WHERE c.vocabulary_id = 'SNOMED'
                  AND c.standard_concept = 'S'
                  AND EXISTS (
                    SELECT 1 FROM vocab.concept_tree ct
                    WHERE ct.parent_concept_id = c.concept_id
                      AND ct.domain_id = ?
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM vocab.concept_tree ct2
                    WHERE ct2.child_concept_id = c.concept_id
                      AND ct2.domain_id = ?
                  )
                ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
            ", [$domain, $domain, $domain]);

            // Phase 2: Propagate cross-domain parent chains upward.
            // For cross-domain roots (under virtual root, from a different OMOP domain),
            // find their SNOMED parents and add those edges tagged with this domain.
            // Then remove the cross-domain concept from the virtual root (it now has a
            // real parent). Repeat until no more cross-domain roots remain.
            $this->propagateCrossDomainParents($conn, $domain, $virtualRootId);

            $this->computeDepths($conn, $domain);

            $count = $conn->table('concept_tree')->where('domain_id', $domain)->count();
            $rootCount = $conn->table('concept_tree')
                ->where('parent_concept_id', $virtualRootId)
                ->where('domain_id', $domain)
                ->count();

            $stats[$domain] = $count;

            Log::info("HierarchyBuilderService: built {$domain} (unified SNOMED)", [
                'edges' => $count,
                'roots' => $rootCount,
            ]);
        }

        return $stats;
    }

    /**
     * Build Visit hierarchy using all standard Visit concepts (multiple vocabularies).
     * Visit concepts use CMS Place of Service, NUCC, UB04, Visit vocabularies — not SNOMED.
     */
    private function buildVisitDomain(): int
    {
        $conn = DB::connection('omop');
        $domain = 'Visit';

        $conn->table('concept_tree')->where('domain_id', $domain)->delete();

        // Insert direct parent-child edges (all vocabularies, standard concepts only)
        $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                ca.ancestor_concept_id,
                ca.descendant_concept_id,
                'Visit',
                -1,
                child.vocabulary_id,
                child.concept_class_id,
                child.concept_name
            FROM vocab.concept_ancestor ca
            JOIN vocab.concept parent ON parent.concept_id = ca.ancestor_concept_id
            JOIN vocab.concept child ON child.concept_id = ca.descendant_concept_id
            WHERE ca.min_levels_of_separation = 1
              AND parent.standard_concept = 'S'
              AND parent.domain_id = 'Visit'
              AND child.standard_concept = 'S'
              AND child.domain_id = 'Visit'
            ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
        ");

        // Find root concepts
        $roots = $conn->select("
            SELECT c.concept_id, c.concept_name, c.vocabulary_id, c.concept_class_id
            FROM vocab.concept c
            WHERE c.standard_concept = 'S'
              AND c.domain_id = 'Visit'
              AND NOT EXISTS (
                SELECT 1 FROM vocab.concept_tree ct
                WHERE ct.child_concept_id = c.concept_id
                  AND ct.domain_id = 'Visit'
              )
        ");

        $virtualRootId = self::DOMAIN_VIRTUAL_ROOTS[$domain];
        foreach ($roots as $root) {
            $conn->table('concept_tree')->insert([
                'parent_concept_id' => $virtualRootId,
                'child_concept_id' => $root->concept_id,
                'domain_id' => $domain,
                'child_depth' => 1,
                'vocabulary_id' => $root->vocabulary_id,
                'concept_class_id' => $root->concept_class_id,
                'child_name' => $root->concept_name,
            ]);
        }

        $this->computeDepths($conn, $domain);

        $count = $conn->table('concept_tree')->where('domain_id', $domain)->count();

        Log::info('HierarchyBuilderService: built Visit', [
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
                -1,
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
                -1,
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
            ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
        ");

        // Insert ATC 1st-level classes under virtual Drug root
        $drugVirtualRoot = self::DOMAIN_VIRTUAL_ROOTS['Drug'];
        $conn->statement("
            INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
            SELECT
                {$drugVirtualRoot},
                c.concept_id,
                'Drug',
                1,
                c.vocabulary_id,
                c.concept_class_id,
                c.concept_name
            FROM vocab.concept c
            WHERE c.vocabulary_id = 'ATC'
              AND c.concept_class_id = 'ATC 1st'
            ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
        ");

        // Compute depths
        $this->computeDepths($conn, $domain);

        $count = $conn->table('concept_tree')->where('domain_id', $domain)->count();

        Log::info('HierarchyBuilderService: built Drug', ['edges' => $count]);

        return $count;
    }

    /**
     * Propagate cross-domain parent chains for a target domain.
     *
     * Cross-domain roots are concepts under the virtual root that belong to a different
     * OMOP domain (e.g., "Cardiovascular finding" from Observation appearing as a root
     * in the Condition tree). For each, we find their SNOMED parents via concept_ancestor
     * and add those parent→child edges tagged with the target domain. Then we move the
     * cross-domain concept from the virtual root to its real parent. Repeat iteratively
     * until all cross-domain concepts have been absorbed into the tree.
     */
    private function propagateCrossDomainParents(Connection $conn, string $domain, int $virtualRootId): void
    {
        $maxIterations = 20;

        for ($i = 0; $i < $maxIterations; $i++) {
            // Find cross-domain roots: concepts under virtual root whose actual
            // domain differs from the target domain
            $crossDomainRoots = $conn->select('
                SELECT ct.child_concept_id
                FROM vocab.concept_tree ct
                JOIN vocab.concept c ON c.concept_id = ct.child_concept_id
                WHERE ct.parent_concept_id = ?
                  AND ct.domain_id = ?
                  AND c.domain_id != ?
            ', [$virtualRootId, $domain, $domain]);

            if (empty($crossDomainRoots)) {
                break;
            }

            // For each cross-domain root, add its SNOMED parent edge tagged with
            // the target domain. The parent might itself be cross-domain — that's
            // fine, it'll be handled in the next iteration.
            $inserted = $conn->affectingStatement("
                INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
                SELECT DISTINCT
                    ca.ancestor_concept_id,
                    ct_root.child_concept_id,
                    ?,
                    -1,
                    c_child.vocabulary_id,
                    c_child.concept_class_id,
                    c_child.concept_name
                FROM vocab.concept_tree ct_root
                JOIN vocab.concept c_child ON c_child.concept_id = ct_root.child_concept_id
                JOIN vocab.concept_ancestor ca ON ca.descendant_concept_id = ct_root.child_concept_id
                    AND ca.min_levels_of_separation = 1
                JOIN vocab.concept c_parent ON c_parent.concept_id = ca.ancestor_concept_id
                    AND c_parent.vocabulary_id = 'SNOMED'
                    AND c_parent.standard_concept = 'S'
                WHERE ct_root.parent_concept_id = ?
                  AND ct_root.domain_id = ?
                  AND c_child.domain_id != ?
                ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
            ", [$domain, $virtualRootId, $domain, $domain]);

            // Remove cross-domain concepts from virtual root if they now have
            // a real parent edge in this domain
            $conn->statement('
                DELETE FROM vocab.concept_tree
                WHERE parent_concept_id = ?
                  AND domain_id = ?
                  AND child_concept_id IN (
                    SELECT ct.child_concept_id
                    FROM vocab.concept_tree ct
                    JOIN vocab.concept c ON c.concept_id = ct.child_concept_id
                    WHERE ct.parent_concept_id = ?
                      AND ct.domain_id = ?
                      AND c.domain_id != ?
                      AND EXISTS (
                        SELECT 1 FROM vocab.concept_tree ct2
                        WHERE ct2.child_concept_id = ct.child_concept_id
                          AND ct2.domain_id = ?
                          AND ct2.parent_concept_id != ?
                      )
                  )
            ', [$virtualRootId, $domain, $virtualRootId, $domain, $domain, $domain, $virtualRootId]);

            // Add new virtual root entries for parents that were just inserted
            // but don't yet appear as children in this domain's tree
            $conn->statement("
                INSERT INTO vocab.concept_tree (parent_concept_id, child_concept_id, domain_id, child_depth, vocabulary_id, concept_class_id, child_name)
                SELECT DISTINCT
                    {$virtualRootId},
                    c.concept_id,
                    ?,
                    1,
                    c.vocabulary_id,
                    c.concept_class_id,
                    c.concept_name
                FROM vocab.concept c
                WHERE c.vocabulary_id = 'SNOMED'
                  AND c.standard_concept = 'S'
                  AND EXISTS (
                    SELECT 1 FROM vocab.concept_tree ct
                    WHERE ct.parent_concept_id = c.concept_id
                      AND ct.domain_id = ?
                  )
                  AND NOT EXISTS (
                    SELECT 1 FROM vocab.concept_tree ct2
                    WHERE ct2.child_concept_id = c.concept_id
                      AND ct2.domain_id = ?
                  )
                ON CONFLICT (parent_concept_id, child_concept_id, domain_id) DO NOTHING
            ", [$domain, $domain, $domain]);

            if ($inserted === 0) {
                break;
            }

            Log::debug("HierarchyBuilderService: propagation iteration {$i} for {$domain}", [
                'cross_domain_roots' => count($crossDomainRoots),
                'edges_inserted' => $inserted,
            ]);
        }
    }

    /**
     * Compute child_depth for all rows in a domain by iterating from known depths.
     * Orphan roots are at depth 1 (under virtual root at depth 0).
     * Non-root rows are initialized with child_depth = -1 (uncomputed).
     */
    private function computeDepths(Connection $conn, string $domain): void
    {
        // Orphan roots already have depth 1, non-root rows have depth -1
        $depth = 1;
        $maxIterations = 25; // Safety limit (max observed depth is 20)

        while ($depth < $maxIterations) {
            $updated = $conn->update('
                UPDATE vocab.concept_tree ct
                SET child_depth = ?
                FROM vocab.concept_tree parent_row
                WHERE parent_row.child_concept_id = ct.parent_concept_id
                  AND parent_row.domain_id = ?
                  AND parent_row.child_depth = ?
                  AND ct.domain_id = ?
                  AND ct.child_depth = -1
            ', [$depth + 1, $domain, $depth, $domain]);

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
        $quotedSchema = $this->quoteIdentifier($schema);
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

        // Delete existing data (using DELETE instead of TRUNCATE to avoid privilege issues)
        $conn->statement("DELETE FROM {$quotedSchema}.concept_hierarchy");

        // Build concept_hierarchy from concept_tree using recursive CTE.
        // Walk up the parent chain to collect ancestors at depth 2/3/4,
        // which map to level1/level2/level3 for the treemap.
        // DISTINCT ON handles multi-parent concepts (picks one path).
        $conn->statement("
            WITH RECURSIVE ancestry AS (
                -- Start from every internal edge (skip virtual/domain roots)
                SELECT
                    ct.child_concept_id AS leaf_id,
                    ct.child_name AS leaf_name,
                    ct.domain_id,
                    ct.vocabulary_id,
                    ct.parent_concept_id AS walk_to,
                    ct.child_concept_id AS anc_id,
                    ct.child_name AS anc_name,
                    ct.child_depth AS anc_depth,
                    0 AS hops
                FROM vocab.concept_tree ct
                WHERE ct.parent_concept_id > 0

                UNION ALL

                SELECT
                    a.leaf_id,
                    a.leaf_name,
                    a.domain_id,
                    a.vocabulary_id,
                    p.parent_concept_id,
                    p.child_concept_id,
                    p.child_name,
                    p.child_depth,
                    a.hops + 1
                FROM ancestry a
                JOIN vocab.concept_tree p
                    ON p.child_concept_id = a.walk_to
                    AND p.domain_id = a.domain_id
                WHERE a.walk_to > 0
                  AND a.hops < 20
            ),
            pivoted AS (
                SELECT DISTINCT ON (leaf_id)
                    leaf_id,
                    leaf_name,
                    domain_id,
                    vocabulary_id,
                    MAX(anc_id)   FILTER (WHERE anc_depth = 2) AS level1_concept_id,
                    MAX(anc_name) FILTER (WHERE anc_depth = 2) AS level1_concept_name,
                    MAX(anc_id)   FILTER (WHERE anc_depth = 3) AS level2_concept_id,
                    MAX(anc_name) FILTER (WHERE anc_depth = 3) AS level2_concept_name,
                    MAX(anc_id)   FILTER (WHERE anc_depth = 4) AS level3_concept_id,
                    MAX(anc_name) FILTER (WHERE anc_depth = 4) AS level3_concept_name
                FROM ancestry
                GROUP BY leaf_id, leaf_name, domain_id, vocabulary_id
            )
            INSERT INTO {$quotedSchema}.concept_hierarchy
                (concept_id, concept_name, treemap, concept_hierarchy_type,
                 level1_concept_id, level1_concept_name,
                 level2_concept_id, level2_concept_name,
                 level3_concept_id, level3_concept_name)
            SELECT
                leaf_id, leaf_name, domain_id, vocabulary_id,
                level1_concept_id, level1_concept_name,
                level2_concept_id, level2_concept_name,
                level3_concept_id, level3_concept_name
            FROM pivoted
        ");

        $count = $conn->selectOne("SELECT COUNT(*) as cnt FROM {$quotedSchema}.concept_hierarchy")->cnt;

        Log::info("HierarchyBuilderService: populated {$schema}.concept_hierarchy", ['rows' => $count]);

        return $count;
    }

    private function quoteIdentifier(string $identifier): string
    {
        if (! preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $identifier)) {
            throw new InvalidArgumentException("Invalid SQL identifier: {$identifier}");
        }

        return '"'.$identifier.'"';
    }
}
