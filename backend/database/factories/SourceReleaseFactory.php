<?php

namespace Database\Factories;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SourceRelease>
 */
class SourceReleaseFactory extends Factory
{
    protected $model = SourceRelease::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'release_key' => fake()->unique()->slug(3),
            'release_name' => fake()->words(3, true),
            'release_type' => fake()->randomElement(['scheduled_etl', 'snapshot']),
            'cdm_version' => '5.4',
            'vocabulary_version' => 'v5.0',
            'person_count' => fake()->numberBetween(1000, 100000),
            'record_count' => fake()->numberBetween(10000, 1000000),
        ];
    }
}
