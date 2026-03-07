<?php

namespace App\Console\Commands;

use App\Models\App\ImagingStudy;
use App\Services\Solr\SolrClientWrapper;
use Illuminate\Console\Command;

class SolrIndexImaging extends Command
{
    protected $signature = 'solr:index-imaging
        {--fresh : Delete all documents before indexing}
        {--batch-size=200 : Number of studies per Solr batch}';

    protected $description = 'Index imaging studies into the Solr imaging core for faceted search';

    public function handle(SolrClientWrapper $solr): int
    {
        if (! $solr->isEnabled()) {
            $this->error('Solr is not enabled. Set SOLR_ENABLED=true in .env');

            return self::FAILURE;
        }

        $core = config('solr.cores.imaging', 'imaging');

        if (! $solr->ping($core)) {
            $this->error("Cannot reach Solr core '{$core}'. Is the Solr container running?");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->info('Deleting all existing documents...');
            $solr->deleteAll($core);
        }

        $batchSize = (int) $this->option('batch-size');
        $total = ImagingStudy::count();
        $this->info("Indexing {$total} imaging studies into Solr core '{$core}'...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $indexed = 0;

        ImagingStudy::with(['series', 'measurements'])
            ->orderBy('id')
            ->chunk($batchSize, function ($studies) use ($solr, $core, $bar, &$indexed) {
                $docs = [];

                foreach ($studies as $study) {
                    $docs[] = $this->studyToDocument($study);
                }

                $solr->addDocuments($core, $docs);
                $indexed += count($docs);
                $bar->advance(count($docs));
            });

        $solr->commit($core);
        $bar->finish();
        $this->newLine();
        $this->info("Indexed {$indexed} imaging studies.");

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function studyToDocument(ImagingStudy $study): array
    {
        $seriesModalities = $study->series
            ->pluck('modality')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $seriesDescriptions = $study->series
            ->pluck('series_description')
            ->filter()
            ->unique()
            ->values()
            ->all();

        $measurementCount = $study->measurements->count();

        $doc = [
            'study_id' => (string) $study->id,
            'study_instance_uid' => $study->study_instance_uid,
            'accession_number' => $study->accession_number,
            'person_id' => $study->person_id,
            'source_id' => $study->source_id,
            'modality' => $study->modality,
            'body_part_examined' => $study->body_part_examined,
            'study_description' => $study->study_description,
            'num_series' => $study->num_series,
            'num_images' => $study->num_images,
            'status' => $study->status,
            'has_measurements' => $measurementCount > 0,
            'measurement_count' => $measurementCount,
            'patient_id_dicom' => $study->patient_id_dicom,
            'patient_name_dicom' => $study->patient_name_dicom,
            'series_modalities' => $seriesModalities,
            'series_descriptions' => $seriesDescriptions,
        ];

        if ($study->study_date) {
            $doc['study_date'] = $study->study_date->format('Y-m-d\TH:i:s\Z');
        }

        return $doc;
    }
}
