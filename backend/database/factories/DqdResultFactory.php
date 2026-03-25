<?php

namespace Database\Factories;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DqdResult>
 */
class DqdResultFactory extends Factory
{
    protected $model = DqdResult::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'run_id' => fake()->uuid(),
            'check_id' => 'check_'.fake()->unique()->numerify('###'),
            'category' => fake()->randomElement(['Completeness', 'Conformance', 'Plausibility']),
            'subcategory' => fake()->randomElement(['Verification', 'Validation', 'Temporal']),
            'cdm_table' => fake()->randomElement(['person', 'condition_occurrence', 'drug_exposure', 'measurement']),
            'cdm_column' => fake()->word(),
            'severity' => fake()->randomElement(['high', 'medium', 'low']),
            'threshold' => 0.0,
            'passed' => fake()->boolean(),
            'violated_rows' => fake()->numberBetween(0, 1000),
            'total_rows' => fake()->numberBetween(1000, 100000),
            'violation_percentage' => fake()->randomFloat(2, 0, 100),
            'description' => fake()->sentence(),
            'release_id' => SourceRelease::factory(),
        ];
    }
}
