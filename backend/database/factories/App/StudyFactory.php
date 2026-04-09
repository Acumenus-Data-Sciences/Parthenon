<?php

namespace Database\Factories\App;

use App\Models\App\Study;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Study> */
class StudyFactory extends Factory
{
    protected $model = Study::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        // Columns were renamed in 2026_03_04_200000_expand_studies_table:
        //   name       → title
        //   author_id  → created_by
        return [
            'title' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'study_type' => fake()->randomElement(['characterization', 'estimation', 'prediction']),
            'created_by' => User::factory(),
            'status' => 'draft',
            'metadata' => [],
        ];
    }
}
