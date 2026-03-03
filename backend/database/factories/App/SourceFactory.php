<?php

namespace Database\Factories\App;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Source> */
class SourceFactory extends Factory
{
    protected $model = Source::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'source_name' => fake()->company().' CDM',
            'source_key' => fake()->unique()->slug(2),
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost:5432/'.fake()->slug(1),
            'is_cache_enabled' => false,
        ];
    }
}
