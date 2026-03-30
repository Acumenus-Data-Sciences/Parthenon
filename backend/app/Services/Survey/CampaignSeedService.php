<?php

namespace App\Services\Survey;

use App\Models\App\CohortGeneration;
use App\Models\Survey\SurveyCampaign;
use App\Services\Cohort\CohortGenerationService;

class CampaignSeedService
{
    public function __construct(
        private readonly CohortGenerationService $cohortGenerationService,
    ) {}

    public function seed(SurveyCampaign $campaign): int
    {
        if ($campaign->cohort_generation_id === null) {
            return 0;
        }

        if ($campaign->conductRecords()->whereNotNull('person_id')->exists()) {
            return 0;
        }

        /** @var CohortGeneration $generation */
        $generation = CohortGeneration::query()
            ->with(['source.daimons', 'cohortDefinition'])
            ->findOrFail($campaign->cohort_generation_id);

        $offset = 0;
        $limit = 1000;
        $inserted = 0;

        do {
            $result = $this->cohortGenerationService->getMembers(
                generation: $generation,
                limit: $limit,
                offset: $offset,
            );

            $members = $result['members'];
            $rows = [];

            foreach ($members as $member) {
                $personId = isset($member['subject_id']) ? (int) $member['subject_id'] : null;

                if ($personId === null) {
                    continue;
                }

                $rows[] = [
                    'person_id' => $personId,
                    'survey_instrument_id' => $campaign->survey_instrument_id,
                    'campaign_id' => $campaign->id,
                    'completion_status' => 'pending',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            if ($rows !== []) {
                $campaign->conductRecords()->insert($rows);
                $inserted += count($rows);
            }

            $offset += count($members);
        } while (count($members) === $limit);

        return $inserted;
    }
}
