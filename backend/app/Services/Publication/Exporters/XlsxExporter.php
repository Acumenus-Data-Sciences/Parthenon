<?php

namespace App\Services\Publication\Exporters;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Export a publication document as an XLSX workbook: a "Manuscript" overview
 * sheet (title, authors, and each section's heading + prose) plus one sheet per
 * data table found in the included sections — the structured, spreadsheet-native
 * counterpart to the DOCX manuscript export.
 */
class XlsxExporter
{
    /**
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $overview = $spreadsheet->getActiveSheet();
        $overview->setTitle('Manuscript');

        $row = 1;
        $overview->setCellValue("A{$row}", (string) ($document['title'] ?? 'Untitled'));
        $overview->getStyle("A{$row}")->getFont()->setBold(true)->setSize(14);
        $row += 2;

        /** @var list<string> $authors */
        $authors = $document['authors'] ?? [];
        if ($authors !== []) {
            $overview->setCellValue("A{$row}", 'Authors');
            $overview->getStyle("A{$row}")->getFont()->setBold(true);
            $overview->setCellValue("B{$row}", implode(', ', $authors));
            $row++;
        }
        $overview->setCellValue("A{$row}", 'Generated');
        $overview->getStyle("A{$row}")->getFont()->setBold(true);
        $overview->setCellValue("B{$row}", date('F j, Y'));
        $row += 2;

        /** @var list<array<string, mixed>> $sections */
        $sections = $document['sections'] ?? [];
        $usedSheetNames = ['Manuscript'];
        $tableNum = 0;

        foreach ($sections as $section) {
            $heading = $this->sectionHeading($section);
            $content = trim((string) ($section['content'] ?? ''));

            $overview->setCellValue("A{$row}", $heading);
            $overview->getStyle("A{$row}")->getFont()->setBold(true)->setSize(12);
            $row++;
            if ($content !== '') {
                $overview->setCellValue("A{$row}", $content);
                $overview->getStyle("A{$row}")->getAlignment()->setWrapText(true);
                $row++;
            }
            $row++;

            /** @var array<string, mixed>|null $tableData */
            $tableData = $section['table_data'] ?? null;
            if ($tableData !== null) {
                $tableNum++;
                $this->addTableSheet($spreadsheet, $tableData, $heading, $tableNum, $usedSheetNames);
            }
        }

        $overview->getColumnDimension('A')->setWidth(90);

        $slug = preg_replace('/[^a-z0-9]+/', '-', strtolower((string) ($document['title'] ?? 'export')));
        $filename = trim((string) $slug, '-').'.xlsx';
        if ($filename === '.xlsx') {
            $filename = 'export.xlsx';
        }

        return new StreamedResponse(
            function () use ($spreadsheet): void {
                $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
                $writer->save('php://output');
                $spreadsheet->disconnectWorksheets();
            },
            200,
            [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
            ],
        );
    }

    /**
     * @param  array<string, mixed>  $section
     */
    private function sectionHeading(array $section): string
    {
        $heading = (string) ($section['title'] ?? '');
        if ($heading !== '') {
            return $heading;
        }

        $type = (string) ($section['type'] ?? '');

        return match ($type) {
            'methods' => 'Methods',
            'results' => 'Results',
            'discussion' => 'Discussion',
            default => $type === '' ? 'Section' : ucfirst($type),
        };
    }

    /**
     * @param  array<string, mixed>  $tableData
     * @param  list<string>  $usedSheetNames
     */
    private function addTableSheet(Spreadsheet $spreadsheet, array $tableData, string $heading, int $tableNum, array &$usedSheetNames): void
    {
        /** @var list<string> $headers */
        $headers = $tableData['headers'] ?? [];
        /** @var list<array<string, mixed>> $rows */
        $rows = $tableData['rows'] ?? [];

        if ($headers === [] || $rows === []) {
            return;
        }

        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle($this->uniqueSheetName($heading, $tableNum, $usedSheetNames));

        $col = 1;
        foreach ($headers as $header) {
            $cell = Coordinate::stringFromColumnIndex($col).'1';
            $sheet->setCellValue($cell, (string) $header);
            $sheet->getStyle($cell)->getFont()->setBold(true);
            $col++;
        }

        $r = 2;
        foreach ($rows as $rowData) {
            $col = 1;
            foreach ($headers as $header) {
                $value = $rowData[$header] ?? '';
                $cell = Coordinate::stringFromColumnIndex($col).$r;
                $sheet->setCellValue($cell, is_scalar($value) ? $value : (string) json_encode($value));
                $col++;
            }
            $r++;
        }

        foreach (range(1, count($headers)) as $index) {
            $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($index))->setAutoSize(true);
        }
    }

    /**
     * Excel sheet titles are <=31 chars, must exclude \ / ? * [ ] :, and be unique.
     *
     * @param  list<string>  $used
     */
    private function uniqueSheetName(string $base, int $tableNum, array &$used): string
    {
        $clean = trim((string) preg_replace('/[\\\\\/\?\*\[\]:]/', ' ', $base));
        if ($clean === '') {
            $clean = "Table {$tableNum}";
        }

        $name = mb_substr($clean, 0, 28);
        $candidate = $name;
        $suffix = 2;
        while (in_array($candidate, $used, true)) {
            $candidate = mb_substr($name, 0, 25).' ('.$suffix.')';
            $suffix++;
        }

        $used[] = $candidate;

        return $candidate;
    }
}
