<?php

namespace App\Services\Ingestion;

use App\Enums\ReviewTier;
use App\Models\App\IngestionJob;

class ConfidenceRouterService
{
    /**
     * Route mappings into review tiers based on confidence scores.
     *
     * @return array<string, int>
     */
    public function routeMappings(IngestionJob $job): array
    {
        $mappings = $job->conceptMappings()->with('candidates')->get();
        $counts = [
            'auto_accepted' => 0,
            'quick_review' => 0,
            'full_review' => 0,
            'unmappable' => 0,
            'total' => $mappings->count(),
        ];

        foreach ($mappings as $mapping) {
            $topCandidate = $mapping->candidates->sortByDesc('score')->first();

            if (! $topCandidate || $topCandidate->score < 0.10) {
                $mapping->update([
                    'review_tier' => ReviewTier::Unmappable,
                    'target_concept_id' => 0,
                    'is_reviewed' => true,
                ]);
                $counts['unmappable']++;
            } elseif ($topCandidate->score >= 0.95) {
                $mapping->update([
                    'review_tier' => ReviewTier::AutoAccepted,
                    'target_concept_id' => $topCandidate->target_concept_id,
                    'confidence' => $topCandidate->score,
                    'strategy' => 'auto_accept',
                    'is_reviewed' => true,
                ]);
                $counts['auto_accepted']++;
            } elseif ($topCandidate->score >= 0.70) {
                $mapping->update([
                    'review_tier' => ReviewTier::QuickReview,
                    'target_concept_id' => $topCandidate->target_concept_id,
                    'confidence' => $topCandidate->score,
                    'strategy' => $topCandidate->strategy,
                ]);
                $counts['quick_review']++;
            } else {
                $mapping->update([
                    'review_tier' => ReviewTier::FullReview,
                    'target_concept_id' => $topCandidate->target_concept_id,
                    'confidence' => $topCandidate->score,
                    'strategy' => $topCandidate->strategy,
                ]);
                $counts['full_review']++;
            }
        }

        return $counts;
    }
}
