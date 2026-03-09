<?php

namespace App\Services\Publication;

use App\Services\Publication\Exporters\DocxExporter;
use App\Services\Publication\Exporters\FiguresExporter;
use App\Services\Publication\Exporters\PdfExporter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicationService
{
    public function __construct(
        private readonly DocxExporter $docxExporter,
        private readonly PdfExporter $pdfExporter,
        private readonly FiguresExporter $figuresExporter,
    ) {}

    /**
     * Export a publication document in the requested format.
     *
     * @param  array<string, mixed>  $payload
     */
    public function export(array $payload): StreamedResponse
    {
        // Filter to only included sections
        $sections = array_values(array_filter(
            $payload['sections'] ?? [],
            fn (array $section): bool => (bool) ($section['included'] ?? false),
        ));

        $document = [
            'title' => $payload['title'] ?? 'Untitled',
            'authors' => $payload['authors'] ?? [],
            'template' => $payload['template'] ?? 'generic-ohdsi',
            'sections' => $sections,
        ];

        return match ($payload['format']) {
            'docx' => $this->docxExporter->export($document),
            'pdf' => $this->pdfExporter->export($document),
            'figures-zip' => $this->figuresExporter->export($document),
            default => throw new \InvalidArgumentException("Unsupported format: {$payload['format']}"),
        };
    }
}
