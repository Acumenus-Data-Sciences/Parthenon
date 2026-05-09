<?php

use App\Providers\AchillesServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\AuthDriverServiceProvider;
use App\Providers\ClinicalCoherenceServiceProvider;
use App\Providers\CryptoProviderServiceProvider;
use App\Providers\DataQualityServiceProvider;
use App\Providers\NetworkAnalysisServiceProvider;
use App\Providers\PopulationCharacterizationServiceProvider;
use App\Providers\PopulationRiskServiceProvider;
use App\Providers\SolrServiceProvider;
use App\Providers\TemplatesServiceProvider;
use App\Providers\TenancyServiceProvider;

return [
    AppServiceProvider::class,
    CryptoProviderServiceProvider::class,
    TenancyServiceProvider::class,
    AuthDriverServiceProvider::class,
    AchillesServiceProvider::class,
    ClinicalCoherenceServiceProvider::class,
    DataQualityServiceProvider::class,
    PopulationRiskServiceProvider::class,
    NetworkAnalysisServiceProvider::class,
    PopulationCharacterizationServiceProvider::class,
    SolrServiceProvider::class,
    TemplatesServiceProvider::class,
];
