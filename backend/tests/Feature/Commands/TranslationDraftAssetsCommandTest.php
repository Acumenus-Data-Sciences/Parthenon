<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

function makeTranslationAssetBundle(array $frontendRows, array $helpRows = []): array
{
    $root = sys_get_temp_dir().'/parthenon-translation-assets-'.Str::uuid();
    File::ensureDirectoryExists($root.'/frontend');
    File::ensureDirectoryExists($root.'/help');

    file_put_contents($root.'/manifest.json', json_encode([
        'sourceLocale' => 'en-US',
        'targetLocales' => ['es-ES', 'ko-KR'],
        'assetGroups' => ['frontend', 'help'],
        'locales' => [
            ['code' => 'en-US'],
            ['code' => 'es-ES'],
            ['code' => 'ko-KR'],
        ],
    ], JSON_PRETTY_PRINT));
    file_put_contents($root.'/frontend/messages.json', json_encode($frontendRows, JSON_PRETTY_PRINT));
    file_put_contents($root.'/help/messages.json', json_encode($helpRows, JSON_PRETTY_PRINT));

    return [$root, $root.'-drafts'];
}

it('drafts missing asset rows through the local translation provider', function () {
    [$input, $output] = makeTranslationAssetBundle([
        [
            'asset_id' => 'frontend.dashboard.title',
            'area' => 'frontend',
            'namespace' => 'dashboard',
            'key' => 'title',
            'source_locale' => 'en-US',
            'target_locale' => 'es-ES',
            'source_text' => 'Dashboard',
            'target_text' => '',
            'status' => 'missing',
            'source_path' => 'frontend/src/i18n/resources.ts',
        ],
        [
            'asset_id' => 'frontend.dashboard.subtitle',
            'area' => 'frontend',
            'namespace' => 'dashboard',
            'key' => 'subtitle',
            'source_locale' => 'en-US',
            'target_locale' => 'es-ES',
            'source_text' => 'Overview',
            'target_text' => 'Resumen',
            'status' => 'ready',
            'source_path' => 'frontend/src/i18n/resources.ts',
        ],
    ]);

    $this->artisan("translation:draft-assets --input={$input} --output={$output} --only=frontend --locales=es-ES")
        ->expectsOutputToContain('Translation provider draft complete.')
        ->expectsOutputToContain('Candidate rows: 1')
        ->assertExitCode(0);

    $rows = json_decode(file_get_contents($output.'/frontend/messages.json'), true);
    $report = json_decode(file_get_contents($output.'/provider-draft-report.json'), true);

    expect($rows)->toHaveCount(1)
        ->and($rows[0]['target_text'])->toBe('Dashboard')
        ->and($rows[0]['provider_status'])->toBe('source_fallback')
        ->and($rows[0]['review_passed'])->toBeTrue()
        ->and($report['totals']['warnings'])->toBe(1);
});

it('can fail when provider review detects placeholder violations', function () {
    [$input, $output] = makeTranslationAssetBundle([
        [
            'asset_id' => 'frontend.commons.count',
            'area' => 'frontend',
            'namespace' => 'commons',
            'key' => 'count',
            'source_locale' => 'en-US',
            'target_locale' => 'ko-KR',
            'source_text' => 'Review {{count}} messages by :date.',
            'target_text' => '메시지를 검토하세요.',
            'status' => 'ready',
            'source_path' => 'frontend/src/i18n/resources.ts',
        ],
    ]);

    $this->artisan("translation:draft-assets --input={$input} --output={$output} --only=frontend --locales=ko-KR --all --fail-on-review")
        ->expectsOutputToContain('Review failures: 1')
        ->assertExitCode(1);

    $rows = json_decode(file_get_contents($output.'/frontend/messages.json'), true);

    expect($rows[0]['review_passed'])->toBeFalse()
        ->and($rows[0]['review_violations'][0]['type'])->toBe('placeholder-mismatch');
});
