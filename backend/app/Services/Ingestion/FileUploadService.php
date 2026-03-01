<?php

namespace App\Services\Ingestion;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class FileUploadService
{
    public function store(UploadedFile $file, int $jobId): array
    {
        $fileName = $file->getClientOriginalName();
        $format = $this->detectFormat($file);
        $path = Storage::disk('ingestion')->putFileAs((string) $jobId, $file, $fileName);

        return [
            'file_name' => $fileName,
            'file_format' => $format,
            'file_size' => $file->getSize(),
            'storage_path' => $path,
            'format_metadata' => $this->extractMetadata($file, $format),
        ];
    }

    public function detectFormat(UploadedFile $file): string
    {
        $extension = strtolower($file->getClientOriginalExtension());

        if (in_array($extension, ['csv', 'tsv', 'txt'])) {
            return 'csv';
        }

        if ($extension === 'json') {
            // Check if FHIR Bundle by reading first bytes
            $handle = fopen($file->getRealPath(), 'r');
            $firstChunk = fread($handle, 4096);
            fclose($handle);

            if (str_contains($firstChunk, '"resourceType"') && str_contains($firstChunk, '"Bundle"')) {
                return 'fhir_bundle';
            }

            return 'json';
        }

        if ($extension === 'hl7') {
            return 'hl7';
        }

        // Content sniffing fallback
        $handle = fopen($file->getRealPath(), 'r');
        $firstLine = fgets($handle);
        fclose($handle);

        if ($firstLine && str_starts_with(trim($firstLine), 'MSH|')) {
            return 'hl7';
        }

        return 'csv'; // default
    }

    private function extractMetadata(UploadedFile $file, string $format): array
    {
        if ($format !== 'csv') {
            return ['format' => $format];
        }

        $handle = fopen($file->getRealPath(), 'r');
        $firstLine = fgets($handle);
        fclose($handle);

        // Detect delimiter
        $delimiter = ',';
        $delimiters = [',' => 0, "\t" => 0, '|' => 0, ';' => 0];
        foreach ($delimiters as $d => &$count) {
            $count = substr_count($firstLine, $d);
        }
        $delimiter = array_search(max($delimiters), $delimiters);

        return [
            'format' => 'csv',
            'delimiter' => $delimiter === "\t" ? 'tab' : $delimiter,
            'encoding' => mb_detect_encoding($firstLine, ['UTF-8', 'ASCII', 'ISO-8859-1'], true) ?: 'UTF-8',
        ];
    }

    public function delete(int $jobId): void
    {
        Storage::disk('ingestion')->deleteDirectory((string) $jobId);
    }
}
