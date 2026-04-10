<?php

namespace App\Jobs\Solr;

use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Services\Solr\CohortSearchService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SolrUpdateCohortJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 10;

    public function __construct(
        public string $type,
        public int $modelId,
        public bool $isDelete,
    ) {
        $this->queue = 'solr';
    }

    public function handle(CohortSearchService $service): void
    {
        $id = "{$this->type}_{$this->modelId}";

        if ($this->isDelete) {
            $service->delete($id);

            return;
        }

        if ($this->type === 'cohort') {
            $this->indexCohort($service);
        } elseif ($this->type === 'study') {
            $this->indexStudy($service);
        }
    }

    private function indexCohort(CohortSearchService $service): void
    {
        $cohort = CohortDefinition::withCount('generations')
            ->with('author:id,name,email')
            ->find($this->modelId);

        if (! $cohort) {
            return;
        }

        $latestGen = $cohort->generations()
            ->where('status', 'completed')
            ->orderByDesc('created_at')
            ->first(['person_count']);

        $doc = [
            'id' => 'cohort_'.$cohort->id,
            'type' => 'cohort',
            'name' => $cohort->name,
            'name_sort' => mb_strtolower($cohort->name),
            'description' => $cohort->description ?? '',
            'tags' => $cohort->tags ?? [],
            'author_name' => $cohort->author?->name ?? '',
            'author_id' => $cohort->author_id,
            'status' => $cohort->generations_count > 0 ? 'generated' : 'draft',
            'is_public' => $cohort->is_public,
            'person_count' => $latestGen?->person_count ?? 0,
            'generation_count' => $cohort->generations_count,
            'version' => $cohort->version ?? 1,
            'domain_s' => $cohort->domain,
            'quality_tier_s' => $cohort->quality_tier,
        ];

        if ($cohort->created_at) {
            $doc['created_at'] = $cohort->created_at->format('Y-m-d\TH:i:s\Z');
        }
        if ($cohort->updated_at) {
            $doc['updated_at'] = $cohort->updated_at->format('Y-m-d\TH:i:s\Z');
        }

        if (! $service->indexCohort($doc)) {
            Log::warning('Failed to index cohort to Solr', ['id' => $cohort->id]);
        }
    }

    private function indexStudy(CohortSearchService $service): void
    {
        $study = Study::with([
            'author:id,name,email',
            'principalInvestigator:id,name,email',
        ])->find($this->modelId);

        if (! $study) {
            return;
        }

        $doc = [
            'id' => 'study_'.$study->id,
            'type' => 'study',
            'name' => $study->title,
            'name_sort' => mb_strtolower($study->title),
            'description' => $study->description ?? '',
            'tags' => $study->tags ?? [],
            'author_name' => $study->author?->name ?? '',
            'author_id' => $study->created_by,
            'status' => $study->status ?? 'draft',
            'is_public' => false,
            'study_type' => $study->study_type ?? '',
            'study_design' => $study->study_design ?? '',
            'phase' => $study->phase ?? '',
            'priority' => $study->priority ?? '',
            'scientific_rationale' => $study->scientific_rationale ?? '',
            'hypothesis' => $study->hypothesis ?? '',
            'pi_name' => $study->principalInvestigator?->name ?? '',
        ];

        if ($study->created_at) {
            $doc['created_at'] = $study->created_at->format('Y-m-d\TH:i:s\Z');
        }
        if ($study->updated_at) {
            $doc['updated_at'] = $study->updated_at->format('Y-m-d\TH:i:s\Z');
        }

        if (! $service->indexStudy($doc)) {
            Log::warning('Failed to index study to Solr', ['id' => $study->id]);
        }
    }
}
