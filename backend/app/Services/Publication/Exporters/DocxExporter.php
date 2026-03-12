<?php

namespace App\Services\Publication\Exporters;

use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\SimpleType\Jc;
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
            'marginTop' => 1440,    // 1 inch = 1440 twips
            'marginBottom' => 1440,
            'marginLeft' => 1440,
            'marginRight' => 1440,
        ]);

        // Add vertical spacing before title
        $titleSection->addTextBreak(6);

        // Title
        $titleSection->addText(
            (string) ($document['title'] ?? 'Untitled'),
            ['bold' => true, 'size' => 16, 'name' => 'Times New Roman'],
            ['alignment' => Jc::CENTER],
        );

        $titleSection->addTextBreak(1);

        // Authors
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

        // Generation date
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

            foreach ($sections as $section) {
                $type = (string) ($section['type'] ?? '');

                if ($type === 'diagram') {
                    $this->addDiagram($contentSection, $section);
                } else {
                    $this->addTextSection($contentSection, $section);
                }
            }
        }

        // Build filename
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($document['title'] ?? 'export')));
        $filename = trim((string) $slug, '-').'.docx';

        return new StreamedResponse(
            function () use ($phpWord): void {
                $tempFile = tempnam(sys_get_temp_dir(), 'pub_docx_');
                if ($tempFile === false) {
                    throw new \RuntimeException('Failed to create temporary file.');
                }

                try {
                    $writer = \PhpOffice\PhpWord\IOFactory::createWriter($phpWord, 'Word2007');
                    $writer->save($tempFile);
                    readfile($tempFile);
                } finally {
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
     * Add a text-based section (methods, results, discussion).
     *
     * @param  \PhpOffice\PhpWord\Element\Section  $section
     * @param  array<string, mixed>  $data
     */
    private function addTextSection($section, array $data): void
    {
        $type = (string) ($data['type'] ?? '');
        $content = (string) ($data['content'] ?? '');

        // Heading
        $heading = match ($type) {
            'methods' => 'Methods',
            'results' => 'Results',
            'discussion' => 'Discussion',
            'title' => 'Title',
            default => ucfirst($type),
        };

        $section->addText(
            $heading,
            ['bold' => true, 'size' => 14, 'name' => 'Times New Roman'],
        );

        $section->addTextBreak(1);

        // Paragraphs (split by double newline)
        if ($content !== '') {
            $paragraphs = preg_split('/\n\n+/', $content);
            if ($paragraphs !== false) {
                foreach ($paragraphs as $paragraph) {
                    $paragraph = trim($paragraph);
                    if ($paragraph !== '') {
                        $section->addText(
                            $paragraph,
                            ['size' => 12, 'name' => 'Times New Roman'],
                            ['alignment' => Jc::BOTH],
                        );
                        $section->addTextBreak(1);
                    }
                }
            }
        }
    }

    /**
     * Add a diagram section with optional SVG-to-PNG conversion.
     *
     * @param  \PhpOffice\PhpWord\Element\Section  $section
     * @param  array<string, mixed>  $data
     */
    private function addDiagram($section, array $data): void
    {
        $svg = (string) ($data['svg'] ?? '');
        $caption = (string) ($data['caption'] ?? '');
        $diagramType = (string) ($data['diagram_type'] ?? 'figure');

        // Try to embed SVG as PNG via Imagick
        if ($svg !== '' && extension_loaded('imagick')) {
            try {
                $tempPng = tempnam(sys_get_temp_dir(), 'pub_png_');
                if ($tempPng !== false) {
                    $imagick = new \Imagick;
                    $imagick->setResolution(300, 300);
                    $imagick->readImageBlob($svg);
                    $imagick->setImageFormat('png');
                    $imagick->writeImage($tempPng);
                    $imagick->clear();
                    $imagick->destroy();

                    $section->addImage($tempPng, [
                        'width' => 450,
                        'alignment' => Jc::CENTER,
                    ]);

                    unlink($tempPng);
                }
            } catch (\Throwable) {
                // Skip image on failure but keep caption
            }
        }

        // Caption
        if ($caption !== '') {
            $figureLabel = ucwords(str_replace('_', ' ', $diagramType));
            $section->addText(
                "Figure: {$figureLabel} — {$caption}",
                ['italic' => true, 'size' => 10, 'name' => 'Times New Roman'],
                ['alignment' => Jc::CENTER],
            );
            $section->addTextBreak(1);
        }
    }
}
