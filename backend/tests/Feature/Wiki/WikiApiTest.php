<?php

use App\Models\User;
use App\Services\AiService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Response;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
});

function wikiUser(string $role): User
{
    $user = User::factory()->create();
    $user->assignRole($role);

    return $user;
}

function fakeAiResponse(array $payload, int $status = 200): Response
{
    $response = Mockery::mock(Response::class);
    $response->shouldReceive('json')->andReturn($payload);
    $response->shouldReceive('status')->andReturn($status);

    return $response;
}

test('viewer can list wiki workspaces', function () {
    $this->app->bind(AiService::class, function () {
        $mock = Mockery::mock(AiService::class);
        $mock->shouldReceive('wikiWorkspaces')
            ->once()
            ->andReturn(fakeAiResponse([
                'workspaces' => [
                    ['name' => 'platform', 'branch' => 'main', 'page_count' => 2],
                ],
            ]));

        return $mock;
    });

    $this->actingAs(wikiUser('viewer'))
        ->getJson('/api/v1/wiki/workspaces')
        ->assertOk()
        ->assertJsonPath('workspaces.0.name', 'platform');
});

test('viewer cannot ingest wiki content', function () {
    $this->actingAs(wikiUser('viewer'))
        ->postJson('/api/v1/wiki/ingest', [
            'workspace' => 'platform',
            'raw_content' => 'Body',
        ])
        ->assertStatus(403);
});

test('researcher can query wiki', function () {
    $this->app->bind(AiService::class, function () {
        $mock = Mockery::mock(AiService::class);
        $mock->shouldReceive('wikiQuery')
            ->once()
            ->with('platform', 'What changed?', 'paper-methods', 'paper-a')
            ->andReturn(fakeAiResponse([
                'workspace' => 'platform',
                'answer' => 'Answer',
                'citations' => [],
            ]));

        return $mock;
    });

    $this->actingAs(wikiUser('researcher'))
        ->postJson('/api/v1/wiki/query', [
            'workspace' => 'platform',
            'question' => 'What changed?',
            'page_slug' => 'paper-methods',
            'source_slug' => 'paper-a',
        ])
        ->assertOk()
        ->assertJsonPath('answer', 'Answer');
});

test('admin can initialize a workspace', function () {
    $this->app->bind(AiService::class, function () {
        $mock = Mockery::mock(AiService::class);
        $mock->shouldReceive('wikiInitWorkspace')
            ->once()
            ->with('study-team')
            ->andReturn(fakeAiResponse([
                'workspace' => [
                    'name' => 'study-team',
                    'branch' => 'main',
                    'page_count' => 0,
                ],
            ]));

        return $mock;
    });

    $this->actingAs(wikiUser('admin'))
        ->postJson('/api/v1/wiki/workspaces/study-team/init')
        ->assertOk()
        ->assertJsonPath('workspace.name', 'study-team');
});
