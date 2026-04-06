<?php

namespace App\Services\Publication\Exporters;

use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
use PhpOffice\PhpWord\SimpleType\TblWidth;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocxExporter
{
    /**
     * Export a publication document as a DOCX file.
     *
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $phpWord = new PhpWord;

        // Default font
        $phpWord->setDefaultFontName('Times New Roman');
        $phpWord->setDefaultFontSize(12);

        // Title page
        $titleSection = $phpWord->addSection([
            'marginTop' => 1440,
            'marginBottom' => 1440,
            'marginLeft' => 1440,
            'marginRight' => 1440,
        ]);

        $titleSection->addTextBreak(6);

        $titleSection->addText(
            (string) ($document['title'] ?? 'Untitled'),
            ['bold' => true, 'size' => 16, 'name' => 'Times New Roman'],
            ['alignment' => Jc::CENTER],
        );

        $titleSection->addTextBreak(1);

        /** @var list<string> $authors */
        $authors = $document['authors'] ?? [];
        if ($authors !== []) {
            $titleSection->addText(
                implode(', ', $authors),
                ['italic' => true, 'size' => 12, 'name' => 'Times New Roman'],
                ['alignment' => Jc::CENTER],
            );
        }

        $titleSection->addTextBreak(1);

        $titleSection->addText(
            'Generated: '.date('F j, Y'),
            ['size' => 10, 'name' => 'Times New Roman', 'color' => '666666'],
            ['alignment' => Jc::CENTER],
        );

        // Content sections
        /** @var list<array<string, mixed>> $sections */
        $sections = $document['sections'] ?? [];
        if ($sections !== []) {
            $contentSection = $phpWord->addSection([
                'marginTop' => 1440,
                'marginBottom' => 1440,
                'marginLeft' => 1440,
                'marginRight' => 1440,
            ]);

            $tableNum = 0;
            $tempImages = [];
            foreach ($sections as $section) {
                $type = (string) ($section['type'] ?? '');

                if ($type === 'diagram') {
                    $this->addDiagram($contentSection, $section, $tempImages);
                } else {
                    $this->addTextSection($contentSection, $section, $tableNum, $tempImages);
                }
            }
        }

        // Build filename
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($document['title'] ?? 'export')));
        $filename = trim((string) $slug, '-').'.docx';

        return new StreamedResponse(
            function () use ($phpWord, $tempImages): void {
                $tempFile = tempnam(sys_get_temp_dir(), 'pub_docx_');
                if ($tempFile === false) {
                    throw new \RuntimeException('Failed to create temporary file.');
                }

                try {
                    $writer = IOFactory::createWriter($phpWord, 'Word2007');
                    $writer->save($tempFile);
                    readfile($tempFile);
                } finally {
                    foreach ($tempImages as $tempImage) {
                        if (is_string($tempImage) && file_exists($tempImage)) {
                            unlink($tempImage);
                        }
                    }
                    if (file_exists($tempFile)) {
                        unlink($tempFile);
                    }
                }
            },
            200,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ],
        );
    }

    /**
     * Add a text-based section (methods, results, discussion) with optional table.
     *
     * @param  Section  $wordSection
     * @param  array<string, mixed>  $data
     */
    private function addTextSection($wordSection, array $data, int &$tableNum, array &$tempImages): void
    {
        $content = (string) ($data['content'] ?? '');

        // Use the section's own title if provided, otherwise fall back to type
        $heading = (string) ($data['title'] ?? '');
        if ($heading === '') {
            $type = (string) ($data['type'] ?? '');
            $heading = match ($type) {
                'methods' => 'Methods',
                'results' => 'Results',
                'discussion' => 'Discussion',
                default => ucfirst($type),
            };
        }

        $wordSection->addText(
            $heading,
            ['bold' => true, 'size' => 14, 'name' => 'Times New Roman'],
        );

        $wordSection->addTextBreak(1);

        // Table (if present)
        /** @var array<string, mixed>|null $tableData */
        $tableData = $data['table_data'] ?? null;
        if ($tableData !== null) {
            $this->addTable($wordSection, $tableData, $tableNum);
        }

        // Paragraphs
        if ($content !== '') {
            $paragraphs = preg_split('/\n\n+/', $content);
            if ($paragraphs !== false) {
                foreach ($paragraphs as $paragraph) {
                    $paragraph = trim($paragraph);
                    if ($paragraph !== '') {
                        $wordSection->addText(
                            $paragraph,
                            ['size' => 12, 'name' => 'Times New Roman'],
                            ['alignment' => Jc::BOTH],
                        );
                        $wordSection->addTextBreak(1);
                    }
                }
            }
        }

        if ((string) ($data['svg'] ?? '') !== '' && (string) ($data['diagram_type'] ?? '') !== '') {
            $wordSection->addTextBreak(1);
            $this->addDiagram($wordSection, $data, $tempImages);
        }
    }

    /**
     * Add a publication-style table.
     *
     * @param  Section  $wordSection
     * @param  array<string, mixed>  $tableData
     */
    private function addTable($wordSection, array $tableData, int &$tableNum): void
    {
        /** @var list<string> $headers */
        $headers = $tableData['headers'] ?? [];
        /** @var list<array<string, mixed>> $rows */
        $rows = $tableData['rows'] ?? [];

        if ($headers === [] || $rows === []) {
            return;
        }

        $tableNum++;
        $caption = (string) ($tableData['caption'] ?? '');

        // Table caption
        $wordSection->addText(
            "Table {$tableNum}. {$caption}",
            ['bold' => true, 'size' => 10, 'name' => 'Times New Roman'],
        );

        // Create table
        $table = $wordSection->addTable([
            'borderSize' => 0,
            'borderColor' => 'FFFFFF',
            'cellMargin' => 40,
            'unit' => TblWidth::PERCENT,
            'width' => 100 * 50,
        ]);

        // Header row with top/bottom borders
        $table->addRow();
        foreach ($headers as $header) {
            $cell = $table->addCell(null, [
                'borderTopSize' => 12,
                'borderTopColor' => '000000',
                'borderBottomSize' => 6,
                'borderBottomColor' => '666666',
            ]);
            $cell->addText(
                (string) $header,
                ['bold' => true, 'size' => 10, 'name' => 'Times New Roman'],
            );
        }

        // Data rows
        foreach ($rows as $idx => $row) {
            $isLast = $idx === count($rows) - 1;
            $table->addRow();
            foreach ($headers as $header) {
                $value = $row[$header] ?? '—';
                $cell = $table->addCell(null, [
                    'borderBottomSize' => $isLast ? 12 : 0,
                    'borderBottomColor' => $isLast ? '000000' : 'FFFFFF',
                ]);
                $cell->addText(
                    (string) $value,
                    ['size' => 10, 'name' => 'Times New Roman'],
                );
            }
        }

        // Footnotes
        /** @var list<string> $footnotes */
        $footnotes = $tableData['footnotes'] ?? [];
        foreach ($footnotes as $note) {
            $wordSection->addText(
                (string) $note,
                ['size' => 8, 'name' => 'Times New Roman', 'color' => '666666'],
            );
        }

        $wordSection->addTextBreak(1);
    }

    /**
     * Add a diagram section with optional SVG-to-PNG conversion.
     *
     * @param  Section  $wordSection
     * @param  array<string, mixed>  $data
     */
    private function addDiagram($wordSection, array $data, array &$tempImages): void
    {
        $svg = (string) ($data['svg'] ?? '');
        $pngDataUrl = (string) ($data['png_data_url'] ?? '');
        $caption = (string) ($data['caption'] ?? '');
        $diagramType = (string) ($data['diagram_type'] ?? 'figure');

        if ($pngDataUrl !== '') {
            try {
                $tempRoot = tempnam(sys_get_temp_dir(), 'pub_png_');
                if ($tempRoot !== false) {
                    @unlink($tempRoot);
                    $tempPng = $tempRoot.'.png';
                    $pngBytes = preg_replace('/^data:image\/png;base64,/', '', $pngDataUrl);
                    if ($pngBytes === null) {
                        throw new \RuntimeException('Failed to decode PNG data URL.');
                    }
                    file_put_contents($tempPng, base64_decode($pngBytes, true));

                    $wordSection->addImage($tempPng, [
                        'width' => 450,
                        'alignment' => Jc::CENTER,
                    ]);
                    $tempImages[] = $tempPng;
                }
            } catch (\Throwable) {
                // Skip image on failure but keep caption
            }
        } elseif ($svg !== '' && extension_loaded('imagick')) {
            try {
                $tempRoot = tempnam(sys_get_temp_dir(), 'pub_png_');
                if ($tempRoot !== false) {
                    @unlink($tempRoot);
                    $tempPng = $tempRoot.'.png';
                    $imagick = new \Imagick;
                    $imagick->setResolution(300, 300);
                    $imagick->readImageBlob($svg);
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($tempPng);
                    $imagick->clear();
                    $imagick->destroy();

                    $wordSection->addImage($tempPng, [
                        'width' => 450,
                        'alignment' => Jc::CENTER,
                    ]);
                    $tempImages[] = $tempPng;
                }
            } catch (\Throwable) {
                // Skip image on failure but keep caption
            }
        }

        if ($caption !== '') {
            $figureLabel = ucwords(str_replace('_', ' ', $diagramType));
            $wordSection->addText(
                "Figure: {$figureLabel} — {$caption}",
                ['italic' => true, 'size' => 10, 'name' => 'Times New Roman'],
                ['alignment' => Jc::CENTER],
            );
            $wordSection->addTextBreak(1);
        }
    }
}
