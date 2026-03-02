<?php

namespace App\Services\Dqd;

use App\Contracts\DqdCheckInterface;

class DqdCheckRegistry
{
    /** @var array<string, DqdCheckInterface> */
    private array $checks = [];

    /**
     * Register a check in the registry.
     */
    public function register(DqdCheckInterface $check): void
    {
        $this->checks[$check->checkId()] = $check;
    }

    /**
     * Get a check by its ID.
     */
    public function get(string $checkId): ?DqdCheckInterface
    {
        return $this->checks[$checkId] ?? null;
    }

    /**
     * Get all registered checks.
     *
     * @return array<string, DqdCheckInterface>
     */
    public function all(): array
    {
        return $this->checks;
    }

    /**
     * Get checks filtered by category.
     *
     * @return array<string, DqdCheckInterface>
     */
    public function byCategory(string $category): array
    {
        return array_filter(
            $this->checks,
            fn (DqdCheckInterface $check) => $check->category() === $category,
        );
    }

    /**
     * Get checks filtered by CDM table.
     *
     * @return array<string, DqdCheckInterface>
     */
    public function byTable(string $cdmTable): array
    {
        return array_filter(
            $this->checks,
            fn (DqdCheckInterface $check) => $check->cdmTable() === $cdmTable,
        );
    }

    /**
     * Get checks filtered by both category and CDM table.
     *
     * @return array<string, DqdCheckInterface>
     */
    public function byCategoryAndTable(string $category, string $cdmTable): array
    {
        return array_filter(
            $this->checks,
            fn (DqdCheckInterface $check) => $check->category() === $category && $check->cdmTable() === $cdmTable,
        );
    }

    /**
     * Get the total number of registered checks.
     */
    public function count(): int
    {
        return count($this->checks);
    }

    /**
     * Get all distinct categories from registered checks.
     *
     * @return array<int, string>
     */
    public function categories(): array
    {
        $categories = [];
        foreach ($this->checks as $check) {
            $categories[$check->category()] = true;
        }

        return array_keys($categories);
    }

    /**
     * Get all distinct CDM tables from registered checks.
     *
     * @return array<int, string>
     */
    public function tables(): array
    {
        $tables = [];
        foreach ($this->checks as $check) {
            $tables[$check->cdmTable()] = true;
        }

        return array_keys($tables);
    }
}
