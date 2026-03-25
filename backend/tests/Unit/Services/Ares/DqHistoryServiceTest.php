<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Models\App\SourceRelease;
use App\Services\Ares\DqHistoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DqHistoryServiceTest extends TestCase
{
    use RefreshDatabase;

    private DqHistoryService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(DqHistoryService::class);
    }

    public function test_compute_deltas_first_release_all_new(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create([
            'source_id' => $source->id,
            'release_type' => 'snapshot',
        ]);

        // Create DQD results linked to this release
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'check_id' => 'check_001',
            'passed' => false,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'check_id' => 'check_002',
            'passed' => true,
        ]);

        $this->service->computeDeltas($release);

        // First release: failed checks are NEW, passed checks are STABLE
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $release->id,
            'check_id' => 'check_001',
            'delta_status' => 'new',
            'current_passed' => false,
        ]);
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $release->id,
            'check_id' => 'check_002',
            'delta_status' => 'stable',
            'current_passed' => true,
        ]);
    }

    public function test_compute_deltas_with_previous_release(): void
    {
        $source = Source::factory()->create();

        $prev = SourceRelease::factory()->create([
            'source_id' => $source->id,
            'created_at' => now()->subDay(),
        ]);
        $current = SourceRelease::factory()->create([
            'source_id' => $source->id,
            'created_at' => now(),
        ]);

        // Previous release: check_001 failed, check_002 passed, check_003 failed
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $prev->id, 'check_id' => 'check_001', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $prev->id, 'check_id' => 'check_002', 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $prev->id, 'check_id' => 'check_003', 'passed' => false]);

        // Current release: check_001 still fails (existing), check_002 now fails (new), check_003 now passes (resolved)
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $current->id, 'check_id' => 'check_001', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $current->id, 'check_id' => 'check_002', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $current->id, 'check_id' => 'check_003', 'passed' => true]);

        $this->service->computeDeltas($current);

        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $current->id,
            'check_id' => 'check_001',
            'delta_status' => 'existing',
        ]);
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $current->id,
            'check_id' => 'check_002',
            'delta_status' => 'new',
        ]);
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $current->id,
            'check_id' => 'check_003',
            'delta_status' => 'resolved',
        ]);
    }

    public function test_get_trends_returns_pass_rates_per_release(): void
    {
        $source = Source::factory()->create();

        $r1 = SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()->subDays(2)]);
        $r2 = SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()]);

        // Release 1: 3 passed, 1 failed = 75%
        DqdResult::factory()->count(3)->create(['source_id' => $source->id, 'release_id' => $r1->id, 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $r1->id, 'passed' => false]);

        // Release 2: 4 passed, 1 failed = 80%
        DqdResult::factory()->count(4)->create(['source_id' => $source->id, 'release_id' => $r2->id, 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $r2->id, 'passed' => false]);

        $trends = $this->service->getTrends($source);

        $this->assertCount(2, $trends);
        $this->assertEquals(75.0, $trends[0]['pass_rate']);
        $this->assertEquals(80.0, $trends[1]['pass_rate']);
    }

    public function test_get_category_trends_groups_by_category(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'category' => 'Completeness', 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'category' => 'Completeness', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'category' => 'Conformance', 'passed' => true]);

        $trends = $this->service->getCategoryTrends($source);

        $this->assertArrayHasKey('Completeness', $trends[0]['categories']);
        $this->assertArrayHasKey('Conformance', $trends[0]['categories']);
        $this->assertEquals(50.0, $trends[0]['categories']['Completeness']);
        $this->assertEquals(100.0, $trends[0]['categories']['Conformance']);
    }

    public function test_get_domain_trends_groups_by_cdm_table(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'cdm_table' => 'person', 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'cdm_table' => 'person', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'cdm_table' => 'condition_occurrence', 'passed' => true]);

        $trends = $this->service->getDomainTrends($source);

        $this->assertArrayHasKey('person', $trends[0]['domains']);
        $this->assertEquals(50.0, $trends[0]['domains']['person']);
        $this->assertEquals(100.0, $trends[0]['domains']['condition_occurrence']);
    }

    public function test_get_network_dq_summary_returns_per_source_scores(): void
    {
        $source1 = Source::factory()->create(['source_name' => 'Source A']);
        $source2 = Source::factory()->create(['source_name' => 'Source B']);

        // getNetworkDqSummary uses whereHas('daimons'), so create daimons
        SourceDaimon::create(['source_id' => $source1->id, 'daimon_type' => 'cdm', 'table_qualifier' => 'omop', 'priority' => 1]);
        SourceDaimon::create(['source_id' => $source2->id, 'daimon_type' => 'cdm', 'table_qualifier' => 'omop', 'priority' => 1]);

        $r1 = SourceRelease::factory()->create(['source_id' => $source1->id]);
        $r2 = SourceRelease::factory()->create(['source_id' => $source2->id]);

        DqdResult::factory()->count(9)->create(['source_id' => $source1->id, 'release_id' => $r1->id, 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source1->id, 'release_id' => $r1->id, 'passed' => false]);
        DqdResult::factory()->count(8)->create(['source_id' => $source2->id, 'release_id' => $r2->id, 'passed' => true]);
        DqdResult::factory()->count(2)->create(['source_id' => $source2->id, 'release_id' => $r2->id, 'passed' => false]);

        $summary = $this->service->getNetworkDqSummary();

        $this->assertCount(2, $summary);
        // Source A: 90%, Source B: 80%
        $sourceA = collect($summary)->firstWhere('source_name', 'Source A');
        $this->assertEquals(90.0, $sourceA['pass_rate']);
    }

    public function test_compute_deltas_is_idempotent(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        DqdResult::factory()->create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'check_id' => 'check_001',
            'passed' => false,
        ]);

        $this->service->computeDeltas($release);
        $this->service->computeDeltas($release);

        // Should not duplicate — only 1 delta row per check per release
        $this->assertEquals(1, DB::table('dqd_deltas')
            ->where('current_release_id', $release->id)
            ->where('check_id', 'check_001')
            ->count());
    }
}
