<?php

use App\Services\Publication\Exporters\XlsxExporter;

it('exports a publication as a valid xlsx workbook with an overview and a table sheet', function () {
    $document = [
        'title' => 'Hypertension MACE Study',
        'authors' => ['A. Researcher', 'B. Statistician'],
        'template' => 'generic-ohdsi',
        'sections' => [
            ['type' => 'methods', 'title' => 'Methods', 'content' => 'New-user cohort design.'],
            ['type' => 'results', 'title' => 'Results', 'content' => 'The calibrated HR was 1.47.', 'table_data' => [
                'headers' => ['Outcome', 'HR', '95% CI'],
                'rows' => [
                    ['Outcome' => 'MACE', 'HR' => '1.47', '95% CI' => '1.06-2.04'],
                    ['Outcome' => 'Stroke', 'HR' => '1.20', '95% CI' => '0.90-1.60'],
                ],
                'caption' => 'Effect estimates',
            ]],
        ],
    ];

    $response = app(XlsxExporter::class)->export($document);

    expect($response->headers->get('Content-Type'))->toContain('spreadsheetml.sheet')
        ->and($response->headers->get('Content-Disposition'))->toContain('hypertension-mace-study.xlsx');

    ob_start();
    $response->sendContent();
    $body = (string) ob_get_clean();

    // XLSX is an OOXML zip container — verify the magic bytes and a non-trivial payload.
    expect(substr($body, 0, 2))->toBe('PK')
        ->and(strlen($body))->toBeGreaterThan(1000);
});

it('produces an export filename fallback when the title is empty', function () {
    $response = app(XlsxExporter::class)->export(['title' => '', 'sections' => []]);

    expect($response->headers->get('Content-Disposition'))->toContain('export.xlsx');
});
