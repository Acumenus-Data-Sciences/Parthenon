<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;

it('finngen:scan-coverage-profile --dry-run emits a baseline JSON with the required keys', function () {
    Artisan::call('finngen:scan-coverage-profile', ['--dry-run' => true]);

    $files = glob(storage_path('app/finngen-endpoints/phase13-baseline-*.json'));
    expect($files)->not->toBeEmpty();

    $latest = end($files);
    $payload = json_decode((string) file_get_contents($latest), true);

    expect($payload)->toHaveKeys([
        'total_endpoints',
        'coverage_profile_distribution',
        'coverage_bucket_distribution',
        'invariant_violations',
        'baseline_unmapped_count',
        'top_lifted_vocabularies',
        'generated_at',
    ]);
});
