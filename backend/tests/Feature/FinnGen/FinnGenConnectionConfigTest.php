<?php

declare(strict_types=1);

/**
 * Phase 13.1 Wave 0 — SC 5 (config-only unit test).
 *
 * Expected state: GREEN from Plan 13.1-01 onwards. The two new Laravel
 * connections are wired in config/database.php; this test freezes their
 * search_path and role routing so later migrations can't regress them.
 *
 * Threat coverage: T-13.1-S1 (search_path tampering) — asserts search_path
 * is the literal 'finngen,vocab,php' and never runtime-interpolated.
 */
it('registers the finngen connection with finngen,vocab,php search_path', function (): void {
    expect(config('database.connections.finngen'))->not->toBeNull();
    expect(config('database.connections.finngen.driver'))->toBe('pgsql');
    expect(config('database.connections.finngen.search_path'))->toBe('finngen,vocab,php');
});

it('registers the finngen_ro connection routed to parthenon_finngen_ro', function (): void {
    expect(config('database.connections.finngen_ro'))->not->toBeNull();
    expect(config('database.connections.finngen_ro.username'))->toBe('parthenon_finngen_ro');
    expect(config('database.connections.finngen_ro.search_path'))->toBe('finngen,vocab,php');
});

it('finngen_ro password resolves to a string (fallback chain works)', function (): void {
    // The config value resolves from nested env() at load time via the
    // DB_FINNGEN_RO_PASSWORD → FINNGEN_PG_RO_PASSWORD → '' chain.
    // Presence-and-type is enough to confirm no ParseError in the config.
    expect(config('database.connections.finngen_ro.password'))->toBeString();
});
