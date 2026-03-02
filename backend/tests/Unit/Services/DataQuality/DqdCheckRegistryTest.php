<?php

use App\Contracts\DqdCheckInterface;
use App\Services\Dqd\DqdCheckRegistry;

describe('DqdCheckRegistry', function () {

    beforeEach(function () {
        $this->registry = new DqdCheckRegistry;
    });

    /**
     * Helper: create a mock DQD check.
     */
    function makeDqdCheck(string $id, string $category = 'completeness', string $table = 'person'): DqdCheckInterface
    {
        $check = Mockery::mock(DqdCheckInterface::class);
        $check->shouldReceive('checkId')->andReturn($id);
        $check->shouldReceive('category')->andReturn($category);
        $check->shouldReceive('cdmTable')->andReturn($table);

        return $check;
    }

    it('registers and retrieves checks by ID', function () {
        $check = makeDqdCheck('completeness_required_person_person_id');
        $this->registry->register($check);

        $retrieved = $this->registry->get('completeness_required_person_person_id');

        expect($retrieved)->toBe($check)
            ->and($retrieved->checkId())->toBe('completeness_required_person_person_id');
    });

    it('filters checks by category', function () {
        $comp1 = makeDqdCheck('c1', 'completeness', 'person');
        $comp2 = makeDqdCheck('c2', 'completeness', 'visit_occurrence');
        $conf1 = makeDqdCheck('cf1', 'conformance', 'person');
        $plaus1 = makeDqdCheck('p1', 'plausibility', 'measurement');

        $this->registry->register($comp1);
        $this->registry->register($comp2);
        $this->registry->register($conf1);
        $this->registry->register($plaus1);

        $completeness = $this->registry->byCategory('completeness');
        $conformance = $this->registry->byCategory('conformance');
        $plausibility = $this->registry->byCategory('plausibility');

        expect($completeness)->toHaveCount(2)
            ->and($conformance)->toHaveCount(1)
            ->and($plausibility)->toHaveCount(1);
    });

    it('filters checks by table', function () {
        $c1 = makeDqdCheck('c1', 'completeness', 'person');
        $c2 = makeDqdCheck('c2', 'completeness', 'person');
        $c3 = makeDqdCheck('c3', 'conformance', 'condition_occurrence');
        $c4 = makeDqdCheck('c4', 'plausibility', 'drug_exposure');

        $this->registry->register($c1);
        $this->registry->register($c2);
        $this->registry->register($c3);
        $this->registry->register($c4);

        $personChecks = $this->registry->byTable('person');
        $conditionChecks = $this->registry->byTable('condition_occurrence');
        $drugChecks = $this->registry->byTable('drug_exposure');

        expect($personChecks)->toHaveCount(2)
            ->and($conditionChecks)->toHaveCount(1)
            ->and($drugChecks)->toHaveCount(1);
    });

    it('returns unique category names', function () {
        $this->registry->register(makeDqdCheck('c1', 'completeness', 'person'));
        $this->registry->register(makeDqdCheck('c2', 'completeness', 'visit_occurrence'));
        $this->registry->register(makeDqdCheck('cf1', 'conformance', 'person'));
        $this->registry->register(makeDqdCheck('p1', 'plausibility', 'measurement'));

        $categories = $this->registry->categories();

        expect($categories)->toHaveCount(3)
            ->and($categories)->toContain('completeness')
            ->and($categories)->toContain('conformance')
            ->and($categories)->toContain('plausibility');
    });

    it('returns unique table names', function () {
        $this->registry->register(makeDqdCheck('c1', 'completeness', 'person'));
        $this->registry->register(makeDqdCheck('c2', 'completeness', 'person'));
        $this->registry->register(makeDqdCheck('c3', 'conformance', 'condition_occurrence'));
        $this->registry->register(makeDqdCheck('c4', 'plausibility', 'drug_exposure'));
        $this->registry->register(makeDqdCheck('c5', 'plausibility', 'person'));

        $tables = $this->registry->tables();

        expect($tables)->toHaveCount(3)
            ->and($tables)->toContain('person')
            ->and($tables)->toContain('condition_occurrence')
            ->and($tables)->toContain('drug_exposure');
    });

    it('counts registered checks', function () {
        expect($this->registry->count())->toBe(0);

        $this->registry->register(makeDqdCheck('c1'));
        expect($this->registry->count())->toBe(1);

        $this->registry->register(makeDqdCheck('c2'));
        expect($this->registry->count())->toBe(2);

        $this->registry->register(makeDqdCheck('c3', 'conformance'));
        expect($this->registry->count())->toBe(3);
    });
});
