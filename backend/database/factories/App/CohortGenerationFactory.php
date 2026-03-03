<?php

namespace Database\Factories\App;

use App\Enums\ExecutionStatus;
use App\Models\App\CohortDefinition;
use App\Models\App\CohortGeneration;
use App\Models\App\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<CohortGeneration> */
class CohortGenerationFactory extends Factory
{
    protected $model = CohortGeneration::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'cohort_definition_id' => CohortDefinition::factory(),
            'source_id' => Source::factory(),
            'status' => ExecutionStatus::Pending,
            'started_at' => null,
            'completed_at' => null,
            'person_count' => null,
            'fail_message' => null,
        ];
    }

    public function completed(int $personCount = 1000): static
    {
        return $this->state([
            'status' => ExecutionStatus::Completed,
            'started_at' => now()->subMinutes(3),
            'completed_at' => now(),
            'person_count' => $personCount,
        ]);
    }
}
