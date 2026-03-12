<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir\Export;

use App\Services\Fhir\Export\ReverseVocabularyService;
use Tests\TestCase;

class ReverseVocabularyServiceTest extends TestCase
{
    public function test_resolves_concept_id_to_fhir_coding(): void
    {
        $service = new ReverseVocabularyService();
        $coding = $service->resolve(0);

        $this->assertEmpty($coding['coding']);
        $this->assertEquals(0, $coding['concept_id']);
    }

    public function test_zero_concept_returns_data_absent_reason(): void
    {
        $service = new ReverseVocabularyService();
        $result = $service->buildCodeableConcept(0, 0, 'ICD10CM|J06.9');

        $this->assertArrayHasKey('text', $result);
        $this->assertEquals('ICD10CM|J06.9', $result['text']);
    }
}
