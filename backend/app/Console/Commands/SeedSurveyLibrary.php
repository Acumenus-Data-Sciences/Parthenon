<?php

namespace App\Console\Commands;

use App\Models\Survey\SurveyInstrument;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class SeedSurveyLibrary extends Command
{
    protected $signature = 'survey:seed-library
        {--fresh : Delete all existing instruments before seeding}
        {--instruments-only : Seed only instrument metadata, skip items/answers}';

    protected $description = 'Seed the Standard PROs+ Survey Instrument Library (100 instruments with items and answer options)';

    public function handle(): int
    {
        $fixturesPath = database_path('fixtures/survey-instruments');

        if (! File::isDirectory($fixturesPath)) {
            $this->error("Fixtures directory not found: {$fixturesPath}");

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->warn('Deleting all existing survey instruments...');
            DB::table('survey_responses')->truncate();
            DB::table('survey_conduct')->truncate();
            DB::table('survey_answer_options')->truncate();
            DB::table('survey_items')->truncate();
            SurveyInstrument::withTrashed()->forceDelete();
        }

        $files = File::glob("{$fixturesPath}/*.json");
        if (count($files) === 0) {
            $this->error('No fixture JSON files found.');

            return self::FAILURE;
        }

        $this->info('Found '.count($files).' fixture file(s).');

        $created = 0;
        $updated = 0;
        $itemsCreated = 0;

        foreach ($files as $file) {
            $instruments = json_decode(File::get($file), true);
            if (! is_array($instruments)) {
                $this->warn("Skipping invalid file: {$file}");

                continue;
            }

            foreach ($instruments as $data) {
                $instrument = SurveyInstrument::withTrashed()
                    ->where('abbreviation', $data['abbreviation'])
                    ->first();

                $instrumentData = [
                    'name' => $data['name'],
                    'abbreviation' => $data['abbreviation'],
                    'version' => $data['version'] ?? '1.0',
                    'description' => $data['description'] ?? null,
                    'domain' => $data['domain'],
                    'item_count' => $data['item_count'] ?? 0,
                    'scoring_method' => $data['scoring_method'] ?? null,
                    'loinc_panel_code' => $data['loinc_panel_code'] ?? null,
                    'omop_concept_id' => $data['omop_concept_id'] ?? null,
                    'license_type' => $data['license_type'] ?? 'public',
                    'license_detail' => $data['license_detail'] ?? null,
                    'is_public_domain' => $data['is_public_domain'] ?? true,
                    'is_active' => true,
                    'omop_coverage' => $data['omop_coverage'] ?? 'no',
                ];

                if ($instrument) {
                    $instrument->update($instrumentData);
                    $instrument->restore();
                    $updated++;
                } else {
                    $instrument = SurveyInstrument::create($instrumentData);
                    $created++;
                }

                // Seed items + answer options if provided and not --instruments-only
                if (! $this->option('instruments-only') && ! empty($data['items'])) {
                    $instrument->items()->delete();

                    foreach ($data['items'] as $itemData) {
                        $item = $instrument->items()->create([
                            'item_number' => $itemData['item_number'],
                            'item_text' => $itemData['item_text'] ?? $itemData['text'] ?? '',
                            'response_type' => $itemData['response_type'] ?? 'likert',
                            'omop_concept_id' => $itemData['omop_concept_id'] ?? null,
                            'loinc_code' => $itemData['loinc_code'] ?? null,
                            'subscale_name' => $itemData['subscale_name'] ?? null,
                            'is_reverse_coded' => $itemData['is_reverse_coded'] ?? false,
                            'min_value' => $itemData['min_value'] ?? null,
                            'max_value' => $itemData['max_value'] ?? null,
                            'display_order' => $itemData['display_order'] ?? $itemData['item_number'],
                        ]);

                        $answers = $itemData['answers'] ?? $itemData['options'] ?? [];
                        foreach ($answers as $idx => $ans) {
                            $item->answerOptions()->create([
                                'option_text' => $ans['text'] ?? $ans['option_text'] ?? '',
                                'option_value' => $ans['value'] ?? $ans['option_value'] ?? null,
                                'omop_concept_id' => $ans['omop_concept_id'] ?? null,
                                'loinc_la_code' => $ans['loinc_la_code'] ?? $ans['loinc_code'] ?? null,
                                'display_order' => $ans['display_order'] ?? $idx + 1,
                            ]);
                        }

                        $itemsCreated++;
                    }

                    $instrument->update(['item_count' => count($data['items'])]);
                }
            }
        }

        $this->info("Survey library seeded: {$created} created, {$updated} updated, {$itemsCreated} items loaded.");

        return self::SUCCESS;
    }
}
