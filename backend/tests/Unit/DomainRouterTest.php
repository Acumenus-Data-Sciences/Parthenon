<?php

use App\Services\Ingestion\DomainRouterService;

describe('DomainRouterService', function () {

    beforeEach(function () {
        $this->router = new DomainRouterService;
    });

    it('routes Condition domain to condition_occurrence table', function () {
        expect($this->router->getTable('Condition'))->toBe('condition_occurrence');
    });

    it('routes Drug domain to drug_exposure table', function () {
        expect($this->router->getTable('Drug'))->toBe('drug_exposure');
    });

    it('routes Procedure domain to procedure_occurrence table', function () {
        expect($this->router->getTable('Procedure'))->toBe('procedure_occurrence');
    });

    it('routes Measurement domain to measurement table', function () {
        expect($this->router->getTable('Measurement'))->toBe('measurement');
    });

    it('routes Observation domain to observation table', function () {
        expect($this->router->getTable('Observation'))->toBe('observation');
    });

    it('returns null for unknown domain', function () {
        expect($this->router->getTable('UnknownDomain'))->toBeNull();
    });
});
