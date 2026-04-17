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
    expect(FinnGenPatternExpander::expand('I21|I21|I22'))->toBe(['I21', 'I22']);
});

it('strips whitespace around pipe-separated tokens', function () {
    expect(FinnGenPatternExpander::expand('  I21  | I22 '))->toBe(['I21', 'I22']);
});

// ── Bracket-class expansion (recovery for ICD9_FIN unmapped patterns) ──────

it('expands single-digit-in-brackets as a literal (FinnGen idiom)', function () {
    expect(FinnGenPatternExpander::expand('00[1]'))->toBe(['001']);
});

it('expands multi-digit char class', function () {
    expect(FinnGenPatternExpander::expand('I80[12]'))->toBe(['I801', 'I802']);
});

it('expands alpha char class', function () {
    expect(FinnGenPatternExpander::expand('7490[ABCE]'))->toBe(['7490A', '7490B', '7490C', '7490E']);
});

it('expands alpha range', function () {
    expect(FinnGenPatternExpander::expand('A4[A-C]'))->toBe(['A4A', 'A4B', 'A4C']);
});

it('expands ATC-style alpha class on letter-prefixed code', function () {
    expect(FinnGenPatternExpander::expand('L02B[AG]'))->toBe(['L02BA', 'L02BG']);
});

// ── Junk filtering (XLSX cell artifacts must not reach unmapped sidecar) ───

it('drops unclosed brackets (XLSX parsing artifact)', function () {
    expect(FinnGenPatternExpander::expand('D06[7'))->toBe([]);
    expect(FinnGenPatternExpander::expand('F84[0'))->toBe([]);
});

it('strips leading regex anchor caret', function () {
    expect(FinnGenPatternExpander::expand('^FN1[ABSY]'))->toBe(['FN1A', 'FN1B', 'FN1S', 'FN1Y']);
});

it('drops single-char tokens (V, E alone are noise)', function () {
    expect(FinnGenPatternExpander::expand('V'))->toBe([]);
    expect(FinnGenPatternExpander::expand('E'))->toBe([]);
});

it('drops tokens with non-alphanumeric chars', function () {
    expect(FinnGenPatternExpander::expand('$!$'))->toBe([]);
});

it('drops bracket forms with illegal chars (defense against regex smuggling)', function () {
    // Brackets with chars outside [A-Za-z0-9] don't match any known class form
    expect(FinnGenPatternExpander::expand('A[$.]'))->toBe([]);
});

it('keeps mixed valid + invalid tokens, dropping only the invalid ones', function () {
    expect(FinnGenPatternExpander::expand('I21|D06[7|F33'))->toBe(['I21', 'F33']);
});
