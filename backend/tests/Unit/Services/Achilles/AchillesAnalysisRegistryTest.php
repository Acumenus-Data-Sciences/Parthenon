<?php

use App\Contracts\AchillesAnalysisInterface;
use App\Services\Achilles\AchillesAnalysisRegistry;

describe('AchillesAnalysisRegistry', function () {

    beforeEach(function () {
        $this->registry = new AchillesAnalysisRegistry;
    });

    /**
     * Helper: create a mock analysis with the given ID and category.
     */
    function makeAnalysis(int $id, string $category = 'Person'): AchillesAnalysisInterface
    {
        $analysis = Mockery::mock(AchillesAnalysisInterface::class);
        $analysis->shouldReceive('analysisId')->andReturn($id);
        $analysis->shouldReceive('category')->andReturn($category);

        return $analysis;
    }

    it('registers and retrieves analyses by ID', function () {
        $analysis = makeAnalysis(0);
        $this->registry->register($analysis);

        $retrieved = $this->registry->get(0);

        expect($retrieved)->toBe($analysis)
            ->and($retrieved->analysisId())->toBe(0);
    });

    it('returns all registered analyses', function () {
        $a1 = makeAnalysis(0);
        $a2 = makeAnalysis(2);
        $a3 = makeAnalysis(400, 'Condition');

        $this->registry->register($a1);
        $this->registry->register($a2);
        $this->registry->register($a3);

        $all = $this->registry->all();

        expect($all)->toHaveCount(3)
            ->and($all[0])->toBe($a1)
            ->and($all[2])->toBe($a2)
            ->and($all[400])->toBe($a3);
    });

    it('filters analyses by category', function () {
        $personA = makeAnalysis(0, 'Person');
        $personB = makeAnalysis(2, 'Person');
        $condition = makeAnalysis(400, 'Condition');
        $visit = makeAnalysis(200, 'Visit');

        $this->registry->register($personA);
        $this->registry->register($personB);
        $this->registry->register($condition);
        $this->registry->register($visit);

        $personAnalyses = $this->registry->byCategory('Person');
        $conditionAnalyses = $this->registry->byCategory('Condition');

        expect($personAnalyses)->toHaveCount(2)
            ->and($conditionAnalyses)->toHaveCount(1)
            ->and(array_keys($personAnalyses))->toBe([0, 2])
            ->and(array_keys($conditionAnalyses))->toBe([400]);
    });

    it('returns unique category names', function () {
        $this->registry->register(makeAnalysis(0, 'Person'));
        $this->registry->register(makeAnalysis(2, 'Person'));
        $this->registry->register(makeAnalysis(400, 'Condition'));
        $this->registry->register(makeAnalysis(200, 'Visit'));

        $categories = $this->registry->categories();

        expect($categories)->toHaveCount(3)
            ->and($categories)->toContain('Person')
            ->and($categories)->toContain('Condition')
            ->and($categories)->toContain('Visit');
    });

    it('returns null for unknown analysis ID', function () {
        $this->registry->register(makeAnalysis(0));

        expect($this->registry->get(999))->toBeNull()
            ->and($this->registry->get(-1))->toBeNull();
    });

    it('counts registered analyses', function () {
        expect($this->registry->count())->toBe(0);

        $this->registry->register(makeAnalysis(0));
        expect($this->registry->count())->toBe(1);

        $this->registry->register(makeAnalysis(2));
        expect($this->registry->count())->toBe(2);

        $this->registry->register(makeAnalysis(400, 'Condition'));
        expect($this->registry->count())->toBe(3);
    });
});
