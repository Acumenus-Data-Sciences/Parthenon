<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

/**
 * @group Help & Changelog
 */
class HelpController extends Controller
{
    /**
     * GET /api/v1/help/{key}
     *
     * Return contextual help content for the given feature key.
     */
    public function help(string $key): JsonResponse
    {
        // Sanitize key — only allow alphanumeric, hyphens, and dots
        if (! preg_match('/^[a-z0-9\-\.]+$/', $key)) {
            return response()->json(['message' => 'Help topic not found.'], 404);
        }

        $path = resource_path("help/{$key}.json");

        if (! file_exists($path)) {
            return response()->json(['message' => 'Help topic not found.'], 404);
        }

        $raw = file_get_contents($path);
        $content = json_decode((string) $raw, true);

        return response()->json($content);
    }

    /**
     * GET /api/v1/changelog
     *
     * Return parsed changelog entries for the What's New modal.
     */
    public function changelog(): JsonResponse
    {
        $path = resource_path('changelog.md');

        if (! file_exists($path)) {
            return response()->json(['entries' => []]);
        }

        $markdown = (string) file_get_contents($path);
        $entries = $this->parseChangelog($markdown);

        return response()->json(['entries' => $entries]);
    }

    /**
     * Parse a Keep-a-Changelog formatted markdown file into structured entries.
     *
     * @return list<array{version: string, date: string|null, sections: array<string, list<string>>}>
     */
    private function parseChangelog(string $markdown): array
    {
        $entries = [];
        $lines = explode("\n", $markdown);

        $currentVersion = null;
        $currentDate = null;
        $currentSection = null;
        $currentItems = [];
        $currentSections = [];

        foreach ($lines as $line) {
            // Version heading: ## [0.9.0] — 2026-03-03
            if (preg_match('/^## \[([^\]]+)\].*?(\d{4}-\d{2}-\d{2})/', $line, $m)) {
                // Save previous entry
                if ($currentVersion !== null) {
                    if ($currentSection && $currentItems) {
                        $currentSections[$currentSection] = $currentItems;
                    }
                    $entries[] = [
                        'version' => $currentVersion,
                        'date' => $currentDate,
                        'sections' => $currentSections,
                    ];
                }

                $currentVersion = $m[1];
                $currentDate = $m[2];
                $currentSection = null;
                $currentItems = [];
                $currentSections = [];

                continue;
            }

            // Section heading: ### Added / ### Fixed / ### Changed
            if (preg_match('/^### (.+)$/', $line, $m)) {
                if ($currentSection && $currentItems) {
                    $currentSections[$currentSection] = $currentItems;
                }
                $currentSection = $m[1];
                $currentItems = [];

                continue;
            }

            // List item
            if (preg_match('/^- (.+)$/', $line, $m)) {
                $currentItems[] = $m[1];
            }
        }

        // Save last entry
        if ($currentVersion !== null) {
            if ($currentSection && $currentItems) {
                $currentSections[$currentSection] = $currentItems;
            }
            $entries[] = [
                'version' => $currentVersion,
                'date' => $currentDate,
                'sections' => $currentSections,
            ];
        }

        return $entries;
    }
}
