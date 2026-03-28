<?php

namespace App\Console\Commands;

use App\Models\App\ImagingStudy;
use Illuminate\Console\Command;

class BackfillImagingStudyMetadata extends Command
{
    protected $signature = 'imaging:backfill-study-metadata
        {--source-id= : Limit to a specific source_id}
        {--chunk-size=200 : Number of studies to process per chunk}
        {--dry-run : Preview changes without writing them}';

    protected $description = 'Non-destructively backfill missing imaging study metadata from related series rows';

    /**
     * Generic series descriptions that are not useful as study descriptions.
     *
     * @var array<int, string>
     */
    private array $genericDescriptions = [
        'ct',
        'mr',
        'mri',
        'pt',
        'pet',
        'xa',
        'us',
        'mg',
        'cr',
        'dx',
        'nm',
        'sc',
        'ot',
        'sr',
        'pr',
        'seg',
        'segmentation',
        'dose info',
        'dose report',
        'screen save',
        'localizer',
        'scout',
    ];

    public function handle(): int
    {
        $chunkSize = max(1, (int) $this->option('chunk-size'));
        $sourceId = $this->option('source-id');
        $dryRun = (bool) $this->option('dry-run');

        $query = ImagingStudy::query()
            ->with(['series' => fn ($series) => $series
                ->orderByDesc('num_images')
                ->orderBy('series_number')
                ->orderBy('id')])
            ->where(function ($q) {
                $q->whereNull('study_description')
                    ->orWhere('study_description', '')
                    ->orWhereNull('body_part_examined')
                    ->orWhere('body_part_examined', '');
            })
            ->orderBy('id');

        if ($sourceId !== null && $sourceId !== '') {
            $query->where('source_id', (int) $sourceId);
        }

        $total = (clone $query)->count();

        if ($total === 0) {
            $this->info('No studies need backfill.');

            return self::SUCCESS;
        }

        $this->info(sprintf(
            '%s backfill for %d studies.',
            $dryRun ? 'Dry-run' : 'Starting',
            $total
        ));

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $scanned = 0;
        $updated = 0;
        $descriptionFilled = 0;
        $bodyPartFilled = 0;

        $query->chunkById($chunkSize, function ($studies) use (
            $bar,
            $dryRun,
            &$scanned,
            &$updated,
            &$descriptionFilled,
            &$bodyPartFilled
        ) {
            foreach ($studies as $study) {
                $scanned++;

                $patch = [];
                $description = $this->pickStudyDescription($study);
                $bodyPart = $this->pickBodyPart($study);

                if ($this->isBlank($study->study_description) && $description !== null) {
                    $patch['study_description'] = $description;
                    $descriptionFilled++;
                }

                if ($this->isBlank($study->body_part_examined) && $bodyPart !== null) {
                    $patch['body_part_examined'] = $bodyPart;
                    $bodyPartFilled++;
                }

                if ($patch !== []) {
                    $updated++;

                    if (! $dryRun) {
                        $study->update($patch);
                    }
                }

                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->table(
            ['Metric', 'Value'],
            [
                ['Scanned', (string) $scanned],
                ['Updated', (string) $updated],
                ['Descriptions Filled', (string) $descriptionFilled],
                ['Body Parts Filled', (string) $bodyPartFilled],
                ['Mode', $dryRun ? 'dry-run' : 'write'],
            ]
        );

        return self::SUCCESS;
    }

    private function pickStudyDescription(ImagingStudy $study): ?string
    {
        foreach ($study->series as $series) {
            $description = $this->normalizeText($series->series_description);

            if ($description === null || ! $this->isUsefulDescription($description)) {
                continue;
            }

            return $description;
        }

        return null;
    }

    private function pickBodyPart(ImagingStudy $study): ?string
    {
        foreach ($study->series as $series) {
            $bodyPart = $this->normalizeText($series->body_part_examined);

            if ($bodyPart !== null) {
                return $bodyPart;
            }
        }

        return null;
    }

    private function isUsefulDescription(string $description): bool
    {
        $normalized = strtolower(trim($description));

        return ! in_array($normalized, $this->genericDescriptions, true);
    }

    private function normalizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim(preg_replace('/\s+/', ' ', $value) ?? '');

        return $normalized === '' ? null : $normalized;
    }

    private function isBlank(?string $value): bool
    {
        return $this->normalizeText($value) === null;
    }
}
