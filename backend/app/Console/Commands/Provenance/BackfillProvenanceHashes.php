<?php

namespace App\Console\Commands\Provenance;

use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Scopes\LibraryDefaultScope;
use App\Support\Hashing\DefinitionHasher;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

/**
 * Abby provenance spine (ADR-0020, Phase 1) — one-time, idempotent backfill.
 *
 * Fills `expression_sha256` for concept sets and cohort definitions where it is
 * NULL (legacy rows created before the provenance saving-hook existed).
 * Null-only: it never overwrites an existing hash, so it is safe to re-run.
 * Uses saveQuietly so it does not fire model events (the hash is set
 * explicitly here, and there is no need to bump `updated_at` or re-run
 * quality-tier observers).
 */
class BackfillProvenanceHashes extends Command
{
    protected $signature = 'provenance:backfill-hashes {--chunk=500 : Rows per chunk}';

    protected $description = 'Backfill expression_sha256 for concept sets and cohort definitions where null (idempotent).';

    public function handle(DefinitionHasher $hasher): int
    {
        $chunk = max(1, (int) $this->option('chunk'));

        $conceptSets = 0;
        ConceptSet::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->whereNull('expression_sha256')
            ->chunkById($chunk, function (Collection $rows) use ($hasher, &$conceptSets): void {
                /** @var ConceptSet $row */
                foreach ($rows as $row) {
                    $row->expression_sha256 = $hasher->hashExpression($row->expression_json ?? []);
                    $row->saveQuietly();
                    $conceptSets++;
                }
            });

        $cohortDefinitions = 0;
        CohortDefinition::query()
            ->withoutGlobalScope(LibraryDefaultScope::class)
            ->whereNull('expression_sha256')
            ->chunkById($chunk, function (Collection $rows) use ($hasher, &$cohortDefinitions): void {
                /** @var CohortDefinition $row */
                foreach ($rows as $row) {
                    $row->expression_sha256 = $hasher->hashExpression($row->expression_json ?? []);
                    $row->saveQuietly();
                    $cohortDefinitions++;
                }
            });

        $this->table(
            ['Table', 'Backfilled'],
            [['concept_sets', $conceptSets], ['cohort_definitions', $cohortDefinitions]],
        );

        $this->info("Provenance backfill complete — {$conceptSets} concept set(s), {$cohortDefinitions} cohort definition(s).");

        return self::SUCCESS;
    }
}
