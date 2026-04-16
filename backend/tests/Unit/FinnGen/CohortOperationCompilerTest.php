<?php

declare(strict_types=1);

use App\Services\FinnGen\CohortOperationCompiler;

beforeEach(function () {
    $this->c = new CohortOperationCompiler;
});

function cohort(int $id, string $nodeId = ''): array
{
    return ['kind' => 'cohort', 'id' => $nodeId === '' ? "c{$id}" : $nodeId, 'cohort_id' => $id];
}

function op(string $op, array $children, string $id = ''): array
{
    static $seq = 0;
    $seq++;

    return ['kind' => 'op', 'id' => $id === '' ? "op{$seq}" : $id, 'op' => $op, 'children' => $children];
}

it('compiles a single cohort to its id', function () {
    expect($this->c->compile(cohort(42)))->toBe('42');
});

it('compiles a binary UNION', function () {
    expect($this->c->compile(op('UNION', [cohort(1), cohort(2)])))
        ->toBe('1 UNION 2');
});

it('compiles an n-ary UNION', function () {
    expect($this->c->compile(op('UNION', [cohort(1), cohort(2), cohort(3)])))
        ->toBe('1 UNION 2 UNION 3');
});

it('compiles nested ops with parens', function () {
    $tree = op('MINUS', [
        op('UNION', [cohort(1), cohort(2)], 'inner'),
        cohort(3),
    ], 'root');
    expect($this->c->compile($tree))->toBe('(1 UNION 2) MINUS 3');
});

it('compiles INTERSECT', function () {
    expect($this->c->compile(op('INTERSECT', [cohort(1), cohort(2)])))
        ->toBe('1 INTERSECT 2');
});

it('returns empty string for null tree', function () {
    expect($this->c->compile(null))->toBe('');
});

it('throws when compiling an op with <2 children', function () {
    $tree = op('UNION', [cohort(1)]);
    expect(fn () => $this->c->compile($tree))
        ->toThrow(InvalidArgumentException::class);
});

it('throws when compiling MINUS with > 2 children', function () {
    $tree = op('MINUS', [cohort(1), cohort(2), cohort(3)]);
    expect(fn () => $this->c->compile($tree))
        ->toThrow(InvalidArgumentException::class);
});

it('validate returns empty list for well-formed tree', function () {
    expect($this->c->validate(op('UNION', [cohort(1), cohort(2)])))->toBe([]);
});

it('validate flags op with <2 children', function () {
    $errs = $this->c->validate(op('UNION', [cohort(1)]));
    expect($errs)->toHaveCount(1)
        ->and($errs[0]['code'])->toBe('OP_NEEDS_AT_LEAST_TWO_CHILDREN');
});

it('validate flags MINUS with > 2 children', function () {
    $errs = $this->c->validate(op('MINUS', [cohort(1), cohort(2), cohort(3)]));
    $codes = array_column($errs, 'code');
    expect($codes)->toContain('MINUS_REQUIRES_EXACTLY_TWO_CHILDREN');
});

it('validate flags cohort with invalid id', function () {
    $node = ['kind' => 'cohort', 'id' => 'x', 'cohort_id' => 0];
    $errs = $this->c->validate($node);
    expect($errs[0]['code'])->toBe('COHORT_NODE_MISSING_ID');
});

it('validate flags duplicate node ids', function () {
    $tree = op('UNION', [
        ['kind' => 'cohort', 'id' => 'dup', 'cohort_id' => 1],
        ['kind' => 'cohort', 'id' => 'dup', 'cohort_id' => 2],
    ]);
    $codes = array_column($this->c->validate($tree), 'code');
    expect($codes)->toContain('DUPLICATE_NODE_ID');
});

it('validate flags unknown op', function () {
    $tree = ['kind' => 'op', 'id' => 'x', 'op' => 'XOR', 'children' => [cohort(1), cohort(2)]];
    $codes = array_column($this->c->validate($tree), 'code');
    expect($codes)->toContain('UNKNOWN_OP');
});

it('validate flags unknown node kind', function () {
    $tree = ['kind' => 'wat', 'id' => 'x'];
    $codes = array_column($this->c->validate($tree), 'code');
    expect($codes)->toContain('UNKNOWN_NODE_KIND');
});

it('listCohortIds returns flat deduplicated list', function () {
    $tree = op('MINUS', [
        op('UNION', [cohort(1), cohort(2)]),
        op('INTERSECT', [cohort(2), cohort(3)]),
    ]);
    expect($this->c->listCohortIds($tree))->toBe([1, 2, 3]);
});

it('matches the frontend operationTree contract round-trip', function () {
    // Same tree the TS lib would build for "(221 UNION 222) MINUS 223" — the
    // PANCREAS overlap example used in SP3 smoke. Sanity-check the parens.
    $tree = op('MINUS', [
        op('UNION', [cohort(221, 'left-1'), cohort(222, 'left-2')], 'left-op'),
        cohort(223, 'right-1'),
    ], 'root');
    expect($this->c->compile($tree))->toBe('(221 UNION 222) MINUS 223');
});
