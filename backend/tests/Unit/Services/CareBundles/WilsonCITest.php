<?php

declare(strict_types=1);

use App\Services\CareBundles\WilsonCI;

it('returns null when denominator is zero', function () {
    expect(WilsonCI::compute(0, 0))->toBeNull();
});

it('computes a bounded interval for a normal proportion', function () {
    $ci = WilsonCI::compute(50, 100);

    expect($ci)->not->toBeNull()
        ->and($ci['lower'])->toBeGreaterThan(0.0)
        ->and($ci['lower'])->toBeLessThan(0.5)
        ->and($ci['upper'])->toBeGreaterThan(0.5)
        ->and($ci['upper'])->toBeLessThan(1.0);
});

it('does not emit NaN when numerator exceeds denominator', function () {
    $ci = WilsonCI::compute(12, 10);

    expect($ci)->not->toBeNull()
        ->and(is_nan($ci['lower']))->toBeFalse()
        ->and(is_nan($ci['upper']))->toBeFalse()
        ->and($ci['lower'])->toBeGreaterThanOrEqual(0.0)
        ->and($ci['upper'])->toBeLessThanOrEqual(1.0);
});

it('returns null for negative numerator input', function () {
    expect(WilsonCI::compute(-1, 10))->toBeNull();
});
