<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Models\App\PacsConnection;
use App\Services\Imaging\PacsConnectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PacsConnectionServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        $this->unsetEnv('ORTHANC_USER');
        $this->unsetEnv('ORTHANC_PASSWORD');

        parent::tearDown();
    }

    public function test_orthanc_connection_test_uses_runtime_env_credentials(): void
    {
        $this->setEnv('ORTHANC_USER', 'env-user');
        $this->setEnv('ORTHANC_PASSWORD', 'env-pass');

        $connection = $this->createOrthancConnectionWithStaleCredentials();
        $expectedAuth = 'Basic '.base64_encode('env-user:env-pass');

        Http::fake(function (Request $request) use ($expectedAuth) {
            $this->assertSame($expectedAuth, $request->header('Authorization')[0] ?? null);
            $this->assertSame('http://orthanc:8042/dicom-web/studies?limit=1', $request->url());

            return Http::response([], 200);
        });

        $result = app(PacsConnectionService::class)->testConnection($connection);

        $this->assertTrue($result['success']);
        $this->assertSame('ok', $connection->refresh()->last_health_status);
    }

    public function test_orthanc_stats_refresh_uses_runtime_env_credentials(): void
    {
        $this->setEnv('ORTHANC_USER', 'env-user');
        $this->setEnv('ORTHANC_PASSWORD', 'env-pass');

        $connection = $this->createOrthancConnectionWithStaleCredentials();
        $expectedAuth = 'Basic '.base64_encode('env-user:env-pass');

        Http::fake(function (Request $request) use ($expectedAuth) {
            $this->assertSame($expectedAuth, $request->header('Authorization')[0] ?? null);

            if (str_contains($request->url(), '/statistics')) {
                return Http::response([
                    'CountPatients' => 2,
                    'CountStudies' => 3,
                    'CountSeries' => 4,
                    'CountInstances' => 5,
                    'TotalDiskSizeMB' => 6,
                ], 200);
            }

            if (str_contains($request->url(), '/series')) {
                return Http::response([
                    ['MainDicomTags' => ['Modality' => 'CT']],
                    ['MainDicomTags' => ['Modality' => 'MR']],
                ], 200);
            }

            return Http::response([], 404);
        });

        $result = app(PacsConnectionService::class)->refreshStats($connection);

        $this->assertTrue($result['success']);
        $this->assertSame(3, $connection->refresh()->metadata_cache['count_studies']);
        $this->assertSame(['CT' => 1, 'MR' => 1], $connection->metadata_cache['modalities']);
    }

    private function createOrthancConnectionWithStaleCredentials(): PacsConnection
    {
        return PacsConnection::create([
            'name' => 'Local Orthanc',
            'type' => 'orthanc',
            'base_url' => 'http://orthanc:8042/dicom-web',
            'auth_type' => 'basic',
            'credentials' => [
                'username' => 'env-user',
                'password' => 'stale-db-pass',
            ],
            'is_default' => true,
            'is_active' => true,
        ]);
    }

    private function setEnv(string $key, string $value): void
    {
        putenv("{$key}={$value}");
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    private function unsetEnv(string $key): void
    {
        putenv($key);
        unset($_ENV[$key], $_SERVER[$key]);
    }
}
