<?php

use App\Support\Statistics\Multiplicity;

it('computes Benjamini-Hochberg adjusted p-values', function () {
    // p = [0.01, 0.04, 0.03, 0.005], m = 4
    // sorted: 0.005(r1), 0.01(r2), 0.03(r3), 0.04(r4)
    // r4: 0.04*4/4=0.04 ; r3: 0.03*4/3=0.04 ; r2: 0.01*4/2=0.02 ; r1: 0.005*4/1=0.02
    $adj = Multiplicity::benjaminiHochberg([0.01, 0.04, 0.03, 0.005]);

    expect(round($adj[0], 4))->toBe(0.02)
        ->and(round($adj[1], 4))->toBe(0.04)
        ->and(round($adj[2], 4))->toBe(0.04)
        ->and(round($adj[3], 4))->toBe(0.02);
});

it('preserves order and null entries, excluding nulls from the denominator', function () {
    // m = 2 valid. sorted: 0.01(r1), 0.04(r2). r2: 0.04 ; r1: 0.01*2/1=0.02
    $adj = Multiplicity::benjaminiHochberg([0.01, null, 0.04]);

    expect($adj[1])->toBeNull()
        ->and(round($adj[0], 4))->toBe(0.02)
        ->and(round($adj[2], 4))->toBe(0.04);
});

it('returns all nulls when there are no valid p-values', function () {
    expect(Multiplicity::benjaminiHochberg([null, null]))->toBe([null, null]);
});

it('never returns an adjusted p below the raw p and caps at 1', function () {
    $raw = [0.001, 0.5, 0.9, 0.02];
    $adj = Multiplicity::benjaminiHochberg($raw);

    foreach ($raw as $i => $p) {
        expect($adj[$i])->toBeGreaterThanOrEqual($p)
            ->and($adj[$i])->toBeLessThanOrEqual(1.0);
    }
});
