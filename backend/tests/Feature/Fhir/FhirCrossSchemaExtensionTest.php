<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

/**
 * Real-schema rollback validation harness for the OMOP care-extension tables.
 *
 * Mock-based tests cannot catch missing columns, NOT-NULL violations, or cast
 * mismatches because they never touch a real schema. assertInsertableOmop runs
 * a genuine INSERT against the live `omop` connection inside a transaction that
 * is always rolled back, so the row never persists but every column/constraint
 * is exercised by PostgreSQL. A clean rollback (no DB exception) means the
 * shape is insertable.
 *
 * The whole file SKIPS gracefully when the `omop` schema is unwritable or
 * absent (read-only CI), mirroring CdmModelTest: a beforeEach probe attempts a
 * rolled-back person insert and marks the test skipped on any throwable.
 */

/**
 * Insert $data into omop.$table inside a rolled-back transaction and assert no
 * DB exception was raised. The sentinel exception unwinds the transaction so
 * nothing is committed.
 *
 * @param  array<string, mixed>  $data
 */
function assertInsertableOmop(string $table, array $data): void
{
    $thrown = null;
    try {
        // The harness intentionally targets the real omop connection to exercise
        // the live schema; the SourceAware trait is unavailable in a top-level
        // test helper function, so NoBareConnectionCallRule is suppressed here.
        // @phpstan-ignore-next-line
        DB::connection('omop')->transaction(function () use ($table, $data) {
            DB::connection('omop')->table($table)->insert($data); // @phpstan-ignore-line
            throw new RuntimeException('__rollback__');
        });
    } catch (Throwable $e) {
        if ($e->getMessage() !== '__rollback__') {
            $thrown = $e;
        }
    }
    expect($thrown)->toBeNull();
}

// Minimal valid OMOP person row — reuses the exact shape CdmModelTest seeds.
// person_id is a high sentinel; no commit happens (the harness always rolls
// back) so it can never collide with real data.
const OMOP_PROBE_PERSON_ID = 999000002;

/**
 * @return array<string, mixed>
 */
function omopProbePersonRow(): array
{
    return [
        'person_id' => OMOP_PROBE_PERSON_ID,
        'gender_concept_id' => 8507,
        'year_of_birth' => 1990,
        'race_concept_id' => 0,
        'ethnicity_concept_id' => 0,
        'gender_source_concept_id' => 0,
        'race_source_concept_id' => 0,
        'ethnicity_source_concept_id' => 0,
    ];
}

beforeEach(function () {
    // Probe omop writability with the same rolled-back-insert technique. If the
    // schema is absent or the role lacks INSERT/DDL, skip the whole file.
    try {
        // @phpstan-ignore-next-line — harness probe must hit the real omop connection.
        DB::connection('omop')->transaction(function () {
            DB::connection('omop')->table('person')->insert(omopProbePersonRow()); // @phpstan-ignore-line
            throw new RuntimeException('__rollback__');
        });
    } catch (Throwable $e) {
        if ($e->getMessage() !== '__rollback__') {
            $this->markTestSkipped('omop schema not writable/absent: '.$e->getMessage());
        }
    }
});

it('self-test: assertInsertableOmop passes for a valid person row', function () {
    assertInsertableOmop('person', omopProbePersonRow());
});

it('care_plan accepts a minimal valid row', function () {
    assertInsertableOmop('care_plan', [
        'person_id' => OMOP_PROBE_PERSON_ID,
        'care_plan_start_date' => '2026-01-01',
        'care_plan_source_value' => 'fhir-careplan-probe',
    ]);
});

it('care_goal accepts a minimal valid row', function () {
    assertInsertableOmop('care_goal', [
        'person_id' => OMOP_PROBE_PERSON_ID,
        'lifecycle_status' => 'active',
        'goal_start_date' => '2026-01-01',
        'goal_source_value' => 'fhir-goal-probe',
    ]);
});

it('care_team accepts a minimal valid row', function () {
    assertInsertableOmop('care_team', [
        'person_id' => OMOP_PROBE_PERSON_ID,
        'care_team_start_date' => '2026-01-01',
        'status' => 'active',
        'care_team_source_value' => 'fhir-careteam-probe',
    ]);
});

it('care_team_member accepts a minimal valid row', function () {
    assertInsertableOmop('care_team_member', [
        'care_team_id' => OMOP_PROBE_PERSON_ID,
        'provider_id' => null,
        'role_source_value' => 'fhir-careteam-member-probe',
    ]);
});

// Phase 3 — DocumentReference → note, Coverage → payer_plan_period,
// ServiceRequest → procedure_occurrence. Each row mirrors the exact shape its
// mapper emits, exercised against the live omop schema (visit_occurrence_id
// null so no foreign-key dependency).
//
// These three core CDM clinical tables have NOT-NULL primary keys with no DB
// default — unlike the care-extension tables above which use serial/identity
// PKs. In production the bulk loader assigns the surrogate key after the mapper
// returns (the inline FhirBulkMapper mappers, e.g. condition_occurrence, also
// omit the PK for this reason), so the mappers intentionally do NOT emit a
// `*_id` column. The probe supplies a sentinel PK to mirror the loader and
// exercise every remaining column/constraint.

it('note accepts a DocumentReferenceMapper row', function () {
    assertInsertableOmop('note', [
        'note_id' => OMOP_PROBE_PERSON_ID,
        'person_id' => OMOP_PROBE_PERSON_ID,
        'note_date' => '2026-01-01',
        'note_datetime' => '2026-01-01 10:00:00',
        'note_type_concept_id' => 32817,
        'note_class_concept_id' => 0,
        'note_title' => 'Progress note',
        'note_text' => 'Patient stable.',
        'encoding_concept_id' => 32678,
        'language_concept_id' => 4180186,
        'visit_occurrence_id' => null,
        'note_source_value' => '11506-3',
    ]);
});

it('payer_plan_period accepts a CoverageMapper row', function () {
    assertInsertableOmop('payer_plan_period', [
        'payer_plan_period_id' => OMOP_PROBE_PERSON_ID,
        'person_id' => OMOP_PROBE_PERSON_ID,
        'payer_plan_period_start_date' => '2024-01-01',
        'payer_plan_period_end_date' => '2024-12-31',
        'payer_concept_id' => 0,
        'payer_source_value' => 'Acme Health',
        'plan_concept_id' => 0,
        'plan_source_value' => 'Gold PPO',
    ]);
});

it('procedure_occurrence accepts a ServiceRequestMapper row', function () {
    assertInsertableOmop('procedure_occurrence', [
        'procedure_occurrence_id' => OMOP_PROBE_PERSON_ID,
        'person_id' => OMOP_PROBE_PERSON_ID,
        'procedure_concept_id' => 4001,
        'procedure_date' => '2024-03-01',
        'procedure_datetime' => '2024-03-01 10:00:00',
        'procedure_type_concept_id' => 32817,
        'quantity' => null,
        'visit_occurrence_id' => null,
        'procedure_source_value' => '1234',
        'procedure_source_concept_id' => 0,
    ]);
});
