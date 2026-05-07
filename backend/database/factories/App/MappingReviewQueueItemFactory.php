<?php

declare(strict_types=1);

namespace Database\Factories\App;

use App\Models\App\MappingReviewQueueItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MappingReviewQueueItem>
 */
class MappingReviewQueueItemFactory extends Factory
{
    protected $model = MappingReviewQueueItem::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $candidates = [
            [
                'concept_id' => fake()->numberBetween(3000000, 4500000),
                'concept_name' => fake()->words(4, true),
                'vocabulary_id' => 'SNOMED',
                'domain_id' => 'Condition',
                'similarity' => fake()->randomFloat(4, 0.6, 0.99),
            ],
            [
                'concept_id' => fake()->numberBetween(3000000, 4500000),
                'concept_name' => fake()->words(3, true),
                'vocabulary_id' => 'SNOMED',
                'domain_id' => 'Condition',
                'similarity' => fake()->randomFloat(4, 0.4, 0.85),
            ],
            [
                'concept_id' => fake()->numberBetween(3000000, 4500000),
                'concept_name' => fake()->words(3, true),
                'vocabulary_id' => 'LOINC',
                'domain_id' => 'Measurement',
                'similarity' => fake()->randomFloat(4, 0.3, 0.7),
            ],
        ];

        return [
            'source_code' => strtoupper(fake()->bothify('???###')),
            'source_vocab' => fake()->randomElement(['ICD10CM', 'ICD9CM', 'NDC', 'LOCAL_LIS', 'READ']),
            'source_text' => fake()->sentence(6),
            'seen_count' => fake()->numberBetween(1, 1500),
            'candidate_ranking_json' => $candidates,
            'top1_confidence' => $candidates[0]['similarity'],
            'model_version' => 'harmonia-v0.1+haiku-4.5-20251001',
            'status' => MappingReviewQueueItem::STATUS_PENDING,
        ];
    }

    public function approved(int $conceptId, int $reviewerId): static
    {
        return $this->state(fn () => [
            'status' => MappingReviewQueueItem::STATUS_APPROVED,
            'approved_concept_id' => $conceptId,
            'reviewer_id' => $reviewerId,
            'reviewed_at' => now(),
        ]);
    }

    public function rejected(string $reason, int $reviewerId): static
    {
        return $this->state(fn () => [
            'status' => MappingReviewQueueItem::STATUS_REJECTED,
            'rejection_reason' => $reason,
            'reviewer_id' => $reviewerId,
            'reviewed_at' => now(),
        ]);
    }

    public function escalated(string $note, int $reviewerId): static
    {
        return $this->state(fn () => [
            'status' => MappingReviewQueueItem::STATUS_ESCALATED,
            'rejection_reason' => $note,
            'reviewer_id' => $reviewerId,
            'escalated_at' => now(),
        ]);
    }
}
