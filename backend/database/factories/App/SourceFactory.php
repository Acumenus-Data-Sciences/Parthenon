<?php

namespace Database\Factories\App;

use App\Models\App\Source;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * FOR TESTS ONLY — never reference this factory from seeders.
 * Real sources are created exclusively via:
 *   php artisan acumenus:seed-source
 *   php artisan eunomia:seed-source
 *
 * @extends Factory<Source>
 */
class SourceFactory extends Factory
{
    protected $model = Source::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        if (app()->environment('production')) {
            throw new \LogicException(
                'SourceFactory must never run in production. '
                .'Use `php artisan acumenus:seed-source` or `php artisan eunomia:seed-source` instead.'
            );
        }

        return [
            'source_name' => 'Test CDM '.fake()->numerify('###'),
            'source_key' => 'test-'.fake()->unique()->numerify('######'),
            'source_dialect' => 'postgresql',
            'source_connection' => 'jdbc:postgresql://localhost:5432/test',
            'is_cache_enabled' => false,
        ];
    }
}
