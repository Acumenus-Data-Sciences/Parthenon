<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Context\SourceContext;
use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Services\Fhir\FhirDedupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Real-DB coverage for FhirDedupService::deleteByResource (Phase 5 soft-delete).
 *
 * RefreshDatabase migrates fhir_dedup_tracking (incl. the new deleted_at /
 * deleted_reason columns) into parthenon_testing. A SourceContext is bound so
 * the service's cdm() helper resolves the `ctx_cdm` connection at the `omop`
 * schema *inside parthenon_testing* — never the host/prod omop. The fixture
 * note row lives under a high sentinel id that can never collide with real data
 * and is cleaned up in afterEach.
 *
 * The whole file skips gracefully if the omop schema is unwritable/absent
 * (read-only CI), mirroring CdmModelTest / FhirCrossSchemaExtensionTest.
 */
class FhirDedupSoftDeleteTest extends TestCase
{
    use RefreshDatabase;

    private const SENTINEL_PERSON_ID = 999000003;

    private const SENTINEL_NOTE_ID = 999000003;

    private const SITE_KEY = 'test-soft-delete';

    private FhirDedupService $dedup;

    private bool $omopWritable = false;

    private bool $softDeleteColumnsPresent = false;

    protected function setUp(): void
    {
        parent::setUp();

        // Bind a SourceContext whose ctx_cdm points at pgsql_testing
        // (parthenon_testing) with the omop schema in its search_path.
        $source = Source::factory()->create([
            'source_connection' => 'pgsql_testing',
        ]);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => DaimonType::CDM->value,
            'table_qualifier' => 'omop',
        ]);
        SourceDaimon::factory()->create([
            'source_id' => $source->id,
            'daimon_type' => DaimonType::Vocabulary->value,
            'table_qualifier' => 'vocab',
        ]);
        SourceContext::forSource($source);

        $this->dedup = app(FhirDedupService::class);

        // The Phase 5 soft-delete migration adds deleted_at/deleted_reason to
        // fhir_dedup_tracking. The local parthenon_testing DB is pre-migrated
        // out-of-band; if those columns are not yet present (migration not yet
        // run against this test DB), skip rather than fail — the assertions are
        // still meaningful once the column lands.
        $this->softDeleteColumnsPresent = Schema::connection('pgsql_testing')
            ->hasColumn('fhir_dedup_tracking', 'deleted_at');

        // Probe omop writability via a rolled-back insert through ctx_cdm.
        try {
            DB::connection('ctx_cdm')->transaction(function () {
                DB::connection('ctx_cdm')->table('note')->insert($this->noteRow());
                throw new \RuntimeException('__rollback__');
            });
        } catch (\Throwable $e) {
            if ($e->getMessage() === '__rollback__') {
                $this->omopWritable = true;
            }
        }

        if ($this->omopWritable) {
            $this->cleanupFixtures();
        }
    }

    protected function tearDown(): void
    {
        if ($this->omopWritable) {
            $this->cleanupFixtures();
        }
        parent::tearDown();
    }

    /** @return array<string, mixed> */
    private function noteRow(): array
    {
        return [
            'note_id' => self::SENTINEL_NOTE_ID,
            'person_id' => self::SENTINEL_PERSON_ID,
            'note_date' => '2026-01-01',
            'note_type_concept_id' => 32817,
            'note_class_concept_id' => 0,
            'note_text' => 'Soft-delete fixture.',
            'encoding_concept_id' => 32678,
            'language_concept_id' => 4180186,
            'note_event_field_concept_id' => 0,
            'note_source_value' => 'fhir-softdelete-probe',
        ];
    }

    private function cleanupFixtures(): void
    {
        try {
            DB::connection('ctx_cdm')->table('note')
                ->where('note_id', self::SENTINEL_NOTE_ID)->delete();
        } catch (\Throwable) {
            // best-effort
        }
        // Tracking rows roll back with the pgsql_testing transaction, but be
        // explicit in case a non-transacted path leaks one.
        DB::table('fhir_dedup_tracking')->where('site_key', self::SITE_KEY)->delete();
    }

    public function test_delete_by_resource_removes_cdm_row_and_stamps_tracking(): void
    {
        if (! $this->softDeleteColumnsPresent) {
            $this->markTestSkipped('fhir_dedup_tracking.deleted_at not yet migrated on this test DB.');
        }
        if (! $this->omopWritable) {
            $this->markTestSkipped('omop schema not writable/absent in this environment.');
        }

        // Insert a real CDM note row and capture its PK.
        DB::connection('ctx_cdm')->table('note')->insert($this->noteRow());

        // Track it pointing at the real CDM row.
        DB::table('fhir_dedup_tracking')->insert([
            'site_key' => self::SITE_KEY,
            'fhir_resource_type' => 'DocumentReference',
            'fhir_resource_id' => 'doc-1',
            'cdm_table' => 'note',
            'cdm_row_id' => self::SENTINEL_NOTE_ID,
            'content_hash' => str_repeat('a', 64),
            'last_synced_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = $this->dedup->deleteByResource(
            self::SITE_KEY,
            'DocumentReference',
            'doc-1',
            'entered-in-error',
        );

        expect($result['resolved'])->toBeTrue();
        expect($result['deleted'])->toBeTrue();
        expect($result['cdm_table'])->toBe('note');
        expect($result['cdm_row_id'])->toBe(self::SENTINEL_NOTE_ID);
        expect($result['reason'])->toBe('entered-in-error');

        // The CDM row is gone.
        $exists = DB::connection('ctx_cdm')->table('note')
            ->where('note_id', self::SENTINEL_NOTE_ID)->exists();
        expect($exists)->toBeFalse();

        // The tracking row's deleted_at is stamped and reason recorded.
        $tracking = DB::table('fhir_dedup_tracking')
            ->where('site_key', self::SITE_KEY)
            ->where('fhir_resource_type', 'DocumentReference')
            ->where('fhir_resource_id', 'doc-1')
            ->first();
        expect($tracking->deleted_at)->not->toBeNull();
        expect($tracking->deleted_reason)->toBe('entered-in-error');
    }

    public function test_delete_by_resource_unresolved_when_no_tracking_row(): void
    {
        $result = $this->dedup->deleteByResource(
            self::SITE_KEY,
            'Observation',
            'never-seen',
            'bulk-deleted',
        );

        expect($result['resolved'])->toBeFalse();
        expect($result['deleted'])->toBeFalse();
        expect($result['cdm_table'])->toBeNull();
        expect($result['reason'])->toBe('bulk-deleted');
    }

    public function test_delete_by_resource_stamps_but_unresolved_for_placeholder_row_id(): void
    {
        if (! $this->softDeleteColumnsPresent) {
            $this->markTestSkipped('fhir_dedup_tracking.deleted_at not yet migrated on this test DB.');
        }

        // Batch-inserted clinical resources record cdm_row_id = 0 (placeholder)
        // and cannot be pinpointed for deletion — audit-stamp only.
        DB::table('fhir_dedup_tracking')->insert([
            'site_key' => self::SITE_KEY,
            'fhir_resource_type' => 'Observation',
            'fhir_resource_id' => 'obs-batch',
            'cdm_table' => 'measurement',
            'cdm_row_id' => 0,
            'content_hash' => str_repeat('b', 64),
            'last_synced_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = $this->dedup->deleteByResource(
            self::SITE_KEY,
            'Observation',
            'obs-batch',
            'entered-in-error',
        );

        // Stamped for audit, but could not pinpoint the CDM row.
        expect($result['resolved'])->toBeFalse();
        expect($result['deleted'])->toBeFalse();

        $tracking = DB::table('fhir_dedup_tracking')
            ->where('site_key', self::SITE_KEY)
            ->where('fhir_resource_id', 'obs-batch')
            ->first();
        expect($tracking->deleted_at)->not->toBeNull();
        expect($tracking->deleted_reason)->toBe('entered-in-error');
    }
}
