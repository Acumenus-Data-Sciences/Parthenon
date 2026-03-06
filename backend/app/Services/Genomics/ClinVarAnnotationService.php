<?php

namespace App\Services\Genomics;

use App\Models\App\ClinVarVariant;
use App\Models\App\GenomicUpload;
use App\Models\App\GenomicVariant;
use Illuminate\Support\Facades\DB;

/**
 * Cross-references an uploaded VCF/MAF's variants against the local ClinVar cache
 * and fills in clinvar_id, clinvar_significance, clinvar_disease, and clinvar_review_status
 * for any rows that are currently null.
 */
class ClinVarAnnotationService
{
    private const BATCH = 500;

    /**
     * Annotate all variants in an upload that lack ClinVar data.
     * Uses a single SQL JOIN UPDATE for performance on large uploads.
     *
     * @return array{annotated: int, skipped: int}
     */
    public function annotateUpload(GenomicUpload $upload): array
    {
        $annotated = DB::update("
            UPDATE app.genomic_variants gv
            SET
                clinvar_id = COALESCE(cv.variation_id, cv.rs_id),
                clinvar_significance = cv.clinical_significance,
                clinvar_disease = cv.disease_name,
                clinvar_review_status = cv.review_status,
                gene_symbol = CASE WHEN gv.gene_symbol IS NULL THEN cv.gene_symbol ELSE gv.gene_symbol END,
                mapping_status = CASE
                    WHEN cv.clinical_significance IN ('Uncertain significance', 'Conflicting classifications of pathogenicity')
                    THEN 'review'
                    ELSE 'mapped'
                END,
                updated_at = NOW()
            FROM app.clinvar_variants cv
            WHERE gv.upload_id = ?
              AND gv.chromosome = cv.chromosome
              AND gv.position = cv.position
              AND gv.reference_allele = cv.reference_allele
              AND gv.alternate_allele = cv.alternate_allele
              AND gv.clinvar_significance IS NULL
        ", [$upload->id]);

        $total = GenomicVariant::where('upload_id', $upload->id)->count();

        return ['annotated' => $annotated, 'skipped' => $total - $annotated];
    }

    /**
     * Lookup a batch of GenomicVariant models against clinvar_variants.
     *
     * Returns a map keyed by "chr:pos:ref:alt" → ClinVarVariant.
     *
     * @param GenomicVariant[] $variants
     * @return array<string, ClinVarVariant>
     */
    private function lookupBatch(array $variants): array
    {
        if (empty($variants)) {
            return [];
        }

        // Collect distinct coordinates
        $coords = [];
        foreach ($variants as $v) {
            $coords[] = [
                'chromosome'       => $v->chromosome,
                'position'         => $v->position,
                'reference_allele' => $v->reference_allele,
                'alternate_allele' => $v->alternate_allele,
            ];
        }

        // Build an OR-clause query
        $query = ClinVarVariant::query();
        $first = true;
        foreach ($coords as $c) {
            $method = $first ? 'where' : 'orWhere';
            $query->$method(function ($q) use ($c) {
                $q->where('chromosome', $c['chromosome'])
                  ->where('position', $c['position'])
                  ->where('reference_allele', $c['reference_allele'])
                  ->where('alternate_allele', $c['alternate_allele']);
            });
            $first = false;
        }

        $results = $query->get();

        $map = [];
        foreach ($results as $cv) {
            $key = $cv->chromosome . ':' . $cv->position . ':' . $cv->reference_allele . ':' . $cv->alternate_allele;
            $map[$key] = $cv;
        }
        return $map;
    }

    private function coordKey(GenomicVariant $v): string
    {
        return $v->chromosome . ':' . $v->position . ':' . $v->reference_allele . ':' . $v->alternate_allele;
    }
}
