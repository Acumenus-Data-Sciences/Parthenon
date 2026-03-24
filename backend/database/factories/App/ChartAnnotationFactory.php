<?php

namespace Database\Factories\App;

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

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'chart_type' => fake()->randomElement(['gender', 'age_at_first', 'conditions_by_type', 'visit_duration']),
            'chart_context' => ['analysis_id' => fake()->numberBetween(1, 3000)],
            'x_value' => (string) fake()->numberBetween(0, 100),
            'y_value' => fake()->randomFloat(2, 0, 100),
            'annotation_text' => fake()->sentence(),
            'created_by' => User::factory(),
        ];
    }
}
