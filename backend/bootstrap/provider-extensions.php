<?php

declare(strict_types=1);

use Illuminate\Support\ServiceProvider;

if (! function_exists('parthenon_bootstrap_env')) {
    function parthenon_bootstrap_env(string $key, string $default = ''): string
    {
        if (array_key_exists($key, $_ENV) && is_scalar($_ENV[$key])) {
            return (string) $_ENV[$key];
        }
        if (array_key_exists($key, $_SERVER) && is_scalar($_SERVER[$key])) {
            return (string) $_SERVER[$key];
        }

        $value = getenv($key);

        return $value === false ? $default : (string) $value;
    }
}

if (! function_exists('parthenon_bootstrap_list')) {
    /**
     * @return list<string>
     */
    function parthenon_bootstrap_list(string $value): array
    {
        if (trim($value) === '') {
            return [];
        }

        $items = preg_split('/[,;\r\n]+/', $value) ?: [];
        $normalized = [];
        foreach ($items as $item) {
            $item = trim($item);
            if ($item === '') {
                continue;
            }
            $normalized[$item] = $item;
        }

        return array_values($normalized);
    }
}

if (! function_exists('parthenon_bootstrap_path')) {
    function parthenon_bootstrap_path(string $path, string $basePath): string
    {
        if ($path === '') {
            throw new InvalidArgumentException('Bootstrap file path cannot be empty.');
        }
        if (str_starts_with($path, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1) {
            return $path;
        }

        return rtrim($basePath, '/').'/'.$path;
    }
}

if (! function_exists('parthenon_load_extra_bootstrap_files')) {
    function parthenon_load_extra_bootstrap_files(string $basePath): void
    {
        foreach (parthenon_bootstrap_list(parthenon_bootstrap_env('PARTHENON_EXTRA_BOOTSTRAP_FILES')) as $path) {
            $resolved = parthenon_bootstrap_path($path, $basePath);
            if (! is_file($resolved) || ! is_readable($resolved)) {
                throw new RuntimeException("Parthenon extra bootstrap file is not readable: {$resolved}");
            }

            require_once $resolved;
        }
    }
}

if (! function_exists('parthenon_extra_provider_classes')) {
    /**
     * @return list<class-string<ServiceProvider>>
     */
    function parthenon_extra_provider_classes(): array
    {
        $providers = [];
        foreach (parthenon_bootstrap_list(parthenon_bootstrap_env('PARTHENON_EXTRA_PROVIDERS')) as $class) {
            if (preg_match('/^(?:[A-Za-z_][A-Za-z0-9_]*\\\\)*[A-Za-z_][A-Za-z0-9_]*$/', $class) !== 1) {
                throw new InvalidArgumentException("Invalid Parthenon extra provider class name: {$class}");
            }
            if (! class_exists($class)) {
                throw new RuntimeException("Parthenon extra provider class is not autoloadable: {$class}");
            }
            if (! is_subclass_of($class, ServiceProvider::class)) {
                throw new RuntimeException('Parthenon extra provider must extend '.ServiceProvider::class.": {$class}");
            }

            $providers[] = $class;
        }

        return $providers;
    }
}
