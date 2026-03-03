<?php

namespace Database\Factories\App;

use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ConceptSetItem> */
class ConceptSetItemFactory extends Factory
{
    protected $model = ConceptSetItem::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'concept_set_id' => ConceptSet::factory(),
            'concept_id' => fake()->numberBetween(1, 999999),
            'is_excluded' => false,
            'include_descendants' => true,
            'include_mapped' => false,
        ];
    }

    public function excluded(): static
    {
        return $this->state(['is_excluded' => true]);
    }
}
