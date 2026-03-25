<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use App\Services\Ares\UnmappedCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnmappedCodeServiceTest extends TestCase
{
    use RefreshDatabase;

    private UnmappedCodeService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(UnmappedCodeService::class);
    }

    public function test_get_summary_groups_by_table_and_field(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'ICD10-Z99',
            'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence',
            'cdm_field' => 'condition_source_value',
            'record_count' => 150,
            'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'NDC-123',
            'source_vocabulary_id' => 'NDC',
            'cdm_table' => 'drug_exposure',
            'cdm_field' => 'drug_source_value',
            'record_count' => 75,
            'created_at' => now(),
        ]);

        $summary = $this->service->getSummary($source, $release);

        $this->assertCount(2, $summary);
        $condition = collect($summary)->firstWhere('cdm_table', 'condition_occurrence');
        $this->assertEquals(150, $condition->total_records);
        $this->assertEquals(1, $condition->code_count);
    }

    public function test_get_details_returns_paginated_results(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        for ($i = 0; $i < 25; $i++) {
            UnmappedSourceCode::create([
                'source_id' => $source->id,
                'release_id' => $release->id,
                'source_code' => "CODE-{$i}",
                'source_vocabulary_id' => 'ICD10CM',
                'cdm_table' => 'condition_occurrence',
                'cdm_field' => 'condition_source_value',
                'record_count' => 100 - $i,
                'created_at' => now(),
            ]);
        }

        $page1 = $this->service->getDetails($source, $release, [], 1, 10);

        $this->assertEquals(25, $page1->total());
        $this->assertCount(10, $page1->items());
    }

    public function test_get_details_filters_by_table(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'A1',
            'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence',
            'cdm_field' => 'condition_source_value',
            'record_count' => 50,
            'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'B1',
            'source_vocabulary_id' => 'NDC',
            'cdm_table' => 'drug_exposure',
            'cdm_field' => 'drug_source_value',
            'record_count' => 30,
            'created_at' => now(),
        ]);

        $filtered = $this->service->getDetails($source, $release, ['table' => 'condition_occurrence']);

        $this->assertEquals(1, $filtered->total());
    }

    public function test_get_network_summary_aggregates_across_sources(): void
    {
        $source1 = Source::factory()->create();
        $source2 = Source::factory()->create();
        $r1 = SourceRelease::factory()->create(['source_id' => $source1->id]);
        $r2 = SourceRelease::factory()->create(['source_id' => $source2->id]);

        UnmappedSourceCode::create([
            'source_id' => $source1->id, 'release_id' => $r1->id,
            'source_code' => 'A1', 'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence', 'cdm_field' => 'condition_source_value',
            'record_count' => 100, 'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source2->id, 'release_id' => $r2->id,
            'source_code' => 'B1', 'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence', 'cdm_field' => 'condition_source_value',
            'record_count' => 200, 'created_at' => now(),
        ]);

        $summary = $this->service->getNetworkSummary();

        $condition = collect($summary)->firstWhere('cdm_table', 'condition_occurrence');
        $this->assertEquals(300, $condition->total_records);
        $this->assertEquals(2, $condition->code_count);
    }

    public function test_get_total_unmapped_count(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        UnmappedSourceCode::create([
            'source_id' => $source->id, 'release_id' => $release->id,
            'source_code' => 'X1', 'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence', 'cdm_field' => 'condition_source_value',
            'record_count' => 10, 'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source->id, 'release_id' => $release->id,
            'source_code' => 'X2', 'source_vocabulary_id' => 'NDC',
            'cdm_table' => 'drug_exposure', 'cdm_field' => 'drug_source_value',
            'record_count' => 20, 'created_at' => now(),
        ]);

        $count = $this->service->getTotalUnmappedCount();

        $this->assertEquals(2, $count);
    }
}
