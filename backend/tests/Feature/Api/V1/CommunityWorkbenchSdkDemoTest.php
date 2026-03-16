<?php

it('returns the community workbench sdk demo payload', function () {
    $this->withoutMiddleware();

    $this->getJson('/api/v1/study-agent/community-workbench-sdk/demo')
        ->assertOk()
        ->assertJsonPath('data.service_descriptor.service_name', 'community_variant_browser')
        ->assertJsonPath('data.result_envelope.summary.tool_id', 'community_variant_browser')
        ->assertJsonPath('data.generated_sample.path', 'community-workbench-sdk/generated-samples/community_variant_browser');
});

it('appends the community workbench sdk sample tool to study agent services', function () {
    $this->withoutMiddleware();

    \Illuminate\Support\Facades\Http::fake([
        '*' => \Illuminate\Support\Facades\Http::response([
            'services' => [
                [
                    'name' => 'finngen_romopapi',
                    'endpoint' => '/flows/finngen/romopapi',
                    'implemented' => true,
                    'ui_hints' => [
                        'title' => 'ROMOPAPI',
                        'summary' => 'OMOP query exploration.',
                    ],
                ],
            ],
            'warnings' => [],
        ], 200),
    ]);

    $this->getJson('/api/v1/study-agent/services')
        ->assertOk()
        ->assertJsonPath('data.services.1.name', 'community_variant_browser')
        ->assertJsonPath('data.services.1.implemented', true);
});
