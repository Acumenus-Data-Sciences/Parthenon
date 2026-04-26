<?php

declare(strict_types=1);

use App\Services\Publication\Exporters\DocxExporter;
use App\Services\Publication\Exporters\FiguresExporter;
use App\Services\Publication\Exporters\PdfExporter;
use App\Services\Publication\Support\PublicationImage;
use Symfony\Component\HttpFoundation\StreamedResponse;

function publishTestPngDataUrl(): string
{
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAIAAAAC64paAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAG0lEQVQ4jWP8z0A+YKJA76jmUc2jmkc1U0EzACKcASfaaIZkAAAAAElFTkSuQmCC';
}

function streamedResponseContent(StreamedResponse $response): string
{
    ob_start();
    $response->sendContent();

    return (string) ob_get_clean();
}

it('validates and normalizes publish PNG data URLs', function () {
    $bytes = PublicationImage::decodePngDataUrl(publishTestPngDataUrl());

    expect($bytes)->toBeString()
        ->and(str_starts_with($bytes, "\x89PNG\r\n\x1A\n"))->toBeTrue()
        ->and(PublicationImage::decodePngDataUrl('data:image/png;base64,not-valid'))->toBeNull()
        ->and(PublicationImage::decodePngDataUrl('data:image/png;base64,'.base64_encode("\x89PNG\r\n\x1A\nnot-an-image")))->toBeNull()
        ->and(PublicationImage::normalizePngDataUrl(publishTestPngDataUrl()))
        ->toStartWith('data:image/png;base64,');
});

it('exports figures zip entries for PNG and SVG assets', function () {
    $response = (new FiguresExporter)->export([
        'title' => 'Publish Figure Export',
        'sections' => [
            [
                'type' => 'results',
                'included' => true,
                'diagram_type' => 'forest_plot',
                'svg' => '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
                'png_data_url' => publishTestPngDataUrl(),
            ],
        ],
    ]);

    $zipBytes = streamedResponseContent($response);
    $tempZip = tempnam(sys_get_temp_dir(), 'pub_test_zip_');
    expect($tempZip)->not->toBeFalse();
    file_put_contents($tempZip, $zipBytes);

    $zip = new ZipArchive;
    expect($zip->open($tempZip))->toBeTrue();
    expect($zip->getFromName('figure_1_forest_plot.svg'))->toContain('<svg');
    expect($zip->getFromName('figure_1_forest_plot.png'))->toBeString();
    $zip->close();
    unlink($tempZip);
});

it('embeds PNG figures in DOCX exports', function () {
    $response = (new DocxExporter)->export([
        'title' => 'Publish DOCX Export',
        'sections' => [
            [
                'type' => 'results',
                'title' => 'Results',
                'included' => true,
                'diagram_type' => 'forest_plot',
                'content' => 'Results text.',
                'png_data_url' => publishTestPngDataUrl(),
            ],
        ],
    ]);

    $docxBytes = streamedResponseContent($response);
    $tempDocx = tempnam(sys_get_temp_dir(), 'pub_test_docx_');
    expect($tempDocx)->not->toBeFalse();
    file_put_contents($tempDocx, $docxBytes);

    $zip = new ZipArchive;
    expect($zip->open($tempDocx))->toBeTrue();
    $mediaEntries = [];
    for ($index = 0; $index < $zip->numFiles; $index++) {
        $name = $zip->getNameIndex($index);
        if (is_string($name) && str_starts_with($name, 'word/media/') && str_ends_with($name, '.png')) {
            $mediaEntries[] = $name;
        }
    }
    expect($mediaEntries)->not->toBeEmpty();
    $zip->close();
    unlink($tempDocx);
});

it('renders PDF exports when PNG figure payloads are present', function () {
    $response = (new PdfExporter)->export([
        'title' => 'Publish PDF Export',
        'sections' => [
            [
                'type' => 'results',
                'title' => 'Results',
                'included' => true,
                'diagram_type' => 'forest_plot',
                'content' => 'Results text.',
                'png_data_url' => publishTestPngDataUrl(),
            ],
        ],
    ]);

    $pdfBytes = streamedResponseContent($response);

    expect($response->headers->get('Content-Type'))->toContain('application/pdf')
        ->and($pdfBytes)->toStartWith('%PDF')
        ->and($pdfBytes)->toContain('/Subtype /Image');
});
