<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir\Export;

use App\Context\SourceContext;
use App\Services\Fhir\Export\FhirResourceBuilderFactory;
use App\Services\Fhir\Export\OmopToFhirService;
use App\Services\Fhir\Export\ReverseVocabularyService;
use Mockery;
use ReflectionMethod;
use Tests\TestCase;

class OmopToFhirServiceTest extends TestCase
{
    public function test_search_returns_empty_for_unknown_type(): void
    {
        $factory = Mockery::mock(FhirResourceBuilderFactory::class);
        $vocab = Mockery::mock(ReverseVocabularyService::class);
        $service = new OmopToFhirService($factory, $vocab);

        $result = $service->search('UnknownResource');

        $this->assertEmpty($result['resources']);
        $this->assertEquals(0, $result['total']);
    }

    public function test_read_returns_null_for_unknown_type(): void
    {
        $factory = Mockery::mock(FhirResourceBuilderFactory::class);
        $vocab = Mockery::mock(ReverseVocabularyService::class);
        $service = new OmopToFhirService($factory, $vocab);

        $result = $service->read('UnknownResource', 1);

        $this->assertNull($result);
    }

    public function test_cdm_table_uses_active_source_context_schema(): void
    {
        app()->instance(SourceContext::class, new SourceContext(cdmSchema: 'source_specific_cdm'));

        $factory = Mockery::mock(FhirResourceBuilderFactory::class);
        $vocab = Mockery::mock(ReverseVocabularyService::class);
        $service = new OmopToFhirService($factory, $vocab);
        $method = new ReflectionMethod($service, 'cdmTable');
        $method->setAccessible(true);

        $this->assertSame('source_specific_cdm.person', $method->invoke($service, 'person'));
    }
}
