<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenPatternExpander;

it('expands pipe-alternated codes into individual tokens', function () {
    expect(FinnGenPatternExpander::expand('I21|I22'))->toBe(['I21', 'I22']);
});

it('expands single-digit char class into a range', function () {
    expect(FinnGenPatternExpander::expand('F3[2-3]'))->toBe(['F32', 'F33']);
});

it('expands mixed alternation and char class together', function () {
    expect(FinnGenPatternExpander::expand('I21|F3[2-3]'))->toBe(['I21', 'F32', 'F33']);
});

it('returns empty list for null input', function () {
    expect(FinnGenPatternExpander::expand(null))->toBe([]);
});

it('returns empty list for empty or whitespace input', function () {
    expect(FinnGenPatternExpander::expand(''))->toBe([]);
    expect(FinnGenPatternExpander::expand('   '))->toBe([]);
});

it('preserves trailing letters (ICD-9 suffix stripping is resolver concern, not expander)', function () {
    expect(FinnGenPatternExpander::expand('4019X|4029A'))->toBe(['4019X', '4029A']);
});

it('handles leading-digit char class 7[6-7]', function () {
    expect(FinnGenPatternExpander::expand('7[6-7]'))->toBe(['76', '77']);
});

it('deduplicates identical tokens in the output', function () {
    expect(FinnGenPatternExpander::expand('A|A|B'))->toBe(['A', 'B']);
});

it('strips whitespace around pipe-separated tokens', function () {
    expect(FinnGenPatternExpander::expand('  I21  | I22 '))->toBe(['I21', 'I22']);
});
