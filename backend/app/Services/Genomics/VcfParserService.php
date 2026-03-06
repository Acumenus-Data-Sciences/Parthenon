<?php

namespace App\Services\Genomics;

use App\Models\App\GenomicUpload;
use App\Models\App\GenomicVariant;
use Illuminate\Support\Facades\Log;

/**
 * Parses VCF (Variant Call Format) files and stores variants in the genomic_variants staging table.
 *
 * Supports VCF 4.1/4.2 with optional SnpEff ANN or VEP CSQ annotation in INFO field.
 * Handles basic MAF (Mutation Annotation Format) tab-delimited files as well.
 */
class VcfParserService
{
    /**
     * Parse a VCF file and insert variants into genomic_variants.
     *
     * @param  GenomicUpload  $upload  The upload record to populate
     * @param  string  $filePath  Absolute path to the VCF file
     * @return array{total: int, inserted: int, errors: int}
     */
    public function parse(GenomicUpload $upload, string $filePath): array
    {
        $format = strtolower($upload->file_format);

        if ($format === 'maf' || $format === 'cbio_maf') {
            return $this->parseMaf($upload, $filePath);
        }

        return $this->parseVcf($upload, $filePath);
    }

    private function parseVcf(GenomicUpload $upload, string $filePath): array
    {
        $fh = fopen($filePath, 'r');
        if ($fh === false) {
            throw new \RuntimeException("Cannot open VCF file: {$filePath}");
        }

        $total = 0;
        $inserted = 0;
        $errors = 0;
        $sampleColumns = [];
        $genomeBuild = $upload->genome_build;

        try {
            while (($line = fgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");

                // Meta-information lines
                if (str_starts_with($line, '##')) {
                    if (str_contains(strtolower($line), 'grch38') || str_contains($line, 'hg38')) {
                        $genomeBuild = $genomeBuild ?? 'GRCh38';
                    } elseif (str_contains(strtolower($line), 'grch37') || str_contains($line, 'hg19')) {
                        $genomeBuild = $genomeBuild ?? 'GRCh37';
                    }

                    continue;
                }

                // Header line
                if (str_starts_with($line, '#CHROM')) {
                    $cols = explode("\t", ltrim($line, '#'));
                    // Columns after FORMAT are sample IDs
                    $formatIdx = array_search('FORMAT', $cols, true);
                    if ($formatIdx !== false) {
                        $sampleColumns = array_slice($cols, $formatIdx + 1);
                    }

                    continue;
                }

                // Data lines
                $fields = explode("\t", $line);
                if (count($fields) < 5) {
                    continue;
                }

                $total++;

                try {
                    $record = $this->parseVcfRecord($fields, $sampleColumns, $upload, $genomeBuild);
                    GenomicVariant::create($record);
                    $inserted++;
                } catch (\Throwable $e) {
                    $errors++;
                    Log::warning('VcfParserService: variant parse error', [
                        'line' => $total,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } finally {
            fclose($fh);
        }

        return ['total' => $total, 'inserted' => $inserted, 'errors' => $errors];
    }

    /** @param string[] $fields @param string[] $sampleColumns @return array<string, mixed> */
    private function parseVcfRecord(array $fields, array $sampleColumns, GenomicUpload $upload, ?string $genomeBuild): array
    {
        [$chrom, $pos, , $ref, $alt] = $fields;
        $qual = isset($fields[5]) && $fields[5] !== '.' ? (float) $fields[5] : null;
        $filter = $fields[6] ?? null;
        $infoStr = $fields[7] ?? '';
        $formatStr = $fields[8] ?? '';
        $sampleStr = $fields[9] ?? '';

        $info = $this->parseInfo($infoStr);

        // Parse SnpEff ANN field or VEP CSQ for gene/HGVS
        $ann = $this->parseAnnotation($info);

        // Parse genotype from first sample column
        [$zygosity, $af, $dp] = $this->parseGenotype($formatStr, $sampleStr);

        // Derive measurement_source_value: GENE:hgvs_c or GENE:CHR:POS:REF>ALT
        $sourceValue = $this->buildSourceValue($ann, $chrom, (int) $pos, $ref, $alt);

        return [
            'upload_id' => $upload->id,
            'source_id' => $upload->source_id,
            'person_id' => null, // matched in a later step
            'sample_id' => $sampleColumns[0] ?? $upload->sample_id,
            'chromosome' => ltrim($chrom, 'chr'),
            'position' => (int) $pos,
            'reference_allele' => $ref,
            'alternate_allele' => $alt,
            'genome_build' => $genomeBuild,
            'gene_symbol' => $ann['gene'] ?? null,
            'hgvs_c' => $ann['hgvs_c'] ?? null,
            'hgvs_p' => $ann['hgvs_p'] ?? null,
            'variant_type' => $ann['variant_type'] ?? $this->inferVariantType($ref, $alt),
            'variant_class' => $ann['variant_class'] ?? null,
            'consequence' => $ann['consequence'] ?? null,
            'quality' => $qual,
            'filter_status' => $filter,
            'zygosity' => $zygosity,
            'allele_frequency' => $af ?? (isset($info['AF']) ? (float) $info['AF'] : null),
            'read_depth' => $dp ?? (isset($info['DP']) ? (int) $info['DP'] : null),
            'clinvar_id' => $info['CLNID'] ?? $info['RS'] ?? null,
            'clinvar_significance' => $this->normalizeClinvarSig($info['CLNSIG'] ?? null),
            'cosmic_id' => $info['COSMIC'] ?? $info['COSV'] ?? null,
            'tmb_contribution' => null,
            'is_msi_marker' => false,
            'measurement_concept_id' => 0,
            'measurement_source_value' => $sourceValue,
            'value_as_concept_id' => null,
            'mapping_status' => 'unmapped',
            'omop_measurement_id' => null,
            'raw_info' => array_slice($info, 0, 30, true), // store up to 30 INFO fields
        ];
    }

    /** @return array<string, string> */
    private function parseInfo(string $infoStr): array
    {
        $info = [];
        foreach (explode(';', $infoStr) as $part) {
            if (str_contains($part, '=')) {
                [$key, $val] = explode('=', $part, 2);
                $info[trim($key)] = trim($val);
            } else {
                $info[trim($part)] = 'true';
            }
        }

        return $info;
    }

    /** @param array<string, string> $info @return array<string, string|null> */
    private function parseAnnotation(array $info): array
    {
        // SnpEff ANN= format: Allele|Annotation|Impact|Gene_Name|Gene_ID|Feature_Type|...
        if (isset($info['ANN'])) {
            $parts = explode('|', explode(',', $info['ANN'])[0]);

            return [
                'gene' => $parts[3] ?? null,
                'variant_class' => $parts[1] ?? null,
                'consequence' => $parts[1] ?? null,
                'hgvs_c' => isset($parts[9]) && $parts[9] !== '' ? $parts[9] : null,
                'hgvs_p' => isset($parts[10]) && $parts[10] !== '' ? $parts[10] : null,
                'variant_type' => null,
            ];
        }

        // VEP CSQ= format: Allele|Consequence|IMPACT|SYMBOL|Gene|...|HGVSc|HGVSp|...
        if (isset($info['CSQ'])) {
            $parts = explode('|', explode(',', $info['CSQ'])[0]);

            return [
                'gene' => $parts[3] ?? null,
                'variant_class' => $parts[1] ?? null,
                'consequence' => $parts[1] ?? null,
                'hgvs_c' => $parts[10] ?? null,
                'hgvs_p' => $parts[11] ?? null,
                'variant_type' => null,
            ];
        }

        return ['gene' => null, 'variant_class' => null, 'consequence' => null, 'hgvs_c' => null, 'hgvs_p' => null, 'variant_type' => null];
    }

    /** @return array{0: string|null, 1: float|null, 2: int|null} */
    private function parseGenotype(string $formatStr, string $sampleStr): array
    {
        if ($formatStr === '' || $sampleStr === '') {
            return [null, null, null];
        }

        $formatFields = explode(':', $formatStr);
        $sampleFields = explode(':', $sampleStr);
        $data = array_combine($formatFields, $sampleFields);

        if ($data === false) {
            return [null, null, null];
        }

        // Zygosity from GT
        $zygosity = null;
        if (isset($data['GT'])) {
            $gt = $data['GT'];
            $alleles = preg_split('/[\/|]/', $gt);
            if ($alleles !== false) {
                $alleles = array_filter($alleles, fn ($a) => $a !== '.');
                $unique = array_unique($alleles);
                if (count($alleles) > 0) {
                    $zygosity = count($unique) === 1 ? 'homozygous' : 'heterozygous';
                }
            }
        }

        $af = null;
        if (isset($data['AF'])) {
            $af = (float) $data['AF'];
        } elseif (isset($data['AD'])) {
            $ads = array_map('intval', explode(',', $data['AD']));
            $total = array_sum($ads);
            if ($total > 0 && count($ads) >= 2) {
                $af = $ads[1] / $total;
            }
        }

        $dp = isset($data['DP']) ? (int) $data['DP'] : null;

        return [$zygosity, $af, $dp];
    }

    private function inferVariantType(string $ref, string $alt): string
    {
        if (strlen($ref) === strlen($alt)) {
            return strlen($ref) === 1 ? 'SNP' : 'MNP';
        }

        return strlen($ref) < strlen($alt) ? 'INS' : 'DEL';
    }

    private function normalizeClinvarSig(?string $sig): ?string
    {
        if ($sig === null || $sig === '') {
            return null;
        }
        // ClinVar uses _ instead of spaces in VCF INFO
        $sig = str_replace('_', ' ', $sig);
        // Take first value if pipe-delimited
        $sig = explode('|', $sig)[0];

        return $sig;
    }

    /** @param array<string, string|null> $ann */
    private function buildSourceValue(array $ann, string $chrom, int $pos, string $ref, string $alt): string
    {
        if ($ann['gene'] !== null && $ann['hgvs_c'] !== null) {
            return "{$ann['gene']}:{$ann['hgvs_c']}";
        }
        if ($ann['gene'] !== null) {
            $chrom = ltrim($chrom, 'chr');

            return "{$ann['gene']}:{$chrom}:{$pos}:{$ref}>{$alt}";
        }
        $chrom = ltrim($chrom, 'chr');

        return "{$chrom}:{$pos}:{$ref}>{$alt}";
    }

    /**
     * Parse a MAF (Mutation Annotation Format) file — tab-delimited, first line is header.
     */
    private function parseMaf(GenomicUpload $upload, string $filePath): array
    {
        $fh = fopen($filePath, 'r');
        if ($fh === false) {
            throw new \RuntimeException("Cannot open MAF file: {$filePath}");
        }

        $total = 0;
        $inserted = 0;
        $errors = 0;
        $headers = [];

        try {
            while (($line = fgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");
                if (str_starts_with($line, '#')) {
                    continue;
                }

                $fields = explode("\t", $line);

                // Header row
                if (empty($headers)) {
                    $headers = $fields;

                    continue;
                }

                $total++;
                $row = array_combine($headers, $fields);
                if ($row === false) {
                    $errors++;

                    continue;
                }

                try {
                    $record = $this->mafRowToVariant($row, $upload);
                    GenomicVariant::create($record);
                    $inserted++;
                } catch (\Throwable $e) {
                    $errors++;
                    Log::warning('VcfParserService: MAF row error', [
                        'line' => $total + 1,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        } finally {
            fclose($fh);
        }

        return ['total' => $total, 'inserted' => $inserted, 'errors' => $errors];
    }

    /** @param array<string, string> $row @return array<string, mixed> */
    private function mafRowToVariant(array $row, GenomicUpload $upload): array
    {
        $gene = $row['Hugo_Symbol'] ?? $row['Gene'] ?? null;
        $chrom = ltrim($row['Chromosome'] ?? '', 'chr');
        $pos = (int) ($row['Start_Position'] ?? $row['Start_position'] ?? 0);
        $ref = $row['Reference_Allele'] ?? '';
        $alt = $row['Tumor_Seq_Allele2'] ?? $row['Alternate_Allele'] ?? '';
        $hgvsc = $row['HGVSc'] ?? null;
        $hgvsp = $row['HGVSp_Short'] ?? $row['HGVSp'] ?? null;
        $varClass = $row['Variant_Classification'] ?? null;
        $varType = $row['Variant_Type'] ?? $this->inferVariantType($ref, $alt);
        $af = isset($row['t_alt_count'], $row['t_depth']) && (int) $row['t_depth'] > 0
            ? round((int) $row['t_alt_count'] / (int) $row['t_depth'], 6)
            : null;
        $dp = isset($row['t_depth']) ? (int) $row['t_depth'] : null;

        $sourceValue = $gene && $hgvsc ? "{$gene}:{$hgvsc}" : ($gene ? "{$gene}:{$chrom}:{$pos}:{$ref}>{$alt}" : "{$chrom}:{$pos}:{$ref}>{$alt}");

        return [
            'upload_id' => $upload->id,
            'source_id' => $upload->source_id,
            'person_id' => null,
            'sample_id' => $row['Tumor_Sample_Barcode'] ?? $upload->sample_id,
            'chromosome' => $chrom,
            'position' => $pos,
            'reference_allele' => $ref,
            'alternate_allele' => $alt,
            'genome_build' => $upload->genome_build,
            'gene_symbol' => $gene,
            'hgvs_c' => $hgvsc,
            'hgvs_p' => $hgvsp,
            'variant_type' => $varType,
            'variant_class' => $varClass,
            'consequence' => $varClass,
            'quality' => null,
            'filter_status' => $row['FILTER'] ?? null,
            'zygosity' => null,
            'allele_frequency' => $af,
            'read_depth' => $dp,
            'clinvar_id' => $row['ClinVar_id'] ?? null,
            'clinvar_significance' => $row['CLIN_SIG'] ?? $row['ClinVar_Significance'] ?? null,
            'cosmic_id' => $row['COSMIC_id'] ?? null,
            'tmb_contribution' => null,
            'is_msi_marker' => false,
            'measurement_concept_id' => 0,
            'measurement_source_value' => $sourceValue,
            'value_as_concept_id' => null,
            'mapping_status' => 'unmapped',
            'omop_measurement_id' => null,
            'raw_info' => [],
        ];
    }
}
