<?php

/**
 * OMOP Extension Bridge — read-path smoke tests.
 *
 * Validates that all bridge xref tables and OMOP extension tables
 * (image_occurrence, specimen, genomic_test, variant_occurrence,
 * variant_annotation) are queryable via their Eloquent models.
 *
 * These are READ-ONLY tests against live data — no RefreshDatabase.
 */

use App\Models\App\GenomicUploadOmopContextXref;
use App\Models\App\GenomicVariantOmopXref;
use App\Models\App\ImagingSeriesOmopXref;
use App\Models\App\OmopGenomicTestMap;
use Illuminate\Support\Facades\DB;

// ---------------------------------------------------------------------------
// Imaging bridge xref tables
// ---------------------------------------------------------------------------

it('can query imaging_series_omop_xref table', function () {
    $count = ImagingSeriesOmopXref::count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('imaging_series_omop_xref is empty — no rows to spot-check.');
    }

    $row = ImagingSeriesOmopXref::first();
    expect($row->series_id)->toBeInt()
        ->and($row->image_occurrence_id)->toBeInt()
        ->and($row->mapping_status)->toBeString();
});

it('can query imaging_procedure_omop_xref table', function () {
    $count = DB::connection('pgsql')->table('imaging_procedure_omop_xref')->count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('imaging_procedure_omop_xref is empty — no rows to spot-check.');
    }

    $row = DB::connection('pgsql')->table('imaging_procedure_omop_xref')->first();
    expect($row->study_id)->not->toBeNull()
        ->and($row->procedure_occurrence_id)->not->toBeNull();
});

// ---------------------------------------------------------------------------
// OMOP CDM extension tables (read via raw queries on the omop connection)
// ---------------------------------------------------------------------------

it('can query omop.image_occurrence', function () {
    if (! DB::connection('omop')->getSchemaBuilder()->hasTable('image_occurrence')) {
        $this->markTestSkipped('omop.image_occurrence table does not exist (CI environment).');
    }
    $count = DB::connection('omop')->table('image_occurrence')->count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('omop.image_occurrence is empty.');
    }

    $row = DB::connection('omop')->table('image_occurrence')->first();
    expect($row->image_occurrence_id)->not->toBeNull()
        ->and($row->person_id)->not->toBeNull();
});

it('can query omop.specimen', function () {
    if (! DB::connection('omop')->getSchemaBuilder()->hasTable('specimen')) {
        $this->markTestSkipped('omop.specimen table does not exist (CI environment).');
    }
    $count = DB::connection('omop')->table('specimen')->count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('omop.specimen is empty.');
    }

    $row = DB::connection('omop')->table('specimen')->first();
    expect($row->specimen_id)->not->toBeNull()
        ->and($row->person_id)->not->toBeNull();
});

it('can query omop.genomic_test', function () {
    if (! DB::connection('omop')->getSchemaBuilder()->hasTable('genomic_test')) {
        $this->markTestSkipped('omop.genomic_test table does not exist (CI environment).');
    }
    $count = DB::connection('omop')->table('genomic_test')->count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('omop.genomic_test is empty.');
    }

    $row = DB::connection('omop')->table('genomic_test')->first();
    expect($row->genomic_test_id)->not->toBeNull()
        ->and($row->care_site_id)->not->toBeNull();
});

it('can query omop.variant_occurrence', function () {
    if (! DB::connection('omop')->getSchemaBuilder()->hasTable('variant_occurrence')) {
        $this->markTestSkipped('omop.variant_occurrence table does not exist (CI environment).');
    }
    $count = DB::connection('omop')->table('variant_occurrence')->count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('omop.variant_occurrence is empty.');
    }

    $row = DB::connection('omop')->table('variant_occurrence')->first();
    expect($row->variant_occurrence_id)->not->toBeNull()
        ->and($row->procedure_occurrence_id)->not->toBeNull();
});

it('can query omop.variant_annotation', function () {
    if (! DB::connection('omop')->getSchemaBuilder()->hasTable('variant_annotation')) {
        $this->markTestSkipped('omop.variant_annotation table does not exist (CI environment).');
    }
    $count = DB::connection('omop')->table('variant_annotation')->count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('omop.variant_annotation is empty.');
    }

    $row = DB::connection('omop')->table('variant_annotation')->first();
    expect($row->variant_annotation_id)->not->toBeNull()
        ->and($row->variant_occurrence_id)->not->toBeNull();
});

// ---------------------------------------------------------------------------
// Genomic bridge xref tables
// ---------------------------------------------------------------------------

it('can query genomic_upload_omop_context_xref table', function () {
    $count = GenomicUploadOmopContextXref::count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('genomic_upload_omop_context_xref is empty.');
    }

    $row = GenomicUploadOmopContextXref::first();
    expect($row->upload_id)->toBeInt()
        ->and($row->mapping_status)->toBeString();
});

it('can query genomic_variant_omop_xref table', function () {
    $count = GenomicVariantOmopXref::count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('genomic_variant_omop_xref is empty.');
    }

    $row = GenomicVariantOmopXref::first();
    expect($row->variant_id)->toBeInt()
        ->and($row->variant_occurrence_id)->toBeInt()
        ->and($row->mapping_status)->toBeString();
});

it('can query omop_genomic_test_map table', function () {
    $count = OmopGenomicTestMap::count();
    expect($count)->toBeGreaterThanOrEqual(0);

    if ($count === 0) {
        $this->markTestSkipped('omop_genomic_test_map is empty.');
    }

    $row = OmopGenomicTestMap::first();
    expect($row->upload_id)->toBeInt()
        ->and($row->mapping_status)->toBeString();
});
