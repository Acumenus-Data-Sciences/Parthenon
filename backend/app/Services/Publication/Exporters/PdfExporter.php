<?php

namespace App\Services\Publication\Exporters;

use Symfony\Component\HttpFoundation\StreamedResponse;

class PdfExporter
{
    /**
     * Export a publication document as a PDF (or HTML fallback).
     *
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $html = $this->buildHtml($document);

        // Build filename
        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($document['title'] ?? 'export')));
        $filename = trim((string) $slug, '-');

        // Try DOMPDF if available
        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf();
            $dompdf->loadHtml($html);
            $dompdf->setPaper('letter', 'portrait');
            $dompdf->render();
            $pdfContent = $dompdf->output();

            return new StreamedResponse(
                function () use ($pdfContent): void {
                    echo $pdfContent;
                },
                200,
                [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => "attachment; filename=\"{$filename}.pdf\"",
                    'Cache-Control' => 'no-cache, no-store, must-revalidate',
                ],
            );
        }

        // Fallback: return HTML for browser print
        return new StreamedResponse(
            function () use ($html): void {
                echo $html;
            },
            200,
            [
                'Content-Type' => 'text/html; charset=utf-8',
                'Content-Disposition' => "inline; filename=\"{$filename}.html\"",
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ],
        );
    }

    /**
     * Build a print-ready HTML document with inline styles.
     *
     * @param  array<string, mixed>  $document
     */
    private function buildHtml(array $document): string
    {
        $title = htmlspecialchars((string) ($document['title'] ?? 'Untitled'), ENT_QUOTES, 'UTF-8');

        /** @var list<string> $authors */
        $authors = $document['authors'] ?? [];
        $authorsHtml = htmlspecialchars(implode(', ', $authors), ENT_QUOTES, 'UTF-8');

        $date = date('F j, Y');

        $sectionsHtml = '';
        /** @var list<array<string, mixed>> $sections */
        $sections = $document['sections'] ?? [];
        foreach ($sections as $section) {
            $type = (string) ($section['type'] ?? '');
            $content = (string) ($section['content'] ?? '');
            $svg = (string) ($section['svg'] ?? '');
            $caption = (string) ($section['caption'] ?? '');

            if ($type === 'diagram') {
                if ($svg !== '') {
                    $sectionsHtml .= '<div style="text-align: center; margin: 24px 0;">'.$svg.'</div>';
                }
                if ($caption !== '') {
                    $sectionsHtml .= '<p style="text-align: center; font-style: italic; font-size: 10pt; color: #555;">'.htmlspecialchars($caption, ENT_QUOTES, 'UTF-8').'</p>';
                }
            } else {
                $heading = match ($type) {
                    'methods' => 'Methods',
                    'results' => 'Results',
                    'discussion' => 'Discussion',
                    'title' => 'Title',
                    default => ucfirst($type),
                };

                $sectionsHtml .= '<h2 style="font-size: 14pt; margin-top: 24px; margin-bottom: 8px;">'.htmlspecialchars($heading, ENT_QUOTES, 'UTF-8').'</h2>';

                if ($content !== '') {
                    $paragraphs = preg_split('/\n\n+/', $content);
                    if ($paragraphs !== false) {
                        foreach ($paragraphs as $paragraph) {
                            $paragraph = trim($paragraph);
                            if ($paragraph !== '') {
                                $sectionsHtml .= '<p style="text-align: justify; margin-bottom: 12px; line-height: 1.6;">'.htmlspecialchars($paragraph, ENT_QUOTES, 'UTF-8').'</p>';
                            }
                        }
                    }
                }
            }
        }

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{$title}</title>
    <style>
        @media print {
            body { margin: 0; }
        }
    </style>
</head>
<body style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; max-width: 7in; margin: 1in auto; color: #000;">
    <h1 style="text-align: center; font-size: 16pt; margin-bottom: 8px;">{$title}</h1>
    <p style="text-align: center; font-style: italic; margin-bottom: 4px;">{$authorsHtml}</p>
    <p style="text-align: center; font-size: 10pt; color: #666; margin-bottom: 32px;">Generated: {$date}</p>
    {$sectionsHtml}
</body>
</html>
HTML;
    }
}
