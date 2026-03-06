<?php

namespace App\Services\Genomics;

use App\Models\App\GenomicUpload;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Matches genomic variants to OMOP person_id records.
 *
 * Matching strategies (in priority order):
 * 1. Direct sample_id → person_id lookup (if upload sample_id is a person_source_value)
 * 2. Tumor Sample Barcode / MRN lookup via Note or Person source_value
 * 3. Manual mapping via the review queue (mapping_status = 'review')
 */
class PersonMatcherService
{
    /**
     * Attempt to match all variants in an upload to OMOP person records.
     *
     * @return array{matched: int, unmatched: int}
     */
    public function matchUpload(GenomicUpload $upload, string $connectionName = 'cdm', string $schema = 'omop'): array
    {
        $sampleId = $upload->sample_id;
        $matched = 0;
        $unmatched = 0;

        $conn = DB::connection($connectionName);

        // Strategy 1: sample_id is a numeric person_id
        if ($sampleId && is_numeric($sampleId)) {
            $personId = (int) $sampleId;
            $exists = $conn->selectOne("SELECT 1 FROM {$schema}.person WHERE person_id = ? LIMIT 1", [$personId]);
            if ($exists) {
                $count = $upload->variants()->whereNull('person_id')->update(['person_id' => $personId]);

                return ['matched' => $count, 'unmatched' => 0];
            }
        }

        // Strategy 2: sample_id matches person_source_value
        if ($sampleId) {
            try {
                $person = $conn->selectOne(
                    "SELECT person_id FROM {$schema}.person WHERE person_source_value = ? LIMIT 1",
                    [$sampleId]
                );
                if ($person) {
                    $count = $upload->variants()->whereNull('person_id')->update(['person_id' => $person->person_id]);

                    return ['matched' => $count, 'unmatched' => 0];
                }
            } catch (\Throwable $e) {
                Log::warning('PersonMatcherService: person_source_value lookup failed', ['error' => $e->getMessage()]);
            }
        }

        // Strategy 3: match per variant by sample_id column in genomic_variants
        // (supports multi-sample VCF where each variant has its own sample_id)
        $sampleIds = $upload->variants()
            ->whereNull('person_id')
            ->whereNotNull('sample_id')
            ->distinct()
            ->pluck('sample_id');

        foreach ($sampleIds as $sid) {
            if (! $sid) {
                continue;
            }

            $personId = null;

            // Try numeric
            if (is_numeric($sid)) {
                $check = $conn->selectOne("SELECT person_id FROM {$schema}.person WHERE person_id = ? LIMIT 1", [(int) $sid]);
                if ($check) {
                    $personId = (int) $check->person_id;
                }
            }

            // Try person_source_value
            if ($personId === null) {
                try {
                    $check = $conn->selectOne(
                        "SELECT person_id FROM {$schema}.person WHERE person_source_value = ? LIMIT 1",
                        [$sid]
                    );
                    if ($check) {
                        $personId = (int) $check->person_id;
                    }
                } catch (\Throwable) {
                    // continue
                }
            }

            if ($personId !== null) {
                $count = $upload->variants()
                    ->where('sample_id', $sid)
                    ->whereNull('person_id')
                    ->update(['person_id' => $personId]);
                $matched += $count;
            }
        }

        $unmatched = $upload->variants()->whereNull('person_id')->count();

        return ['matched' => $matched, 'unmatched' => $unmatched];
    }
}
