<?php

declare(strict_types=1);

use App\Services\FinnGen\FinnGenConceptResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('prefers STCM target_concept_id over LIKE-ANY for ICD10_FIN source codes', function () {
    // Arrange — seed a curated STCM row for an ICD-10-FI extension code that
    // also exists in vocab.concept (so LIKE-ANY would return something different).
    DB::connection('vocab')->table('vocab.source_to_concept_map')->insert([
        'source_code' => 'X99',
        'source_concept_id' => 0,
        'source_vocabulary_id' => 'ICD10_FIN',
        'source_code_description' => 'Test fixture',
        'target_concept_id' => 4329847, // standard SNOMED concept id
        'target_vocabulary_id' => 'SNOMED',
        'valid_start_date' => '1970-01-01',
        'valid_end_date' => '2099-12-31',
        'invalid_reason' => null,
    ]);

    $resolver = app(FinnGenConceptResolver::class);
    $result = $resolver->resolveIcd10(['X99']);

    expect($result['standard'])->toContain(4329847);
});
