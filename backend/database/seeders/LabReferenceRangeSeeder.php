<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Yaml\Yaml;

final class LabReferenceRangeSeeder extends Seeder
{
    private string $dataPath;

    public function __construct()
    {
        $this->dataPath = database_path('seeders/data/lab_reference_ranges.yaml');
    }

    public function setDataPath(string $path): void
    {
        $this->dataPath = $path;
    }

    public function run(): void
    {
        if (! file_exists($this->dataPath)) {
            throw new RuntimeException("Lab reference ranges YAML not found at {$this->dataPath}");
        }

        /** @var list<array{loinc: string, unit_ucum: string, ranges: list<array<string, mixed>>, source_ref: string, notes?: string|null}> $entries */
        $entries = Yaml::parseFile($this->dataPath);

        $now = now()->toDateTimeString();

        DB::transaction(function () use ($entries, $now): void {
            foreach ($entries as $entry) {
                $conceptId = $this->resolveLoinc($entry['loinc']);
                $unitId = $this->resolveUcum($entry['unit_ucum']);

                foreach ($entry['ranges'] as $r) {
                    DB::statement(
                        'INSERT INTO lab_reference_range_curated
                            (measurement_concept_id, unit_concept_id, sex, age_low, age_high,
                             range_low, range_high, source_ref, notes, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON CONFLICT (measurement_concept_id, unit_concept_id, sex, age_low, age_high)
                         DO UPDATE SET
                            range_low = EXCLUDED.range_low,
                            range_high = EXCLUDED.range_high,
                            source_ref = EXCLUDED.source_ref,
                            notes = EXCLUDED.notes,
                            updated_at = EXCLUDED.updated_at',
                        [
                            $conceptId,
                            $unitId,
                            (string) $r['sex'],
                            $r['age_low'] ?? null,
                            $r['age_high'] ?? null,
                            (float) $r['low'],
                            (float) $r['high'],
                            $entry['source_ref'],
                            $entry['notes'] ?? null,
                            $now,
                            $now,
                        ]
                    );
                }
            }
        });
    }

    private function resolveLoinc(string $code): int
    {
        /** @var object{concept_id: int}|null $row */
        $row = DB::table('vocab.concept')
            ->where('vocabulary_id', 'LOINC')
            ->where('concept_code', $code)
            ->where('standard_concept', 'S')
            ->first();

        if ($row === null) {
            throw new RuntimeException("Unresolvable LOINC code: {$code}");
        }

        return (int) $row->concept_id;
    }

    private function resolveUcum(string $code): int
    {
        /** @var object{concept_id: int}|null $row */
        $row = DB::table('vocab.concept')
            ->where('vocabulary_id', 'UCUM')
            ->where('concept_code', $code)
            ->first();

        if ($row === null) {
            throw new RuntimeException("Unresolvable UCUM unit: {$code}");
        }

        return (int) $row->concept_id;
    }
}
