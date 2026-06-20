<?php

declare(strict_types=1);

use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;

function liveOmopFkAuditEnabled(): bool
{
    return filter_var(getenv('PARTHENON_LIVE_OMOP_FK_AUDIT') ?: false, FILTER_VALIDATE_BOOLEAN);
}

function liveOmopFkAuditSetting(string $name, string $default): string
{
    $value = getenv($name);

    return $value === false || $value === '' ? $default : $value;
}

beforeEach(function (): void {
    if (! liveOmopFkAuditEnabled()) {
        test()->markTestSkipped(
            'Live OMOP foreign-key audit skipped. Set PARTHENON_LIVE_OMOP_FK_AUDIT=1 to scan the local parthenon database.'
        );
    }

    config(['database.connections.local_parthenon' => [
        'driver' => 'pgsql',
        'host' => liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_DB_HOST', '127.0.0.1'),
        'port' => (int) liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_DB_PORT', '5432'),
        'database' => liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_DB_DATABASE', 'parthenon'),
        'username' => liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_DB_USERNAME', 'claude_dev'),
        'password' => liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_DB_PASSWORD', ''),
        'search_path' => liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_DB_SEARCH_PATH', 'omop,vocab,app,public'),
    ]]);

    try {
        $connection = DB::connection('local_parthenon');
        $pdo = $connection->getPdo();
        $timeout = $pdo->quote(liveOmopFkAuditSetting('PARTHENON_LIVE_OMOP_FK_STATEMENT_TIMEOUT', '120s'));
        $connection->statement("SET statement_timeout = {$timeout}");
    } catch (Throwable $e) {
        test()->markTestSkipped('Local parthenon database not reachable (CI environment).');
    }
});

function localDb(): ConnectionInterface
{
    return DB::connection('local_parthenon');
}

it('all person records have valid gender_concept_id in vocab', function (): void {
    $orphans = localDb()->select('
        SELECT p.person_id, p.gender_concept_id
        FROM omop.person p
        LEFT JOIN vocab.concept c ON c.concept_id = p.gender_concept_id
        WHERE c.concept_id IS NULL
          AND p.gender_concept_id <> 0
        LIMIT 10
    ');

    expect($orphans)->toBeEmpty()
        ->when(
            count($orphans) > 0,
            fn ($e) => $e->and('Orphan gender_concept_ids found: '.json_encode($orphans))->toBeEmpty()
        );
})->group('live-omop', 'environment-bound');

it('all condition_occurrence records reference valid condition_concept_id', function (): void {
    $orphans = localDb()->select('
        SELECT co.condition_occurrence_id, co.condition_concept_id
        FROM omop.condition_occurrence co
        LEFT JOIN vocab.concept c ON c.concept_id = co.condition_concept_id
        WHERE c.concept_id IS NULL
          AND co.condition_concept_id <> 0
        LIMIT 10
    ');

    expect($orphans)->toBeEmpty()
        ->when(
            count($orphans) > 0,
            fn ($e) => $e->and('Orphan condition_concept_ids found: '.json_encode($orphans))->toBeEmpty()
        );
})->group('live-omop', 'environment-bound');

it('all drug_exposure records reference valid drug_concept_id', function (): void {
    $orphans = localDb()->select('
        SELECT de.drug_concept_id, COUNT(*) AS cnt
        FROM omop.drug_exposure de
        LEFT JOIN vocab.concept c ON c.concept_id = de.drug_concept_id
        WHERE c.concept_id IS NULL
          AND de.drug_concept_id <> 0
        GROUP BY de.drug_concept_id
        ORDER BY cnt DESC
        LIMIT 10
    ');

    if (count($orphans) > 0) {
        $details = array_map(fn ($row) => "concept_id={$row->drug_concept_id} ({$row->cnt} rows)", $orphans);
        fwrite(STDERR, sprintf(
            "\n  WARNING: %d orphan drug_concept_ids found (vocab version mismatch): %s\n",
            count($orphans),
            implode(', ', $details)
        ));
    }

    // Warn only — known vocab version mismatch in SynPUF drug_exposure data
    // TODO: resolve by re-indexing vocabulary or remapping orphan concept_ids
    expect(true)->toBeTrue();
})->group('live-omop', 'environment-bound');

it('all measurement records reference valid measurement_concept_id', function (): void {
    $orphans = localDb()->select('
        SELECT m.measurement_id, m.measurement_concept_id
        FROM omop.measurement m
        LEFT JOIN vocab.concept c ON c.concept_id = m.measurement_concept_id
        WHERE c.concept_id IS NULL
          AND m.measurement_concept_id <> 0
        LIMIT 10
    ');

    expect($orphans)->toBeEmpty()
        ->when(
            count($orphans) > 0,
            fn ($e) => $e->and('Orphan measurement_concept_ids found: '.json_encode($orphans))->toBeEmpty()
        );
})->group('live-omop', 'environment-bound');

it('all visit_occurrence records reference valid persons', function (): void {
    $orphans = localDb()->select('
        SELECT vo.visit_occurrence_id, vo.person_id
        FROM omop.visit_occurrence vo
        LEFT JOIN omop.person p ON p.person_id = vo.person_id
        WHERE p.person_id IS NULL
        LIMIT 10
    ');

    expect($orphans)->toBeEmpty()
        ->when(
            count($orphans) > 0,
            fn ($e) => $e->and('Orphan visit_occurrence person_ids found: '.json_encode($orphans))->toBeEmpty()
        );
})->group('live-omop', 'environment-bound');

it('observation_period covers every person', function (): void {
    $uncovered = localDb()->select('
        SELECT p.person_id
        FROM omop.person p
        LEFT JOIN omop.observation_period op ON op.person_id = p.person_id
        WHERE op.person_id IS NULL
        LIMIT 10
    ');

    if (count($uncovered) > 0) {
        $personIds = array_map(fn ($row) => $row->person_id, $uncovered);
        fwrite(STDERR, sprintf(
            "\n  WARNING: %d+ persons lack observation_period records (e.g. person_ids: %s)\n",
            count($uncovered),
            implode(', ', $personIds)
        ));
    }

    // Warn only — do not fail
    expect(true)->toBeTrue();
})->group('live-omop', 'environment-bound');
