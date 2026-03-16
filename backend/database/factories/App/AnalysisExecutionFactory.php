<?php

namespace Database\Factories\App;

use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\Characterization;
use App\Models\App\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AnalysisExecution> */
class AnalysisExecutionFactory extends Factory
{
    protected $model = AnalysisExecution::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'analysis_type' => Characterization::class,
            'analysis_id' => Characterization::factory(),
            'source_id' => null, // must be provided explicitly — never auto-create a fake source
            'status' => ExecutionStatus::Pending,
            'started_at' => null,
            'completed_at' => null,
            'result_json' => null,
            'fail_message' => null,
        ];
    }

    public function running(): static
    {
        return $this->state([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);
    }

    public function completed(): static
    {
        return $this->state([
            'status' => ExecutionStatus::Completed,
            'started_at' => now()->subMinutes(5),
            'completed_at' => now(),
        ]);
    }

    public function failed(): static
    {
        return $this->state([
            'status' => ExecutionStatus::Failed,
            'started_at' => now()->subMinutes(2),
            'completed_at' => now(),
            'fail_message' => fake()->sentence(),
        ]);
    }
}
