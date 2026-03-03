<?php

namespace Database\Factories\App;

use App\Models\App\ConceptSet;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ConceptSet> */
class ConceptSetFactory extends Factory
{
    protected $model = ConceptSet::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'expression_json' => [],
            'author_id' => User::factory(),
            'is_public' => false,
            'tags' => [],
        ];
    }
}
