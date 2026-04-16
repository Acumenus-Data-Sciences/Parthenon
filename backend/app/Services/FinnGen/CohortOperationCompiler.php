<?php

declare(strict_types=1);

namespace App\Services\FinnGen;

use InvalidArgumentException;

/**
 * SP4 Phase B — Cohort operation tree compiler.
 *
 * Mirrors frontend/src/features/finngen-workbench/lib/operationTree.ts. Both
 * sides accept the same JSON shape; backend re-validates and re-compiles
 * defensively before any materialization or count preview hits the database.
 *
 * Tree shape:
 *   leaf:     { kind: "cohort", id: string, cohort_id: int }
 *   internal: { kind: "op", id: string, op: "UNION"|"INTERSECT"|"MINUS", children: array }
 *
 * Invariants:
 *   - Op nodes need ≥2 children
 *   - MINUS nodes need exactly 2 children
 *   - Cohort nodes need positive integer cohort_id
 *   - All node ids unique
 */
class CohortOperationCompiler
{
    public const OPS = ['UNION', 'INTERSECT', 'MINUS'];

    /**
     * Validate the tree. Returns a flat list of error descriptors; an empty
     * list means the tree is well-formed and safe to compile.
     *
     * @param  array<mixed>|null  $tree
     * @return list<array{node_id: string, code: string, message: string}>
     */
    public function validate(?array $tree): array
    {
        if ($tree === null || $tree === []) {
            return [];
        }
        $errors = [];
        $seen = [];
        $this->walk($tree, $errors, $seen);

        return $errors;
    }

    /**
     * Compile the tree to the upstream HadesExtras operation string.
     *
     *   {kind:cohort, cohort_id:42}                       => "42"
     *   {kind:op, op:UNION, children:[A,B]}               => "A UNION B"
     *   {kind:op, op:MINUS, children:[union(1,2), 3]}     => "(1 UNION 2) MINUS 3"
     *
     * Throws InvalidArgumentException when validate() would have rejected the
     * tree — callers should validate() first if they want structured errors.
     *
     * @param  array<mixed>|null  $tree
     */
    public function compile(?array $tree): string
    {
        if ($tree === null || $tree === []) {
            return '';
        }
        $errors = $this->validate($tree);
        if (! empty($errors)) {
            $codes = implode(', ', array_map(fn ($e) => $e['code'], $errors));
            throw new InvalidArgumentException("Cannot compile invalid tree: {$codes}");
        }
        $rendered = $this->render($tree);
        // Strip outermost parens when the root itself is an op for readability.
        if (
            ($tree['kind'] ?? null) === 'op'
            && str_starts_with($rendered, '(')
            && str_ends_with($rendered, ')')
        ) {
            return substr($rendered, 1, -1);
        }

        return $rendered;
    }

    /**
     * Compile the tree to a SELECT-subject_id SQL fragment over a source's
     * cohort table. Used by the preview-counts endpoint to compute
     *   `SELECT COUNT(DISTINCT subject_id) FROM (<sql>) result`
     * without round-tripping through HadesExtras' operationStringToSQL.
     *
     * Cohort IDs are validated as positive integers by validate() so inlining
     * is safe; the schema name is whitelisted to [a-z][a-z0-9_]* to prevent
     * any caller from injecting SQL through the source envelope.
     *
     * @param  array<mixed>|null  $tree
     */
    public function compileSql(?array $tree, string $cohortSchema): string
    {
        if ($tree === null || $tree === []) {
            return '';
        }
        if (preg_match('/^[a-z][a-z0-9_]*$/', $cohortSchema) !== 1) {
            throw new InvalidArgumentException("Invalid cohort schema name: {$cohortSchema}");
        }
        $errors = $this->validate($tree);
        if (! empty($errors)) {
            $codes = implode(', ', array_map(fn ($e) => $e['code'], $errors));
            throw new InvalidArgumentException("Cannot compile invalid tree: {$codes}");
        }

        return $this->renderSql($tree, $cohortSchema);
    }

    /**
     * Flatten every cohort_id referenced by the tree (deduplicated, ordered
     * by first appearance). Useful for "what cohorts does this tree touch"
     * queries during preview / materialization.
     *
     * @param  array<mixed>|null  $tree
     * @return list<int>
     */
    public function listCohortIds(?array $tree): array
    {
        if ($tree === null || $tree === []) {
            return [];
        }
        $out = [];
        $this->collectCohortIds($tree, $out);

        return array_values(array_unique($out));
    }

    /**
     * @param  array<mixed>  $node
     * @param  list<array{node_id: string, code: string, message: string}>  $errors
     * @param  array<string, true>  $seen
     */
    private function walk(array $node, array &$errors, array &$seen): void
    {
        $id = is_string($node['id'] ?? null) ? $node['id'] : '';
        if ($id === '') {
            // No id is itself a problem for downstream UI keys; flag once.
            $errors[] = [
                'node_id' => '',
                'code' => 'NODE_MISSING_ID',
                'message' => 'Node missing string id',
            ];
        } else {
            if (isset($seen[$id])) {
                $errors[] = [
                    'node_id' => $id,
                    'code' => 'DUPLICATE_NODE_ID',
                    'message' => "Node id {$id} appears more than once",
                ];
            }
            $seen[$id] = true;
        }

        $kind = $node['kind'] ?? null;
        if ($kind === 'cohort') {
            $cid = $node['cohort_id'] ?? null;
            if (! is_int($cid) || $cid <= 0) {
                $errors[] = [
                    'node_id' => $id,
                    'code' => 'COHORT_NODE_MISSING_ID',
                    'message' => 'Cohort node missing or invalid cohort_id',
                ];
            }

            return;
        }
        if ($kind !== 'op') {
            $errors[] = [
                'node_id' => $id,
                'code' => 'UNKNOWN_NODE_KIND',
                'message' => 'Node kind must be "cohort" or "op"',
            ];

            return;
        }

        $op = $node['op'] ?? null;
        if (! in_array($op, self::OPS, true)) {
            $errors[] = [
                'node_id' => $id,
                'code' => 'UNKNOWN_OP',
                'message' => 'Op must be one of UNION/INTERSECT/MINUS',
            ];
        }

        $children = is_array($node['children'] ?? null) ? $node['children'] : [];
        if (count($children) < 2) {
            $errors[] = [
                'node_id' => $id,
                'code' => 'OP_NEEDS_AT_LEAST_TWO_CHILDREN',
                'message' => sprintf(
                    '%s requires at least 2 children, has %d',
                    is_string($op) ? $op : 'OP',
                    count($children),
                ),
            ];
        }
        if ($op === 'MINUS' && count($children) !== 2) {
            $errors[] = [
                'node_id' => $id,
                'code' => 'MINUS_REQUIRES_EXACTLY_TWO_CHILDREN',
                'message' => 'MINUS requires exactly 2 children',
            ];
        }

        foreach ($children as $child) {
            if (is_array($child)) {
                $this->walk($child, $errors, $seen);
            }
        }
    }

    /**
     * @param  array<mixed>  $node
     */
    private function renderSql(array $node, string $schema): string
    {
        if (($node['kind'] ?? null) === 'cohort') {
            $cid = (int) $node['cohort_id'];

            return "SELECT subject_id FROM {$schema}.cohort WHERE cohort_definition_id = {$cid}";
        }
        $sqlOp = match ($node['op']) {
            'UNION' => 'UNION',
            'INTERSECT' => 'INTERSECT',
            'MINUS' => 'EXCEPT',
            default => throw new InvalidArgumentException('Unknown op'),
        };
        $children = is_array($node['children'] ?? null) ? $node['children'] : [];
        $parts = [];
        foreach ($children as $child) {
            if (is_array($child)) {
                $parts[] = '('.$this->renderSql($child, $schema).')';
            }
        }

        return implode(" {$sqlOp} ", $parts);
    }

    /**
     * @param  array<mixed>  $node
     */
    private function render(array $node): string
    {
        if (($node['kind'] ?? null) === 'cohort') {
            return (string) $node['cohort_id'];
        }
        $op = (string) $node['op'];
        $children = is_array($node['children'] ?? null) ? $node['children'] : [];
        $parts = [];
        foreach ($children as $child) {
            if (is_array($child)) {
                $parts[] = $this->render($child);
            }
        }

        return '('.implode(" {$op} ", $parts).')';
    }

    /**
     * @param  array<mixed>  $node
     * @param  list<int>  $out
     */
    private function collectCohortIds(array $node, array &$out): void
    {
        if (($node['kind'] ?? null) === 'cohort') {
            $cid = $node['cohort_id'] ?? null;
            if (is_int($cid)) {
                $out[] = $cid;
            }

            return;
        }
        $children = is_array($node['children'] ?? null) ? $node['children'] : [];
        foreach ($children as $child) {
            if (is_array($child)) {
                $this->collectCohortIds($child, $out);
            }
        }
    }
}
