<?php

declare(strict_types=1);

namespace Database\Factories\App;

use App\Models\App\PathwayAnalysis;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<PathwayAnalysis> */
class PathwayAnalysisFactory extends Factory
{
    protected $model = PathwayAnalysis::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'design_json' => [
                'targetCohortId' => fake()->numberBetween(1, 100),
                'eventCohortIds' => [fake()->numberBetween(1, 50), fake()->numberBetween(51, 100)],
                'maxDepth' => 5,
                'minCellCount' => 5,
                'combinationWindow' => 0,
                'maxPathLength' => 5,
            ],
            'author_id' => User::factory(),
        ];
    }
}
