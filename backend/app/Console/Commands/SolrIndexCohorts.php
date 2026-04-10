<?php

namespace App\Console\Commands;

use App\Models\App\CohortDefinition;
use App\Models\App\Study;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class SolrIndexCohorts extends Command
{
    protected $signature = 'solr:index-cohorts
        {--type= : Only index "cohort" or "study"}
        {--fresh : Delete all documents before indexing}';

    protected $description = 'Index cohort definitions and studies into the Solr cohorts core';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.cohorts', 'cohorts');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $type = $this->option('type');
        $indexed = 0;
        $errors = 0;
        $startTime = microtime(true);

        // Index cohort definitions
        if (! $type || $type === 'cohort') {
            $this->info('Indexing cohort definitions...');
            $cohorts = CohortDefinition::withCount('generations')
                ->with(['author:id,name,email'])
                ->get();

            foreach ($cohorts as $cohort) {
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
                    'domain_s' => $cohort->domain?->value,
                    'quality_tier_s' => $cohort->quality_tier,
                ];

                if ($cohort->created_at) {
                    $doc['created_at'] = $cohort->created_at->format('Y-m-d\TH:i:s\Z');
                }
                if ($cohort->updated_at) {
                    $doc['updated_at'] = $cohort->updated_at->format('Y-m-d\TH:i:s\Z');
                }

                if ($solr->addDocuments($core, [$doc])) {
                    $indexed++;
                } else {
                    $errors++;
                }
            }

            $this->info("  Cohorts: {$indexed} indexed");
        }

        // Index studies
        $studyIndexed = 0;
        if (! $type || $type === 'study') {
            $this->info('Indexing studies...');
            $studies = Study::with([
                'author:id,name,email',
                'principalInvestigator:id,name,email',
            ])->get();

            foreach ($studies as $study) {
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

                if ($solr->addDocuments($core, [$doc])) {
                    $studyIndexed++;
                    $indexed++;
                } else {
                    $errors++;
                }
            }

            $this->info("  Studies: {$studyIndexed} indexed");
        }

        // Commit
        $this->info('Committing...');
        $solr->commit($core);

        $elapsed = round(microtime(true) - $startTime, 1);
        $docCount = $solr->documentCount($core);

        $this->info("Total indexed: {$indexed} | Errors: {$errors} | Time: {$elapsed}s");
        $this->info("Solr document count: {$docCount}");

        if ($errors > 0) {
            $this->warn("Completed with {$errors} errors.");

            return self::FAILURE;
        }

        $this->info('Cohort/study indexing complete.');

        return self::SUCCESS;
    }
}
