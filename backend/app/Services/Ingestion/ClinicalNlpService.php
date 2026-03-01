<?php

declare(strict_types=1);

namespace App\Services\Ingestion;

use App\Services\AiService;

class ClinicalNlpService
{
    public function __construct(
        private readonly AiService $aiService,
    ) {}

    public function extractEntities(string $text, bool $linkConcepts = true): array
    {
        $response = $this->aiService->post('/clinical-nlp/extract', [
            'text' => $text,
            'link_concepts' => $linkConcepts,
        ], 60);

        return $response;
    }

    public function extractBatch(array $texts, bool $linkConcepts = true): array
    {
        $response = $this->aiService->post('/clinical-nlp/extract-batch', [
            'texts' => $texts,
            'link_concepts' => $linkConcepts,
        ], 120);

        return $response;
    }
}
