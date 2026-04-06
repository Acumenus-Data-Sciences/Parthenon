<?php

namespace App\Services\Publication\Exporters;

use Dompdf\Dompdf;
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

        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($document['title'] ?? 'export')));
        $filename = trim((string) $slug, '-');

        if (class_exists(Dompdf::class)) {
            $dompdf = new Dompdf(['isRemoteEnabled' => false]);
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
        $tableNum = 0;
        /** @var list<array<string, mixed>> $sections */
        $sections = $document['sections'] ?? [];
        foreach ($sections as $section) {
            $type = (string) ($section['type'] ?? '');
            $content = (string) ($section['content'] ?? '');
            $svg = (string) ($section['svg'] ?? '');
            $caption = (string) ($section['caption'] ?? '');
            $diagramType = (string) ($section['diagram_type'] ?? '');

            if ($type === 'diagram') {
                if ($svg !== '') {
                    $sectionsHtml .= '<div style="text-align: center; margin: 24px 0;">'.$svg.'</div>';
                }
                if ($caption !== '') {
                    $sectionsHtml .= '<p style="text-align: center; font-style: italic; font-size: 10pt; color: #555;">'.htmlspecialchars($caption, ENT_QUOTES, 'UTF-8').'</p>';
                }
            } else {
                // Use section title if provided
                $heading = (string) ($section['title'] ?? '');
                if ($heading === '') {
                    $heading = match ($type) {
                        'methods' => 'Methods',
                        'results' => 'Results',
                        'discussion' => 'Discussion',
                        default => ucfirst($type),
                    };
                }

                $sectionsHtml .= '<h2 style="font-size: 14pt; margin-top: 24px; margin-bottom: 8px;">'.htmlspecialchars($heading, ENT_QUOTES, 'UTF-8').'</h2>';

                // Table
                /** @var array<string, mixed>|null $tableData */
                $tableData = $section['table_data'] ?? null;
                if ($tableData !== null) {
                    $sectionsHtml .= $this->buildTableHtml($tableData, $tableNum);
                }

                // Text paragraphs
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

                if ($svg !== '' && $diagramType !== '') {
                    $sectionsHtml .= '<div style="text-align: center; margin: 24px 0;">'.$svg.'</div>';
                    if ($caption !== '') {
                        $sectionsHtml .= '<p style="text-align: center; font-style: italic; font-size: 10pt; color: #555;">'.htmlspecialchars($caption, ENT_QUOTES, 'UTF-8').'</p>';
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
        table.pub-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10pt;
            margin: 16px 0;
        }
        table.pub-table th {
            text-align: left;
            font-weight: bold;
            padding: 4px 8px;
            border-top: 2px solid #000;
            border-bottom: 1px solid #999;
        }
        table.pub-table td {
            padding: 3px 8px;
        }
        table.pub-table tr:last-child td {
            border-bottom: 2px solid #000;
        }
        table.pub-table th:not(:first-child),
        table.pub-table td:not(:first-child) {
            text-align: right;
        }
        .table-caption {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .table-footnote {
            font-size: 8pt;
            color: #666;
            margin-top: 2px;
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

    /**
     * Build an HTML table from table data.
     *
     * @param  array<string, mixed>  $tableData
     */
    private function buildTableHtml(array $tableData, int &$tableNum): string
    {
        /** @var list<string> $headers */
        $headers = $tableData['headers'] ?? [];
        /** @var list<array<string, mixed>> $rows */
        $rows = $tableData['rows'] ?? [];

        if ($headers === [] || $rows === []) {
            return '';
        }

        $tableNum++;
        $caption = htmlspecialchars((string) ($tableData['caption'] ?? ''), ENT_QUOTES, 'UTF-8');

        $html = "<p class=\"table-caption\">Table {$tableNum}. {$caption}</p>";
        $html .= '<table class="pub-table"><thead><tr>';

        foreach ($headers as $header) {
            $html .= '<th>'.htmlspecialchars((string) $header, ENT_QUOTES, 'UTF-8').'</th>';
        }
        $html .= '</tr></thead><tbody>';

        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach ($headers as $header) {
                $value = $row[$header] ?? '—';
                $html .= '<td>'.htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8').'</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table>';

        /** @var list<string> $footnotes */
        $footnotes = $tableData['footnotes'] ?? [];
        foreach ($footnotes as $note) {
            $html .= '<p class="table-footnote">'.htmlspecialchars((string) $note, ENT_QUOTES, 'UTF-8').'</p>';
        }

        return $html;
    }
}
