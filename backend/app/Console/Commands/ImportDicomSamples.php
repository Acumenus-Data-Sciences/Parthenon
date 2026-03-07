<?php

namespace App\Console\Commands;

use App\Models\App\ImagingInstance;
use App\Models\App\ImagingStudy;
use App\Models\App\Source;
use App\Services\Imaging\DicomFileService;
use Illuminate\Console\Command;

class ImportDicomSamples extends Command
{
    protected $signature = 'imaging:import-samples
                            {--dir=dicom_samples : Directory to scan (relative to repo root)}
                            {--source= : Source name or ID to associate studies with}
                            {--person-id= : OMOP person_id to link studies to}';

    protected $description = 'Import local DICOM files into imaging_studies / imaging_series / imaging_instances tables';

    public function __construct(private readonly DicomFileService $dicomFiles)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $relDir = $this->option('dir');
        $absDir = base_path($relDir);

        if (! is_dir($absDir)) {
            $this->error("Directory not found: {$absDir}");

            return Command::FAILURE;
        }

        // Resolve source
        $sourceOpt = $this->option('source');
        if ($sourceOpt) {
            $source = is_numeric($sourceOpt)
                ? Source::find((int) $sourceOpt)
                : Source::where('source_name', $sourceOpt)->first();
        } else {
            $source = Source::first();
        }

        if (! $source) {
            $this->error('No source found. Create a source first or pass --source=NAME.');

            return Command::FAILURE;
        }

        $this->info("Scanning: {$absDir}");
        $this->info("Source:   {$source->source_name} (#{$source->id})");
        $this->newLine();

        $result = $this->dicomFiles->importDirectory($absDir, $source->id);

        // Link studies to a patient if --person-id provided
        $personId = $this->option('person-id');
        if ($personId) {
            $personId = (int) $personId;
            $updated = ImagingStudy::where('source_id', $source->id)
                ->whereNull('person_id')
                ->update(['person_id' => $personId]);
            $this->info("Linked {$updated} studies to person_id={$personId}");
        }

        $this->info('Import complete:');
        $this->line("  Studies:   {$result['studies']}");
        $this->line("  Series:    {$result['series']}");
        $this->line("  Instances: {$result['instances']}");
        if ($result['errors'] > 0) {
            $this->warn("  Errors:    {$result['errors']}");
        }

        $this->newLine();
        $this->line("DB totals for source #{$source->id}:");
        $this->line('  Studies:   '.ImagingStudy::where('source_id', $source->id)->count());
        $this->line('  Instances: '.ImagingInstance::whereHas('study', fn ($q) => $q->where('source_id', $source->id))->count());

        return Command::SUCCESS;
    }
}
