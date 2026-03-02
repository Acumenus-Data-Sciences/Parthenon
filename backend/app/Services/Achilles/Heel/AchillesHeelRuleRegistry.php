<?php

namespace App\Services\Achilles\Heel;

use App\Contracts\AchillesHeelRuleInterface;

class AchillesHeelRuleRegistry
{
    /** @var array<int, AchillesHeelRuleInterface> */
    private array $rules = [];

    public function register(AchillesHeelRuleInterface $rule): void
    {
        $this->rules[$rule->ruleId()] = $rule;
    }

    public function get(int $ruleId): ?AchillesHeelRuleInterface
    {
        return $this->rules[$ruleId] ?? null;
    }

    /** @return array<int, AchillesHeelRuleInterface> */
    public function all(): array
    {
        return $this->rules;
    }

    /** @return array<int, AchillesHeelRuleInterface> */
    public function bySeverity(string $severity): array
    {
        return array_filter(
            $this->rules,
            fn (AchillesHeelRuleInterface $r) => $r->severity() === $severity,
        );
    }

    public function count(): int
    {
        return count($this->rules);
    }
}
