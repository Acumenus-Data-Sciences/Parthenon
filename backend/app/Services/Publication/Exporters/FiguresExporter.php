<?php

namespace App\Services\Publication\Exporters;

use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

class FiguresExporter
{
    /**
     * Export all diagram SVGs as a ZIP archive.
     *
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($document['title'] ?? 'figures')));
        $filename = trim((string) $slug, '-').'-figures.zip';

        $tempZip = tempnam(sys_get_temp_dir(), 'pub_zip_');
        if ($tempZip === false) {
            throw new \RuntimeException('Failed to create temporary file.');
        }

        $zip = new ZipArchive();
        $openResult = $zip->open($tempZip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        if ($openResult !== true) {
            throw new \RuntimeException('Failed to create ZIP archive.');
        }

        $figureIndex = 1;
        /** @var list<array<string, mixed>> $sections */
        $sections = $document['sections'] ?? [];
        foreach ($sections as $section) {
            $type = (string) ($section['type'] ?? '');
            $svg = (string) ($section['svg'] ?? '');
            $diagramType = (string) ($section['diagram_type'] ?? 'figure');

            if ($type === 'diagram' && $svg !== '') {
                $entryName = "figure_{$figureIndex}_{$diagramType}.svg";
                $zip->addFromString($entryName, $svg);
                $figureIndex++;
            }
        }

        $zip->close();

        return new StreamedResponse(
            function () use ($tempZip): void {
                try {
                    readfile($tempZip);
                } finally {
                    if (file_exists($tempZip)) {
                        unlink($tempZip);
                    }
                }
            },
            200,
            [
                'Content-Type' => 'application/zip',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ],
        );
    }
}
