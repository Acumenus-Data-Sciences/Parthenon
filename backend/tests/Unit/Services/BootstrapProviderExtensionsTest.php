<?php

declare(strict_types=1);

use Tests\Fixtures\ExtraProviderStub;
use Tests\Fixtures\NotAServiceProviderStub;

require_once dirname(__DIR__, 3).'/bootstrap/provider-extensions.php';

beforeEach(function (): void {
    clearParthenonExtraProviderEnv();
});

afterEach(function (): void {
    clearParthenonExtraProviderEnv();
});

function clearParthenonExtraProviderEnv(): void
{
    foreach (['PARTHENON_EXTRA_BOOTSTRAP_FILES', 'PARTHENON_EXTRA_PROVIDERS'] as $key) {
        unset($_ENV[$key], $_SERVER[$key]);
        putenv($key);
    }
}

it('returns no extra providers when no environment is configured', function (): void {
    expect(parthenon_extra_provider_classes())->toBe([]);
});

it('parses and de-duplicates configured provider classes', function (): void {
    $_ENV['PARTHENON_EXTRA_PROVIDERS'] = implode(',', [
        ExtraProviderStub::class,
        ExtraProviderStub::class,
    ]);

    expect(parthenon_extra_provider_classes())->toBe([ExtraProviderStub::class]);
});

it('loads extra bootstrap files before resolving providers', function (): void {
    $file = tempnam(sys_get_temp_dir(), 'parthenon-extra-bootstrap-');
    file_put_contents($file, '<?php $GLOBALS["parthenon_extra_bootstrap_loaded"] = true;');

    $_ENV['PARTHENON_EXTRA_BOOTSTRAP_FILES'] = $file;
    $GLOBALS['parthenon_extra_bootstrap_loaded'] = false;

    parthenon_load_extra_bootstrap_files(dirname(__DIR__, 3));

    expect($GLOBALS['parthenon_extra_bootstrap_loaded'])->toBeTrue();

    unlink($file);
});

it('fails clearly for unreadable extra bootstrap files', function (): void {
    $_ENV['PARTHENON_EXTRA_BOOTSTRAP_FILES'] = '/tmp/parthenon-missing-bootstrap.php';

    parthenon_load_extra_bootstrap_files(dirname(__DIR__, 3));
})->throws(RuntimeException::class, 'Parthenon extra bootstrap file is not readable');

it('fails clearly for malformed provider class names', function (): void {
    $_ENV['PARTHENON_EXTRA_PROVIDERS'] = 'not a class';

    parthenon_extra_provider_classes();
})->throws(InvalidArgumentException::class, 'Invalid Parthenon extra provider class name');

it('fails clearly when a provider class cannot be autoloaded', function (): void {
    $_ENV['PARTHENON_EXTRA_PROVIDERS'] = 'Acumenus\\Missing\\Provider';

    parthenon_extra_provider_classes();
})->throws(RuntimeException::class, 'Parthenon extra provider class is not autoloadable');

it('requires configured providers to extend Laravel ServiceProvider', function (): void {
    $_ENV['PARTHENON_EXTRA_PROVIDERS'] = NotAServiceProviderStub::class;

    parthenon_extra_provider_classes();
})->throws(RuntimeException::class, 'Parthenon extra provider must extend');
