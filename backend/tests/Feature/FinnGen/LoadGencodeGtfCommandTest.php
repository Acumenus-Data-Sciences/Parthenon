<?php

declare(strict_types=1);

/**
 * Phase 16-01 — `parthenon:load-gencode-gtf` Artisan feature tests.
 *
 * Invariants (per 16-01-PLAN Task 3 <behavior>):
 *   1. size_limit      — gz file > 100 MB rejected with D-29 error
 *   2. idempotency     — 2nd run without --force skips work when TSV fresh
 *   3. ssrf_guard      — --file path outside storage_path() is rejected
 *   4. chrom_normalize — "chr17" → "17", "chrM" → "MT"
 *   5. gene_filter     — only type=gene rows land in TSV
 *
 * All tests use --file=<path-under-storage> so no network fetch occurs.
 * The TSV output lives at storage/app/private/gencode/genes-v46.tsv — tests
 * clean it up afterward to avoid leaking state to sibling tests.
 *
 * NOTE: tests/Pest.php auto-extends Tests\TestCase for tests/Feature/**, so
 * this file does not declare `uses(TestCase::class)` explicitly.
 */
function gencodeStoragePath(string $rel): string
{
    return storage_path('app/private/gencode/'.$rel);
}

function writeFixtureGz(string $relPath, string $content): string
{
    $path = gencodeStoragePath($relPath);
    @mkdir(dirname($path), 0o755, true);
    file_put_contents($path, gzencode($content));

    return $path;
}

function cleanupGencodeArtifacts(): void
{
    @unlink(gencodeStoragePath('genes-v46.tsv'));
    @unlink(gencodeStoragePath('oversize.gff3.gz'));
    @unlink(gencodeStoragePath('fixture-small.gff3.gz'));
    @unlink(gencodeStoragePath('fixture-gene-filter.gff3.gz'));
}

beforeEach(function (): void {
    cleanupGencodeArtifacts();
});

afterAll(function (): void {
    cleanupGencodeArtifacts();
});

it('rejects a gz file over the 100 MB D-29 size limit', function (): void {
    $path = gencodeStoragePath('oversize.gff3.gz');
    @mkdir(dirname($path), 0o755, true);
    // Write exactly 100 MB + 1 byte of raw data — fopen + fwrite avoids
    // str_repeat allocating a huge string in memory.
    $fh = fopen($path, 'wb');
    expect($fh)->not->toBeFalse();
    $chunk = str_repeat("\0", 1024 * 1024); // 1 MB of zeros
    for ($i = 0; $i < 100; $i++) {
        fwrite($fh, $chunk);
    }
    fwrite($fh, "\x01"); // one extra byte pushes past the limit
    fclose($fh);

    expect(filesize($path))->toBeGreaterThan(100 * 1024 * 1024);

    expect(function () use ($path): void {
        $this->artisan('parthenon:load-gencode-gtf', ['--file' => $path])->run();
    })->toThrow(RuntimeException::class, 'D-29');
})->name('size_limit');

it('is idempotent: second invocation without --force exits 0 without work', function (): void {
    $tsv = gencodeStoragePath('genes-v46.tsv');
    @mkdir(dirname($tsv), 0o755, true);
    file_put_contents($tsv, "FAKE1\t1\t100\t200\t+\tprotein_coding\n");
    touch($tsv); // fresh mtime — inside the 30-day window

    $this->artisan('parthenon:load-gencode-gtf')
        ->assertExitCode(0)
        ->expectsOutputToContain('TSV exists');
})->name('idempotency');

it('rejects --file paths outside storage_path() via the SSRF guard', function (): void {
    expect(function (): void {
        $this->artisan('parthenon:load-gencode-gtf', ['--file' => '/etc/passwd'])->run();
    })->toThrow(RuntimeException::class, 'SSRF guard');
})->name('ssrf_guard');

it('normalizes chromosomes: strips chr prefix and maps chrM → MT', function (): void {
    $gz = writeFixtureGz(
        'fixture-small.gff3.gz',
        "##gff-version 3\n"
        ."chr17\tHAVANA\tgene\t100\t200\t.\t+\t.\tID=ENSG001;gene_name=TEST17;gene_type=protein_coding\n"
        ."chrM\tHAVANA\tgene\t1\t16569\t.\t+\t.\tID=ENSG002;gene_name=MT-ATP6;gene_type=Mt_tRNA\n"
    );

    $this->artisan('parthenon:load-gencode-gtf', ['--file' => $gz, '--force' => true])
        ->assertExitCode(0);

    $tsv = gencodeStoragePath('genes-v46.tsv');
    expect(is_file($tsv))->toBeTrue();
    $contents = (string) file_get_contents($tsv);

    expect($contents)->toContain("TEST17\t17\t100\t200\t+\tprotein_coding");
    expect($contents)->toContain("MT-ATP6\tMT\t1\t16569");
    expect($contents)->not->toContain("\tchr17\t");
    expect($contents)->not->toContain("\tchrM\t");
})->name('chrom_normalization');

it('filters to type=gene only — pseudogenes and non-gene features are skipped', function (): void {
    $gz = writeFixtureGz(
        'fixture-gene-filter.gff3.gz',
        "##gff-version 3\n"
        // gene — KEEP
        ."chr1\tHAVANA\tgene\t100\t200\t.\t+\t.\tID=ENSG001;gene_name=KEEPER;gene_type=protein_coding\n"
        // transcript (type != 'gene') — SKIP
        ."chr1\tHAVANA\ttranscript\t100\t200\t.\t+\t.\tID=ENST001;gene_name=SKIP_TRANSCRIPT;gene_type=protein_coding\n"
        // exon — SKIP
        ."chr1\tHAVANA\texon\t100\t200\t.\t+\t.\tID=EXN001;gene_name=SKIP_EXON;gene_type=protein_coding\n"
    );

    $this->artisan('parthenon:load-gencode-gtf', ['--file' => $gz, '--force' => true])
        ->assertExitCode(0);

    $tsv = gencodeStoragePath('genes-v46.tsv');
    $contents = (string) file_get_contents($tsv);

    expect($contents)->toContain('KEEPER');
    expect($contents)->not->toContain('SKIP_TRANSCRIPT');
    expect($contents)->not->toContain('SKIP_EXON');
    // Exactly one row emitted.
    expect(count(array_filter(explode("\n", $contents))))->toBe(1);
})->name('gene_type_filter');
