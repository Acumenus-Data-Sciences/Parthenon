<?php

use App\Models\App\ConceptSet;
use App\Models\App\ConceptSetItem;
use App\Services\ConceptSet\ConceptSetResolverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

describe('ConceptSetResolverService::resolve', function () {

    beforeEach(function () {
        $this->service = new ConceptSetResolverService;
    });

    it('returns only included direct concept IDs when no descendants or mapped flags are set', function () {
        $set = ConceptSet::factory()->create();
        $set->items()->create([
            'concept_id' => 4001,
            'is_excluded' => false,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);
        $set->items()->create([
            'concept_id' => 4002,
            'is_excluded' => false,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);

        $resolved = $this->service->resolve($set->fresh());

        expect($resolved)->toBeArray()
            ->and($resolved)->toHaveCount(2)
            ->and($resolved)->toContain(4001)
            ->and($resolved)->toContain(4002);
    });

    it('subtracts excluded concept IDs from the included set', function () {
        $set = ConceptSet::factory()->create();
        $set->items()->create([
            'concept_id' => 101,
            'is_excluded' => false,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);
        $set->items()->create([
            'concept_id' => 102,
            'is_excluded' => false,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);
        $set->items()->create([
            'concept_id' => 102,
            'is_excluded' => true,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);

        $resolved = $this->service->resolve($set->fresh());

        expect($resolved)->toHaveCount(1)
            ->and($resolved)->toContain(101)
            ->and($resolved)->not->toContain(102);
    });

    it('returns an empty array when all items are excluded', function () {
        $set = ConceptSet::factory()->create();
        $set->items()->create([
            'concept_id' => 555,
            'is_excluded' => true,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);

        $resolved = $this->service->resolve($set->fresh());

        expect($resolved)->toBeArray()->toBeEmpty();
    });

    it('deduplicates repeated direct concept IDs', function () {
        $set = ConceptSet::factory()->create();
        $set->items()->create([
            'concept_id' => 77,
            'is_excluded' => false,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);
        $set->items()->create([
            'concept_id' => 77,
            'is_excluded' => false,
            'include_descendants' => false,
            'include_mapped' => false,
        ]);

        $resolved = $this->service->resolve($set->fresh());

        expect($resolved)->toHaveCount(1)
            ->and($resolved)->toContain(77);
    });
});

describe('ConceptSetResolverService::resolveToSql', function () {

    beforeEach(function () {
        $this->service = new ConceptSetResolverService;
    });

    it('returns a no-row SQL for an empty included item list', function () {
        $items = new Collection;

        $sql = $this->service->resolveToSql($items, 'vocab');

        expect($sql)->toBeString()
            ->and($sql)->toContain('SELECT NULL::integer AS concept_id WHERE false');
    });

    it('emits a direct concept_id SELECT against the given vocab schema', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 201826,
                'is_excluded' => false,
                'include_descendants' => false,
                'include_mapped' => false,
            ]),
            new ConceptSetItem([
                'concept_id' => 201820,
                'is_excluded' => false,
                'include_descendants' => false,
                'include_mapped' => false,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'vocab');

        // OMOP CDM v5.4 vocabulary tables are singular (concept, not concepts).
        // Regression guard: never emit the plural form — it matches no real table.
        expect($sql)->toContain('FROM vocab.concept ')
            ->and($sql)->not->toContain('vocab.concepts')
            ->and($sql)->toContain('201826')
            ->and($sql)->toContain('201820')
            ->and($sql)->toContain('SELECT DISTINCT concept_id');
    });

    it('adds a UNION ALL for descendant expansion when include_descendants is true', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 44054006,
                'is_excluded' => false,
                'include_descendants' => true,
                'include_mapped' => false,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'vocab');

        // OMOP CDM v5.4: table is `concept_ancestor` (singular).
        expect($sql)->toContain('UNION ALL')
            ->and($sql)->toContain('vocab.concept_ancestor ')
            ->and($sql)->not->toContain('vocab.concept_ancestors')
            ->and($sql)->toContain('ancestor_concept_id IN (44054006)');
    });

    it('adds a UNION ALL for Maps to expansion when include_mapped is true', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 12345,
                'is_excluded' => false,
                'include_descendants' => false,
                'include_mapped' => true,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'vocab');

        // OMOP CDM v5.4: table is `concept_relationship` (singular).
        expect($sql)->toContain('UNION ALL')
            ->and($sql)->toContain('vocab.concept_relationship ')
            ->and($sql)->not->toContain('vocab.concept_relationships')
            ->and($sql)->toContain("relationship_id = 'Maps to'")
            ->and($sql)->toContain('concept_id_1 IN (12345)');
    });

    it('appends a NOT IN clause for excluded items', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 10,
                'is_excluded' => false,
                'include_descendants' => false,
                'include_mapped' => false,
            ]),
            new ConceptSetItem([
                'concept_id' => 20,
                'is_excluded' => true,
                'include_descendants' => false,
                'include_mapped' => false,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'vocab');

        expect($sql)->toContain('WHERE concept_id NOT IN')
            ->and($sql)->toContain('20');
    });
});
