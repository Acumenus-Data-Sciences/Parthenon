<?php

namespace App\Console\Commands;

use App\Models\App\GenomicUpload;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportVcfSamples extends Command
{
    protected $signature = 'genomics:import-vcf
        {--dir=vcf/giab_NISTv4.2.1 : Directory relative to project root}
        {--source=9 : Source ID}
        {--batch=500 : Insert batch size}
        {--limit=0 : Max variants per file (0 = unlimited)}
        {--pass-only : Only import PASS filter variants}';

    protected $description = 'Import local VCF files into genomic_uploads + genomic_variants (batched)';

    public function handle(): int
    {
        $dir = base_path($this->option('dir'));
        $sourceId = (int) $this->option('source');
        $batchSize = (int) $this->option('batch');
        $limit = (int) $this->option('limit');
        $passOnly = $this->option('pass-only');

        if (!is_dir($dir)) {
            $this->error("Directory not found: {$dir}");
            return 1;
        }

        $files = glob($dir . '/*.vcf') ?: [];
        sort($files);

        if (empty($files)) {
            $this->error("No .vcf files found in {$dir}");
            return 1;
        }

        $this->info("Found " . count($files) . " VCF file(s) in {$dir}");
        $adminId = User::where('email', 'like', '%admin%')->first()?->id ?? 1;

        foreach ($files as $filePath) {
            $filename = basename($filePath);
            $fileSize = filesize($filePath);

            $existing = GenomicUpload::where('filename', $filename)
                ->where('source_id', $sourceId)
                ->where('status', '!=', 'failed')
                ->first();

            if ($existing) {
                $this->warn("  Skipping {$filename} — already imported (upload #{$existing->id})");
                continue;
            }

            $genomeBuild = $this->detectGenomeBuild($filePath);
            $sampleId = $this->extractSampleId($filePath) ?? pathinfo($filename, PATHINFO_FILENAME);

            $this->info("Importing {$filename} (" . $this->formatBytes($fileSize) . ", build={$genomeBuild}, sample={$sampleId})");

            $upload = GenomicUpload::create([
                'source_id' => $sourceId,
                'created_by' => $adminId,
                'filename' => $filename,
                'file_format' => 'vcf',
                'file_size_bytes' => $fileSize,
                'status' => 'parsing',
                'genome_build' => $genomeBuild,
                'sample_id' => $sampleId,
                'total_variants' => 0,
                'mapped_variants' => 0,
                'review_required' => 0,
                'storage_path' => str_replace(base_path() . '/', '', $filePath),
            ]);

            try {
                $result = $this->parseVcfBatched($upload, $filePath, $batchSize, $limit, $passOnly);
                $upload->update([
                    'status' => 'mapped',
                    'total_variants' => $result['inserted'],
                    'parsed_at' => now(),
                ]);
                $this->info("  Done: {$result['inserted']} variants inserted, {$result['errors']} errors, {$result['skipped']} skipped");
            } catch (\Throwable $e) {
                $upload->update(['status' => 'failed', 'error_message' => substr($e->getMessage(), 0, 500)]);
                $this->error("  FAILED: {$e->getMessage()}");
            }
        }

        $this->info('All imports complete.');
        return 0;
    }

    private function detectGenomeBuild(string $filePath): string
    {
        $fh = fopen($filePath, 'r');
        $build = 'GRCh38';
        $n = 0;
        while (($line = fgets($fh)) !== false && $n++ < 200) {
            if (!str_starts_with($line, '##')) break;
            $lower = strtolower($line);
            if (str_contains($lower, 'grch38') || str_contains($lower, 'hg38')) { $build = 'GRCh38'; break; }
            if (str_contains($lower, 'grch37') || str_contains($lower, 'hg19')) { $build = 'GRCh37'; break; }
        }
        fclose($fh);
        return $build;
    }

    private function extractSampleId(string $filePath): ?string
    {
        $fh = fopen($filePath, 'r');
        $sampleId = null;
        while (($line = fgets($fh)) !== false) {
            if (str_starts_with($line, '#CHROM')) {
                $cols = explode("\t", rtrim($line, "\r\n"));
                $fi = array_search('FORMAT', $cols, true);
                if ($fi !== false && isset($cols[$fi + 1])) $sampleId = $cols[$fi + 1];
                break;
            }
            if (!str_starts_with($line, '#')) break;
        }
        fclose($fh);
        return $sampleId;
    }

    private function parseVcfBatched(GenomicUpload $upload, string $filePath, int $batchSize, int $limit, bool $passOnly): array
    {
        $fh = fopen($filePath, 'r');
        if ($fh === false) throw new \RuntimeException("Cannot open: {$filePath}");

        $total = 0; $inserted = 0; $errors = 0; $skipped = 0;
        $batch = []; $sampleColumns = []; $now = now()->toDateTimeString();

        try {
            while (($line = fgets($fh)) !== false) {
                $line = rtrim($line, "\r\n");
                if (str_starts_with($line, '##')) continue;
                if (str_starts_with($line, '#CHROM')) {
                    $cols = explode("\t", ltrim($line, '#'));
                    $fi = array_search('FORMAT', $cols, true);
                    if ($fi !== false) $sampleColumns = array_slice($cols, $fi + 1);
                    continue;
                }

                $fields = explode("\t", $line);
                if (count($fields) < 5) continue;
                $total++;

                if ($passOnly && isset($fields[6]) && $fields[6] !== 'PASS' && $fields[6] !== '.') {
                    $skipped++;
                    continue;
                }

                try {
                    $batch[] = $this->buildRecord($fields, $sampleColumns, $upload, $now);
                    if (count($batch) >= $batchSize) {
                        DB::table('genomic_variants')->insert($batch);
                        $inserted += count($batch);
                        $batch = [];
                        if ($total % 100000 === 0) {
                            $this->output->write("\r  Processed: " . number_format($total) . " lines, " . number_format($inserted) . " inserted...");
                        }
                    }
                    if ($limit > 0 && $inserted >= $limit) break;
                } catch (\Throwable $e) { $errors++; }
            }

            if (!empty($batch)) {
                DB::table('genomic_variants')->insert($batch);
                $inserted += count($batch);
            }
            $this->output->writeln('');
        } finally {
            fclose($fh);
        }

        return ['total' => $total, 'inserted' => $inserted, 'errors' => $errors, 'skipped' => $skipped];
    }

    private function buildRecord(array $fields, array $sampleColumns, GenomicUpload $upload, string $now): array
    {
        [$chrom, $pos, , $ref, $alt] = $fields;
        $qual = isset($fields[5]) && $fields[5] !== '.' ? (float) $fields[5] : null;
        $filter = $fields[6] ?? null;
        $infoStr = $fields[7] ?? '';
        $formatStr = $fields[8] ?? '';
        $sampleStr = $fields[9] ?? '';

        $info = $this->parseInfo($infoStr);
        $ann = $this->parseAnnotation($info);
        [$zygosity, $af, $dp] = $this->parseGenotype($formatStr, $sampleStr);

        $chrom = ltrim($chrom, 'chr');
        $gene = $ann['gene'];
        $hgvsc = $ann['hgvs_c'];

        if ($gene && $hgvsc) $sv = "{$gene}:{$hgvsc}";
        elseif ($gene) $sv = "{$gene}:{$chrom}:{$pos}:{$ref}>{$alt}";
        else $sv = "{$chrom}:{$pos}:{$ref}>{$alt}";

        return [
            'upload_id' => $upload->id, 'source_id' => $upload->source_id, 'person_id' => null,
            'sample_id' => $sampleColumns[0] ?? $upload->sample_id,
            'chromosome' => $chrom, 'position' => (int) $pos,
            'reference_allele' => $ref, 'alternate_allele' => $alt,
            'genome_build' => $upload->genome_build,
            'gene_symbol' => $gene, 'hgvs_c' => $hgvsc, 'hgvs_p' => $ann['hgvs_p'],
            'variant_type' => $ann['variant_type'] ?? $this->inferVariantType($ref, $alt),
            'variant_class' => $ann['variant_class'], 'consequence' => $ann['consequence'],
            'quality' => $qual, 'filter_status' => $filter,
            'zygosity' => $zygosity,
            'allele_frequency' => $af ?? (isset($info['AF']) ? (float) $info['AF'] : null),
            'read_depth' => $dp ?? (isset($info['DP']) ? (int) $info['DP'] : null),
            'clinvar_id' => $info['CLNID'] ?? $info['RS'] ?? null,
            'clinvar_significance' => isset($info['CLNSIG']) ? explode('|', str_replace('_', ' ', $info['CLNSIG']))[0] : null,
            'cosmic_id' => $info['COSMIC'] ?? $info['COSV'] ?? null,
            'tmb_contribution' => null, 'is_msi_marker' => false,
            'measurement_concept_id' => 0,
            'measurement_source_value' => substr($sv, 0, 255),
            'value_as_concept_id' => null, 'mapping_status' => 'unmapped',
            'omop_measurement_id' => null, 'raw_info' => '{}',
            'created_at' => $now, 'updated_at' => $now,
        ];
    }

    private function parseInfo(string $s): array
    {
        $info = [];
        foreach (explode(';', $s) as $p) {
            if (str_contains($p, '=')) { [$k, $v] = explode('=', $p, 2); $info[trim($k)] = trim($v); }
            elseif (trim($p) !== '') $info[trim($p)] = 'true';
        }
        return $info;
    }

    private function parseAnnotation(array $info): array
    {
        $empty = ['gene' => null, 'variant_class' => null, 'consequence' => null, 'hgvs_c' => null, 'hgvs_p' => null, 'variant_type' => null];
        if (isset($info['ANN'])) {
            $p = explode('|', explode(',', $info['ANN'])[0]);
            return ['gene' => $p[3] ?? null, 'variant_class' => $p[1] ?? null, 'consequence' => $p[1] ?? null,
                'hgvs_c' => ($p[9] ?? '') !== '' ? $p[9] : null, 'hgvs_p' => ($p[10] ?? '') !== '' ? $p[10] : null, 'variant_type' => null];
        }
        if (isset($info['CSQ'])) {
            $p = explode('|', explode(',', $info['CSQ'])[0]);
            return ['gene' => $p[3] ?? null, 'variant_class' => $p[1] ?? null, 'consequence' => $p[1] ?? null,
                'hgvs_c' => $p[10] ?? null, 'hgvs_p' => $p[11] ?? null, 'variant_type' => null];
        }
        return $empty;
    }

    private function parseGenotype(string $fmt, string $smp): array
    {
        if ($fmt === '' || $smp === '') return [null, null, null];
        $ff = explode(':', $fmt); $sf = explode(':', $smp);
        $data = @array_combine($ff, $sf);
        if ($data === false) return [null, null, null];

        $zyg = null;
        if (isset($data['GT'])) {
            $al = preg_split('/[\/|]/', $data['GT']);
            if ($al !== false) { $al = array_filter($al, fn($a) => $a !== '.'); $u = array_unique($al);
                if (count($al) > 0) $zyg = count($u) === 1 ? 'homozygous' : 'heterozygous'; }
        }
        $af = null;
        if (isset($data['AF'])) $af = (float) $data['AF'];
        elseif (isset($data['AD'])) { $ads = array_map('intval', explode(',', $data['AD']));
            $t = array_sum($ads); if ($t > 0 && count($ads) >= 2) $af = round($ads[1] / $t, 6); }
        return [$zyg, $af, isset($data['DP']) ? (int) $data['DP'] : null];
    }

    private function inferVariantType(string $ref, string $alt): string
    {
        if (strlen($ref) === strlen($alt)) return strlen($ref) === 1 ? 'SNP' : 'MNP';
        return strlen($ref) < strlen($alt) ? 'INS' : 'DEL';
    }

    private function formatBytes(int $b): string
    {
        if ($b >= 1073741824) return round($b / 1073741824, 1) . ' GB';
        if ($b >= 1048576) return round($b / 1048576, 1) . ' MB';
        return round($b / 1024, 1) . ' KB';
    }
}
