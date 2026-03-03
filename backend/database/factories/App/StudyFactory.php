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
        return [
            'name' => fake()->sentence(4),
            'description' => fake()->paragraph(),
            'study_type' => fake()->randomElement(['characterization', 'estimation', 'prediction']),
            'author_id' => User::factory(),
            'status' => 'draft',
            'metadata' => [],
        ];
    }
}
