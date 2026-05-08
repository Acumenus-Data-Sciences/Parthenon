<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Services\Templates\TemplatePresenter;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TemplatePresenterTest extends TestCase
{
    #[Test]
    public function manifest_flattens_kubernetes_style_payload(): void
    {
        $upstream = [
            'apiVersion' => 'parthenon.acumenus.net/v1',
            'kind' => 'Template',
            'metadata' => [
                'id' => 'hello_cdm',
                'name' => 'Hello CDM',
                'version' => '0.1.0',
                'category' => 'ingestion',
                'cdm_versions' => ['5.4'],
                'tags' => ['demo', 'bootstrap'],
                'singleton' => false,
                'description' => 'Boots a tiny CDM and inserts one PERSON row',
            ],
            'spec' => [
                'parameters' => [
                    'type' => 'object',
                    'required' => ['target_schema'],
                    'properties' => [
                        'target_schema' => ['type' => 'string'],
                    ],
                ],
                'nodes' => [
                    ['node_id' => 'bootstrap', 'type' => 'python'],
                    ['node_id' => 'insert_person', 'type' => 'sql'],
                ],
            ],
        ];

        $flat = TemplatePresenter::manifest($upstream);

        $this->assertSame('hello_cdm', $flat['id']);
        $this->assertSame('Hello CDM', $flat['name']);
        $this->assertSame('0.1.0', $flat['version']);
        $this->assertSame('ingestion', $flat['category']);
        $this->assertSame(['5.4'], $flat['cdm_versions']);
        $this->assertSame(['demo', 'bootstrap'], $flat['tags']);
        $this->assertFalse($flat['singleton']);
        $this->assertSame('Boots a tiny CDM and inserts one PERSON row', $flat['description']);

        $this->assertSame('object', $flat['parameters_schema']['type']);
        $this->assertSame(['target_schema'], $flat['parameters_schema']['required']);
        $this->assertArrayHasKey('target_schema', $flat['parameters_schema']['properties']);

        $this->assertCount(2, $flat['nodes']);
        $this->assertSame('bootstrap', $flat['nodes'][0]['id']);
        $this->assertSame('python', $flat['nodes'][0]['kind']);
        $this->assertSame('insert_person', $flat['nodes'][1]['id']);
        $this->assertSame('sql', $flat['nodes'][1]['kind']);

        $this->assertSame([], $flat['post_conditions']);
    }

    #[Test]
    public function manifest_returns_safe_defaults_for_empty_payload(): void
    {
        $flat = TemplatePresenter::manifest([]);

        $this->assertSame('', $flat['id']);
        $this->assertSame('', $flat['name']);
        $this->assertSame('', $flat['version']);
        $this->assertFalse($flat['singleton']);
        $this->assertSame([], $flat['tags']);
        $this->assertSame([], $flat['cdm_versions']);
        $this->assertSame([], $flat['nodes']);
        $this->assertSame([], $flat['post_conditions']);
        $this->assertSame('object', $flat['parameters_schema']['type']);
        $this->assertSame([], $flat['parameters_schema']['required']);
    }

    #[Test]
    public function summary_normalizes_list_response_entries(): void
    {
        $upstream = [
            'id' => 'fhir_to_omop',
            'name' => 'FHIR R4 to OMOP CDM',
            'version' => '0.1.0',
            'category' => 'ingestion',
            'cdm_versions' => ['5.3', '5.4'],
            'tags' => ['fhir', 'etl'],
            'singleton' => false,
        ];

        $summary = TemplatePresenter::summary($upstream);

        $this->assertSame('fhir_to_omop', $summary['id']);
        $this->assertSame('FHIR R4 to OMOP CDM', $summary['name']);
        $this->assertSame(['5.3', '5.4'], $summary['cdm_versions']);
        $this->assertSame(['fhir', 'etl'], $summary['tags']);
        $this->assertSame('', $summary['description']);
        $this->assertFalse($summary['singleton']);
    }

    #[Test]
    public function log_lines_normalize_ts_to_timestamp(): void
    {
        $upstreamLines = [
            ['ts' => '2026-05-08T20:13:07Z', 'level' => 'INFO', 'message' => 'started'],
            ['timestamp' => '2026-05-08T20:13:08Z', 'level' => 'ERROR', 'message' => 'boom', 'node_id' => 'bootstrap'],
        ];

        $normalized = TemplatePresenter::logLines($upstreamLines);

        $this->assertCount(2, $normalized);
        $this->assertSame('2026-05-08T20:13:07Z', $normalized[0]['timestamp']);
        $this->assertSame('INFO', $normalized[0]['level']);
        $this->assertSame('started', $normalized[0]['message']);
        $this->assertNull($normalized[0]['node_id']);
        $this->assertSame('2026-05-08T20:13:08Z', $normalized[1]['timestamp']);
        $this->assertSame('bootstrap', $normalized[1]['node_id']);
    }

    #[Test]
    public function artifacts_normalize_size_to_size_bytes(): void
    {
        $upstreamArtifacts = [
            ['name' => 'summary.json', 'size' => 100, 'url' => 'https://x/summary.json'],
            [
                'name' => 'report.pdf',
                'size_bytes' => 4096,
                'signed_url' => 'https://y/report.pdf',
                'content_type' => 'application/pdf',
            ],
        ];

        $normalized = TemplatePresenter::artifacts($upstreamArtifacts);

        $this->assertCount(2, $normalized);
        $this->assertSame('summary.json', $normalized[0]['name']);
        $this->assertSame(100, $normalized[0]['size_bytes']);
        $this->assertSame('https://x/summary.json', $normalized[0]['signed_url']);
        $this->assertSame('application/octet-stream', $normalized[0]['content_type']);
        $this->assertSame(4096, $normalized[1]['size_bytes']);
        $this->assertSame('application/pdf', $normalized[1]['content_type']);
    }
}
