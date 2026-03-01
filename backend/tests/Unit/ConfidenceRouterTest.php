<?php

use App\Models\App\IngestionJob;
use App\Services\Ingestion\ConfidenceRouterService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\HasMany;

describe('ConfidenceRouterService', function () {

    beforeEach(function () {
        $this->router = new ConfidenceRouterService;
    });

    /**
     * Helper: build a mock mapping with candidates at specified scores.
     *
     * Each mapping is a mock that tracks what was passed to its update() call.
     */
    function makeMockMapping(array $candidateScores): object
    {
        // Build candidate objects as simple stdClass with score, target_concept_id, strategy
        $candidates = collect(array_map(function (float $score) {
            $c = new stdClass;
            $c->score = $score;
            $c->target_concept_id = rand(1000, 9999);
            $c->strategy = 'fuzzy_match';

            return $c;
        }, $candidateScores));

        $mapping = Mockery::mock();
        $mapping->candidates = $candidates;
        $mapping->shouldReceive('update')->once()->andReturnTrue();

        return $mapping;
    }

    /**
     * Helper: create a mock IngestionJob whose conceptMappings()
     * returns the given collection of mock mappings.
     */
    function makeMockJob(Collection $mappings): IngestionJob
    {
        $relation = Mockery::mock(HasMany::class);
        $relation->shouldReceive('with')->with('candidates')->andReturnSelf();
        $relation->shouldReceive('get')->andReturn($mappings);

        $job = Mockery::mock(IngestionJob::class);
        $job->shouldReceive('conceptMappings')->andReturn($relation);

        return $job;
    }

    it('auto-accepts mappings with confidence >= 0.95', function () {
        $mapping = makeMockMapping([0.97, 0.80, 0.50]);
        $mappings = new Collection([$mapping]);
        $job = makeMockJob($mappings);

        $counts = $this->router->routeMappings($job);

        expect($counts['auto_accepted'])->toBe(1)
            ->and($counts['quick_review'])->toBe(0)
            ->and($counts['full_review'])->toBe(0)
            ->and($counts['unmappable'])->toBe(0);
    });

    it('routes to quick_review for confidence between 0.70 and 0.95', function () {
        $mapping = makeMockMapping([0.85, 0.60]);
        $mappings = new Collection([$mapping]);
        $job = makeMockJob($mappings);

        $counts = $this->router->routeMappings($job);

        expect($counts['quick_review'])->toBe(1)
            ->and($counts['auto_accepted'])->toBe(0);
    });

    it('routes to full_review for confidence below 0.70', function () {
        $mapping = makeMockMapping([0.45, 0.30]);
        $mappings = new Collection([$mapping]);
        $job = makeMockJob($mappings);

        $counts = $this->router->routeMappings($job);

        expect($counts['full_review'])->toBe(1)
            ->and($counts['quick_review'])->toBe(0)
            ->and($counts['auto_accepted'])->toBe(0);
    });

    it('routes to unmappable when no candidates exist', function () {
        // Empty candidates collection
        $candidates = collect([]);

        $mapping = Mockery::mock();
        $mapping->candidates = $candidates;
        $mapping->shouldReceive('update')->once()->andReturnTrue();

        $mappings = new Collection([$mapping]);
        $job = makeMockJob($mappings);

        $counts = $this->router->routeMappings($job);

        expect($counts['unmappable'])->toBe(1)
            ->and($counts['auto_accepted'])->toBe(0)
            ->and($counts['quick_review'])->toBe(0)
            ->and($counts['full_review'])->toBe(0);
    });

    it('returns correct counts per tier for mixed mappings', function () {
        $autoMapping = makeMockMapping([0.98]);          // auto_accepted
        $quickMapping = makeMockMapping([0.82, 0.70]);   // quick_review
        $fullMapping = makeMockMapping([0.55]);           // full_review

        // Unmappable: no candidates
        $unmappableMapping = Mockery::mock();
        $unmappableMapping->candidates = collect([]);
        $unmappableMapping->shouldReceive('update')->once()->andReturnTrue();

        $mappings = new Collection([
            $autoMapping,
            $quickMapping,
            $fullMapping,
            $unmappableMapping,
        ]);
        $job = makeMockJob($mappings);

        $counts = $this->router->routeMappings($job);

        expect($counts['auto_accepted'])->toBe(1)
            ->and($counts['quick_review'])->toBe(1)
            ->and($counts['full_review'])->toBe(1)
            ->and($counts['unmappable'])->toBe(1)
            ->and($counts['total'])->toBe(4);
    });
});
