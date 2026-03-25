<?php

namespace App\Console\Commands;

use App\Models\App\GenomicUpload;
use App\Models\App\GenomicVariant;
use App\Models\App\ImagingStudy;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SeedMbuPatient extends Command
{
    protected $signature = 'mbu:seed-genomics
                            {--force : Re-seed even if data already exists}';

    protected $description = 'Seed Dr. M.B. Udoshi (person_id=1005788) Foundation Medicine genomic variants and verify DICOM imaging';

    private const PERSON_ID = 1005788;

    private const SOURCE_ID = 47; // OHDSI Acumenus CDM

    private const FMI_CASE = 'TRF091836';

    public function handle(): int
    {
        $this->info('MBU Patient Data Seed — person_id='.self::PERSON_ID);
        $this->newLine();

        $this->seedGenomicVariants();
        $this->checkImagingStudies();

        $this->newLine();
        $this->info('Done.');

        return Command::SUCCESS;
    }

    private function seedGenomicVariants(): void
    {
        $existing = GenomicVariant::where('person_id', self::PERSON_ID)->count();

        if ($existing > 0 && ! $this->option('force')) {
            $this->info("Genomic variants: {$existing} already exist (use --force to re-seed)");

            return;
        }

        if ($existing > 0) {
            GenomicVariant::where('person_id', self::PERSON_ID)->delete();
            $this->warn("Deleted {$existing} existing variants");
        }

        $adminId = User::where('email', 'admin@acumenus.net')->first()?->id ?? 1;
        $now = now()->toDateTimeString();

        // Create or find the FoundationOne upload record
        $upload = GenomicUpload::firstOrCreate(
            ['filename' => self::FMI_CASE.'.pdf', 'source_id' => self::SOURCE_ID],
            [
                'created_by' => $adminId,
                'file_format' => 'foundation_one',
                'file_size_bytes' => 589381,
                'status' => 'mapped',
                'genome_build' => 'GRCh37',
                'sample_id' => self::FMI_CASE,
                'total_variants' => 4,
                'mapped_variants' => 4,
                'review_required' => 0,
                'storage_path' => 'docs/MBU/'.self::FMI_CASE.'.pdf',
                'parsed_at' => $now,
            ]
        );

        $base = [
            'upload_id' => $upload->id,
            'source_id' => self::SOURCE_ID,
            'person_id' => self::PERSON_ID,
            'sample_id' => self::FMI_CASE,
            'genome_build' => 'GRCh37',
            'filter_status' => 'PASS',
            'is_msi_marker' => false,
            'measurement_concept_id' => 0,
            'mapping_status' => 'mapped',
        ];

        $reportMeta = fn (array $extra = []) => json_encode(array_merge([
            'report' => 'FoundationOne',
            'fmi_case' => self::FMI_CASE,
            'report_date' => '2015-05-23',
            'tumor_type' => 'Colon adenocarcinoma (CRC)',
        ], $extra));

        $variants = [
            // KRAS G12D — Pathogenic, resistance to Cetuximab/Panitumumab
            array_merge($base, [
                'chromosome' => '12', 'position' => 25245350,
                'reference_allele' => 'C', 'alternate_allele' => 'T',
                'gene_symbol' => 'KRAS', 'hgvs_c' => 'c.35G>A', 'hgvs_p' => 'p.G12D',
                'variant_type' => 'SNP', 'variant_class' => 'missense_variant',
                'consequence' => 'missense_variant', 'zygosity' => 'heterozygous',
                'clinvar_id' => '12583', 'clinvar_significance' => 'Pathogenic',
                'cosmic_id' => 'COSV55497362',
                'measurement_source_value' => 'KRAS:c.35G>A',
                'raw_info' => $reportMeta([
                    'specimen_date' => '2012-03-06',
                    'therapeutic_implications' => [
                        'resistance' => ['Cetuximab', 'Panitumumab'],
                        'potential_benefit' => ['Trametinib'],
                    ],
                ]),
            ]),
            // TP53 R282W — Pathogenic
            array_merge($base, [
                'chromosome' => '17', 'position' => 7577094,
                'reference_allele' => 'G', 'alternate_allele' => 'A',
                'gene_symbol' => 'TP53', 'hgvs_c' => 'c.844C>T', 'hgvs_p' => 'p.R282W',
                'variant_type' => 'SNP', 'variant_class' => 'missense_variant',
                'consequence' => 'missense_variant', 'zygosity' => 'heterozygous',
                'clinvar_id' => '12356', 'clinvar_significance' => 'Pathogenic',
                'cosmic_id' => 'COSV52661579',
                'measurement_source_value' => 'TP53:c.844C>T',
                'raw_info' => $reportMeta(),
            ]),
            // APC S1281* — Pathogenic (truncating)
            array_merge($base, [
                'chromosome' => '5', 'position' => 112175951,
                'reference_allele' => 'C', 'alternate_allele' => 'A',
                'gene_symbol' => 'APC', 'hgvs_c' => 'c.3841C>T', 'hgvs_p' => 'p.S1281*',
                'variant_type' => 'SNP', 'variant_class' => 'stop_gained',
                'consequence' => 'stop_gained', 'zygosity' => 'heterozygous',
                'clinvar_id' => '180988', 'clinvar_significance' => 'Pathogenic',
                'cosmic_id' => 'COSV61857814',
                'measurement_source_value' => 'APC:c.3841C>T',
                'raw_info' => $reportMeta(),
            ]),
            // SETD2 rearrangement exon 12 — Likely pathogenic
            array_merge($base, [
                'chromosome' => '3', 'position' => 47162350,
                'reference_allele' => 'N', 'alternate_allele' => 'rearrangement',
                'gene_symbol' => 'SETD2', 'hgvs_c' => 'rearrangement exon 12', 'hgvs_p' => null,
                'variant_type' => 'SV', 'variant_class' => 'rearrangement',
                'consequence' => 'rearrangement', 'zygosity' => null,
                'clinvar_significance' => 'Likely pathogenic',
                'measurement_source_value' => 'SETD2:rearrangement exon 12',
                'raw_info' => $reportMeta(),
            ]),
        ];

        foreach ($variants as $v) {
            DB::table('app.genomic_variants')->insert($v);
        }

        $this->info('Genomic variants: inserted 4 from FoundationOne report '.self::FMI_CASE);
        $this->table(
            ['Gene', 'Alteration', 'Significance'],
            [
                ['KRAS', 'G12D', 'Pathogenic'],
                ['TP53', 'R282W', 'Pathogenic'],
                ['APC', 'S1281*', 'Pathogenic'],
                ['SETD2', 'rearrangement exon 12', 'Likely pathogenic'],
            ]
        );
    }

    private function checkImagingStudies(): void
    {
        $count = ImagingStudy::where('person_id', self::PERSON_ID)->count();

        if ($count > 0) {
            $this->info("Imaging studies: {$count} already linked");
        } else {
            $this->warn('Imaging studies: 0 linked — run: php artisan imaging:import-samples --dir=docs/MBU/DICOM --source=47 --person-id=1005788');
            $this->warn('  Note: docs/MBU must be mounted in the PHP container (add volume in docker-compose.yml)');
        }
    }
}
