<?php

declare(strict_types=1);

namespace Database\Factories\App\FinnGen;

use App\Enums\CoverageBucket;
use App\Enums\CoverageProfile;
use App\Models\App\FinnGen\EndpointDefinition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EndpointDefinition>
 */
class EndpointDefinitionFactory extends Factory
{
    /**
     * @var class-string<EndpointDefinition>
     */
    protected $model = EndpointDefinition::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => strtoupper($this->faker->unique()->lexify('T?_???????')),
            'longname' => $this->faker->sentence(4),
            'description' => $this->faker->paragraph(),
            'release' => 'df14',
            'coverage_profile' => CoverageProfile::UNIVERSAL,
            'coverage_bucket' => CoverageBucket::FULLY_MAPPED,
            'universal_pct' => $this->faker->randomFloat(2, 50, 100),
            'total_tokens' => 10,
            'resolved_tokens' => 10,
            'tags' => [],
            'qualifying_event_spec' => ['source_codes' => []],
        ];
    }
}
