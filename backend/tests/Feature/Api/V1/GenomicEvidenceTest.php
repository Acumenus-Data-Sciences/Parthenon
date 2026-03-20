<?php

use App\Models\App\EvidencePin;
use App\Models\App\Investigation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('queries open targets via proxy', function () {
    Http::fake([
        'api.platform.opentargets.org/*' => Http::response([
            'data' => ['search' => ['hits' => []]],
        ]),
    ]);

    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $this->actingAs($user)
        ->postJson("/api/v1/investigations/{$inv->id}/genomic/query-opentargets", [
            'query_type' => 'gene',
            'term' => 'TCF7L2',
        ])
        ->assertStatus(200)
        ->assertJsonStructure(['data']);
});

it('queries gwas catalog via proxy', function () {
    Http::fake([
        'www.ebi.ac.uk/*' => Http::response([
            '_embedded' => ['efoTraits' => []],
            'page' => ['totalElements' => 0],
        ]),
    ]);

    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $this->actingAs($user)
        ->postJson("/api/v1/investigations/{$inv->id}/genomic/query-gwas-catalog", [
            'query_type' => 'trait',
            'term' => 'type 2 diabetes',
        ])
        ->assertStatus(200)
        ->assertJsonStructure(['data']);
});

it('uploads gwas summary stats file', function () {
    Storage::fake('local');

    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    $file = UploadedFile::fake()->createWithContent(
        'gwas.tsv',
        "chr\tpos\tref\talt\tbeta\tse\tp\n1\t12345\tA\tG\t0.5\t0.1\t1e-8\n"
    );

    $this->actingAs($user)
        ->postJson("/api/v1/investigations/{$inv->id}/genomic/upload-gwas", [
            'file' => $file,
        ])
        ->assertStatus(200)
        ->assertJsonPath('data.total_rows', 1)
        ->assertJsonPath('data.columns.0', 'chr');
});

it('resolves cross-links between pins', function () {
    $user = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $user->id, 'status' => 'active']);

    EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'phenotype',
        'section' => 'phenotype_definition',
        'finding_type' => 'cohort_summary',
        'finding_payload' => ['name' => 'T2DM'],
        'gene_symbols' => ['TCF7L2'],
    ]);

    EvidencePin::create([
        'investigation_id' => $inv->id,
        'domain' => 'genomic',
        'section' => 'genomic_evidence',
        'finding_type' => 'gwas_locus',
        'finding_payload' => ['gene' => 'TCF7L2'],
        'gene_symbols' => ['TCF7L2'],
    ]);

    $response = $this->actingAs($user)
        ->getJson("/api/v1/investigations/{$inv->id}/cross-links");

    $response->assertStatus(200);

    $links = $response->json('data');
    expect(count($links))->toBeGreaterThan(0);
});

it('blocks other user from genomic endpoints', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $inv = Investigation::create(['title' => 'Test', 'owner_id' => $owner->id, 'status' => 'active']);

    $this->actingAs($other)
        ->postJson("/api/v1/investigations/{$inv->id}/genomic/query-opentargets", [
            'query_type' => 'gene',
            'term' => 'BRCA2',
        ])
        ->assertStatus(403);
});
