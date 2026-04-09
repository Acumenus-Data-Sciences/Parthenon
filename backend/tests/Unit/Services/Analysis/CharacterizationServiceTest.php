<?php

use App\Services\Analysis\CharacterizationService;
use App\Services\SqlRenderer\SqlRendererService;

describe('CharacterizationService::getAvailableFeatures', function () {

    beforeEach(function () {
        $this->service = new CharacterizationService(new SqlRendererService);
    });

    it('returns a list with both key and label for every registered feature builder', function () {
        $features = $this->service->getAvailableFeatures();

        expect($features)->toBeArray()
            ->and($features)->not->toBeEmpty();

        foreach ($features as $feature) {
            expect($feature)->toHaveKeys(['key', 'label'])
                ->and($feature['key'])->toBeString()->not->toBeEmpty()
                ->and($feature['label'])->toBeString()->not->toBeEmpty();
        }
    });

    it('registers the six built-in OHDSI feature categories', function () {
        $keys = array_column($this->service->getAvailableFeatures(), 'key');

        expect($keys)->toContain('demographics')
            ->and($keys)->toContain('conditions')
            ->and($keys)->toContain('drugs')
            ->and($keys)->toContain('procedures')
            ->and($keys)->toContain('measurements')
            ->and($keys)->toContain('visits')
            ->and($keys)->toHaveCount(6);
    });

    it('returns human-readable labels for every feature key', function () {
        $features = $this->service->getAvailableFeatures();
        $byKey = array_column($features, 'label', 'key');

        expect($byKey['demographics'])->toBe('Demographics')
            ->and($byKey['conditions'])->toBe('Conditions');
    });
});
