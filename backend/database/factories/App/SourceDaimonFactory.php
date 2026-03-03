<?php

namespace Database\Factories\App;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SourceDaimon> */
class SourceDaimonFactory extends Factory
{
    protected $model = SourceDaimon::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'source_id' => Source::factory(),
            'daimon_type' => fake()->randomElement(DaimonType::cases()),
            'table_qualifier' => fake()->slug(1),
            'priority' => 1,
        ];
    }

    public function cdm(): static
    {
        return $this->state(['daimon_type' => DaimonType::CDM, 'table_qualifier' => 'cdm']);
    }

    public function vocabulary(): static
    {
        return $this->state(['daimon_type' => DaimonType::Vocabulary, 'table_qualifier' => 'vocab']);
    }

    public function results(): static
    {
        return $this->state(['daimon_type' => DaimonType::Results, 'table_qualifier' => 'results']);
    }
}
