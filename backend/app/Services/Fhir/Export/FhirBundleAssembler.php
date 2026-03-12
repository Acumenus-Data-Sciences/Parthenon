<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

class FhirBundleAssembler
{
    /**
     * Wrap resources in a FHIR Bundle (searchset type).
     *
     * @param  list<array<string, mixed>>  $resources
     * @return array<string, mixed>
     */
    public static function searchset(array $resources, int $total, ?string $nextUrl = null): array
    {
        $bundle = [
            'resourceType' => 'Bundle',
            'type' => 'searchset',
            'total' => $total,
            'entry' => [],
        ];

        foreach ($resources as $resource) {
            $type = $resource['resourceType'] ?? 'Unknown';
            $id = $resource['id'] ?? '';

            $bundle['entry'][] = [
                'fullUrl' => "urn:uuid:{$type}/{$id}",
                'resource' => $resource,
                'search' => ['mode' => 'match'],
            ];
        }

        if ($nextUrl) {
            $bundle['link'] = [
                ['relation' => 'next', 'url' => $nextUrl],
            ];
        }

        return $bundle;
    }

    /**
     * Wrap a single resource for read operations.
     *
     * @param  array<string, mixed>  $resource
     * @return array<string, mixed>
     */
    public static function single(array $resource): array
    {
        return $resource;
    }
}
