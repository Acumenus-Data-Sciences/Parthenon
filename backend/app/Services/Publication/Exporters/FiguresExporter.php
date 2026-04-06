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

        $tempRoot = tempnam(sys_get_temp_dir(), 'pub_zip_');
        if ($tempRoot === false) {
            throw new \RuntimeException('Failed to create temporary file.');
        }
        @unlink($tempRoot);
        $tempZip = $tempRoot.'.zip';

        $zip = new ZipArchive;
        $openResult = $zip->open($tempZip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        if ($openResult !== true) {
            throw new \RuntimeException('Failed to create ZIP archive.');
        }

        $figureIndex = 1;
        /** @var list<array<string, mixed>> $sections */
        $sections = $document['sections'] ?? [];
        foreach ($sections as $section) {
            $svg = (string) ($section['svg'] ?? '');
            $diagramType = (string) ($section['diagram_type'] ?? 'figure');

            if ($svg !== '' && $diagramType !== '') {
                $entryName = "figure_{$figureIndex}_{$diagramType}.svg";
                $zip->addFromString($entryName, $svg);
                $figureIndex++;
            }
        }

        if ($figureIndex === 1) {
            $zip->addFromString('README.txt', 'No diagram SVGs were available for export.');
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
