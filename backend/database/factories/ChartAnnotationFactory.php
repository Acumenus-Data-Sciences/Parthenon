<?php

namespace Database\Factories;

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ChartAnnotation>
 */
class ChartAnnotationFactory extends Factory
{
    protected $model = ChartAnnotation::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'chart_type' => fake()->randomElement(['demographics', 'observation_period', 'condition_occurrence']),
            'chart_context' => ['domain' => 'condition', 'concept_id' => 201826],
            'x_value' => (string) fake()->numberBetween(2000, 2025),
            'y_value' => fake()->randomFloat(2, 0, 100),
            'annotation_text' => fake()->sentence(),
            'created_by' => User::factory(),
        ];
    }
}
