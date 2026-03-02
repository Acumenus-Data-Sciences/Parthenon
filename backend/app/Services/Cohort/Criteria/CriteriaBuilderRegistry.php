<?php

namespace App\Services\Cohort\Criteria;

use InvalidArgumentException;

class CriteriaBuilderRegistry
{
    /**
     * @var array<string, CriteriaBuilderInterface>
     */
    private readonly array $builders;

    public function __construct()
    {
        $builderInstances = [
            new ConditionCriteriaBuilder,
            new DrugCriteriaBuilder,
            new ProcedureCriteriaBuilder,
            new MeasurementCriteriaBuilder,
            new ObservationCriteriaBuilder,
            new VisitCriteriaBuilder,
            new DeathCriteriaBuilder,
        ];

        $indexed = [];
        foreach ($builderInstances as $builder) {
            $indexed[$builder->domainKey()] = $builder;
        }

        $this->builders = $indexed;
    }

    /**
     * Get a criteria builder by its domain key.
     *
     * @throws InvalidArgumentException
     */
    public function get(string $domainKey): CriteriaBuilderInterface
    {
        if (! isset($this->builders[$domainKey])) {
            $available = implode(', ', array_keys($this->builders));
            throw new InvalidArgumentException("Unknown domain key '{$domainKey}'. Available: {$available}");
        }

        return $this->builders[$domainKey];
    }

    /**
     * Check if a domain key is registered.
     */
    public function has(string $domainKey): bool
    {
        return isset($this->builders[$domainKey]);
    }

    /**
     * Get all registered domain keys.
     *
     * @return list<string>
     */
    public function domainKeys(): array
    {
        return array_keys($this->builders);
    }
}
