<?php

namespace Database\Factories\App;

use App\Models\App\IncidenceRateAnalysis;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<IncidenceRateAnalysis> */
class IncidenceRateAnalysisFactory extends Factory
{
    protected $model = IncidenceRateAnalysis::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'design_json' => [
                'targetCohortId' => null,
                'outcomeCohortId' => null,
                'timeAtRisk' => ['start' => 0, 'end' => 365],
            ],
            'author_id' => User::factory(),
        ];
    }
}
