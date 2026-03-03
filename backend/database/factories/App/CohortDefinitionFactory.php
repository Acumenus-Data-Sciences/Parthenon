<?php

namespace Database\Factories\App;

use App\Models\App\CohortDefinition;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CohortDefinition> */
class CohortDefinitionFactory extends Factory
{
    protected $model = CohortDefinition::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'expression_json' => [
                'conceptSets' => [],
                'PrimaryCriteria' => [
                    'CriteriaList' => [
                        ['ConditionOccurrence' => ['CodesetId' => 0]],
                    ],
                    'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                ],
                'QualifiedLimit' => ['Type' => 'First'],
            ],
            'author_id' => User::factory(),
            'is_public' => false,
            'version' => 1,
        ];
    }

    public function public(): static
    {
        return $this->state(['is_public' => true]);
    }
}
