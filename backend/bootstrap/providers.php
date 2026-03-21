<?php

use App\Providers\AchillesServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\ClinicalCoherenceServiceProvider;
use App\Providers\DataQualityServiceProvider;
use App\Providers\NetworkAnalysisServiceProvider;
use App\Providers\PopulationCharacterizationServiceProvider;
use App\Providers\PopulationRiskServiceProvider;
use App\Providers\SolrServiceProvider;

return [
    AppServiceProvider::class,
    AchillesServiceProvider::class,
    ClinicalCoherenceServiceProvider::class,
    DataQualityServiceProvider::class,
    PopulationRiskServiceProvider::class,
    NetworkAnalysisServiceProvider::class,
    PopulationCharacterizationServiceProvider::class,
    SolrServiceProvider::class,
];
