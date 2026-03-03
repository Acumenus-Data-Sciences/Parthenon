<?php

namespace Database\Factories\App;

use App\Models\App\Characterization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Characterization> */
class CharacterizationFactory extends Factory
{
    protected $model = Characterization::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'design_json' => [
                'targetCohortIds' => [],
                'featureTypes' => ['demographics', 'conditions', 'drugs'],
            ],
            'author_id' => User::factory(),
        ];
    }
}
