<?php

use App\Models\App\ConceptSetItem;
use App\Services\ConceptSet\ConceptSetResolverService;

describe('ConceptSetResolverService — schema correctness audit', function () {

    beforeEach(function () {
        $this->service = new ConceptSetResolverService;
    });

    it('resolveToSql generates valid SQL with correct vocab schema', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 201826,
                'is_excluded' => false,
                'include_descendants' => true,
                'include_mapped' => true,
            ]),
            new ConceptSetItem([
                'concept_id' => 4329847,
                'is_excluded' => false,
                'include_descendants' => false,
                'include_mapped' => false,
            ]),
            new ConceptSetItem([
                'concept_id' => 99999,
                'is_excluded' => true,
                'include_descendants' => true,
                'include_mapped' => false,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'vocab');

        // Correct schema-qualified references
        expect($sql)->toContain('vocab.concept')
            ->and($sql)->toContain('vocab.concept_ancestor')
            ->and($sql)->toContain('vocab.concept_relationship');

        // Must NOT contain hardcoded omop schema for vocabulary tables
        expect($sql)->not->toContain('omop.concept_ancestor')
            ->and($sql)->not->toContain('omop.concept_relationship');

        // Exclusions generate NOT IN clause
        expect($sql)->toContain('NOT IN');
    });

    it('resolveToSql uses singular OMOP table names', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 1,
                'is_excluded' => false,
                'include_descendants' => true,
                'include_mapped' => true,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'vocab');

        // OMOP CDM v5.4 tables are always singular
        expect($sql)->not->toMatch('/\bconcepts\b/')
            ->and($sql)->not->toMatch('/\bconcept_ancestors\b/')
            ->and($sql)->not->toMatch('/\bconcept_relationships\b/');
    });

    it('resolveToSql with eunomia uses eunomia schema for vocab', function () {
        $items = collect([
            new ConceptSetItem([
                'concept_id' => 4329847,
                'is_excluded' => false,
                'include_descendants' => true,
                'include_mapped' => true,
            ]),
        ]);

        $sql = $this->service->resolveToSql($items, 'eunomia');

        // Eunomia bundles its own vocab — all references must use the eunomia schema
        expect($sql)->toContain('eunomia.concept_ancestor')
            ->and($sql)->toContain('eunomia.concept_relationship')
            ->and($sql)->toContain('eunomia.concept');

        // Must NOT fall back to the shared vocab schema
        expect($sql)->not->toContain('vocab.concept_ancestor')
            ->and($sql)->not->toContain('vocab.concept_relationship')
            ->and($sql)->not->toContain('vocab.concept ');
    });
});
