# Publish Feature Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Publish page into a pre-publication manuscript tool with AI narrative, publication-quality diagrams, and DOCX/PDF export.

**Architecture:** Hybrid frontend preview + backend export. Frontend renders interactive document with D3/SVG diagrams and AI-generated text. Backend assembles final DOCX/PDF via PhpWord. AI narrative via existing Abby chat endpoint.

**Tech Stack:** React 19, D3 v7, @dnd-kit/core, TanStack Query, Laravel 11, PhpWord, FastAPI AI service

**Design Doc:** `docs/plans/2026-03-09-publish-redesign-design.md`

---

## Phase 1: Backend Foundation

### Task 1: Install PhpWord dependency

**Files:**
- Modify: `backend/composer.json`

**Step 1: Install PhpWord**

```bash
cd backend && docker compose exec php composer require phpoffice/phpword
```

**Step 2: Verify installation**

```bash
docker compose exec php php -r "echo class_exists('PhpOffice\PhpWord\PhpWord') ? 'OK' : 'FAIL';"
```

Expected: `OK`

**Step 3: Commit**

```bash
git add backend/composer.json backend/composer.lock
git commit -m "chore: add phpoffice/phpword for DOCX export"
```

---

### Task 2: Add Imagick to Docker PHP image

**Files:**
- Modify: `docker/php/Dockerfile`

**Step 1: Add Imagick extension to Dockerfile**

In `docker/php/Dockerfile`, after the existing `RUN` block that installs PHP extensions, add:

```dockerfile
# Imagick for SVG→PNG conversion (publication exports)
RUN apk add --no-cache imagemagick imagemagick-dev \
    && pecl install imagick \
    && docker-php-ext-enable imagick
```

**Step 2: Rebuild PHP container**

```bash
docker compose build php && docker compose up -d php
```

**Step 3: Verify Imagick is available**

```bash
docker compose exec php php -r "echo extension_loaded('imagick') ? 'OK' : 'FAIL';"
```

Expected: `OK`

**Step 4: Commit**

```bash
git add docker/php/Dockerfile
git commit -m "chore: add Imagick PHP extension for SVG→PNG export"
```

---

### Task 3: PublicationController and routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/PublicationController.php`
- Create: `backend/app/Http/Requests/PublicationNarrativeRequest.php`
- Create: `backend/app/Http/Requests/PublicationExportRequest.php`
- Modify: `backend/routes/api.php`

**Step 1: Write feature test for narrative endpoint**

Create `backend/tests/Feature/PublicationNarrativeTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicationNarrativeTest extends TestCase
{
    use RefreshDatabase;

    public function test_narrative_endpoint_requires_auth(): void
    {
        $response = $this->postJson('/api/v1/publish/narrative', [
            'section_type' => 'methods',
            'context' => ['analysis_type' => 'estimation'],
        ]);

        $response->assertStatus(401);
    }

    public function test_narrative_endpoint_validates_section_type(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/publish/narrative', [
                'section_type' => 'invalid',
                'context' => [],
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['section_type']);
    }

    public function test_narrative_endpoint_accepts_valid_request(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/publish/narrative', [
                'section_type' => 'methods',
                'context' => [
                    'analysis_type' => 'estimation',
                    'design' => ['model' => 'cox'],
                ],
            ]);

        // AI service may not be running in test, so accept 200 or 503
        $this->assertContains($response->status(), [200, 503]);
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cd backend && vendor/bin/pest tests/Feature/PublicationNarrativeTest.php
```

Expected: FAIL (route not found)

**Step 3: Create PublicationNarrativeRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PublicationNarrativeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'section_type' => ['required', 'string', 'in:methods,results,discussion,caption'],
            'analysis_id' => ['nullable', 'integer'],
            'execution_id' => ['nullable', 'integer'],
            'context' => ['required', 'array'],
        ];
    }
}
```

**Step 4: Create PublicationExportRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PublicationExportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'template' => ['required', 'string', 'in:generic-ohdsi'],
            'format' => ['required', 'string', 'in:docx,pdf,figures-zip'],
            'title' => ['required', 'string', 'max:500'],
            'authors' => ['required', 'array', 'min:1'],
            'authors.*' => ['string', 'max:200'],
            'sections' => ['required', 'array', 'min:1'],
            'sections.*.type' => ['required', 'string', 'in:title,methods,results,diagram,discussion'],
            'sections.*.content' => ['nullable', 'string'],
            'sections.*.included' => ['required', 'boolean'],
            'sections.*.svg' => ['nullable', 'string'],
            'sections.*.caption' => ['nullable', 'string'],
            'sections.*.diagram_type' => ['nullable', 'string', 'in:consort,forest_plot,kaplan_meier,attrition'],
        ];
    }
}
```

**Step 5: Create PublicationController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\PublicationExportRequest;
use App\Http\Requests\PublicationNarrativeRequest;
use App\Services\AiService;
use App\Services\Publication\PublicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicationController extends Controller
{
    public function __construct(
        private readonly AiService $aiService,
        private readonly PublicationService $publicationService,
    ) {}

    /**
     * Generate AI narrative for a document section.
     */
    public function narrative(PublicationNarrativeRequest $request): JsonResponse
    {
        $validated = $request->validated();

        try {
            $prompt = $this->buildNarrativePrompt(
                $validated['section_type'],
                $validated['context'],
            );

            $result = $this->aiService->abbyChat($prompt, [
                'role' => 'publication_writer',
                'section_type' => $validated['section_type'],
            ]);

            return response()->json([
                'data' => [
                    'text' => $result['response'] ?? $result['message'] ?? '',
                    'section_type' => $validated['section_type'],
                ],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Publication narrative generation failed', [
                'section_type' => $validated['section_type'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'data' => [
                    'text' => '',
                    'section_type' => $validated['section_type'],
                    'error' => 'AI narrative generation unavailable. Please write manually.',
                ],
            ], 503);
        }
    }

    /**
     * Export assembled publication document.
     */
    public function export(PublicationExportRequest $request): StreamedResponse|JsonResponse
    {
        $validated = $request->validated();

        try {
            return $this->publicationService->export($validated);
        } catch (\Throwable $e) {
            Log::error('Publication export failed', [
                'format' => $validated['format'],
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Export failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Build section-specific AI prompt.
     *
     * @param  array<string, mixed>  $context
     */
    private function buildNarrativePrompt(string $sectionType, array $context): string
    {
        $contextJson = json_encode($context, JSON_PRETTY_PRINT);

        return match ($sectionType) {
            'methods' => "You are a medical research writer. Based on the following analysis parameters, write 2-3 paragraphs describing the study methods in journal-ready language. Use passive voice, past tense. Do NOT make causal claims — use 'associated with', 'suggests'. Do NOT fabricate citations.\n\nAnalysis parameters:\n{$contextJson}",
            'results' => "You are a medical research writer. Based on the following analysis results, write 1-2 paragraphs interpreting the results with proper statistical language. Report exact values (HR, CI, p-values). Use hedging language ('suggests', 'is associated with'). Do NOT fabricate citations.\n\nResults:\n{$contextJson}",
            'discussion' => "You are a medical research writer. Based on the following study results and parameters, write 2-3 paragraphs discussing clinical significance, study limitations, and potential implications. Use hedging language. Do NOT fabricate citations or references.\n\nStudy data:\n{$contextJson}",
            'caption' => "You are a medical research writer. Based on the following diagram data, write a single-sentence figure caption suitable for a journal publication.\n\nDiagram data:\n{$contextJson}",
            default => "Summarize the following data:\n{$contextJson}",
        };
    }
}
```

**Step 6: Add routes**

In `backend/routes/api.php`, inside the authenticated middleware group, add:

```php
// Publication / Export
Route::post('publish/narrative', [App\Http\Controllers\Api\V1\PublicationController::class, 'narrative']);
Route::post('publish/export', [App\Http\Controllers\Api\V1\PublicationController::class, 'export']);
```

**Step 7: Run tests**

```bash
cd backend && vendor/bin/pest tests/Feature/PublicationNarrativeTest.php
```

Expected: 2 PASS, 1 PASS or acceptable (503 if AI not running)

**Step 8: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PublicationController.php \
  backend/app/Http/Requests/PublicationNarrativeRequest.php \
  backend/app/Http/Requests/PublicationExportRequest.php \
  backend/routes/api.php \
  backend/tests/Feature/PublicationNarrativeTest.php
git commit -m "feat: add publication controller with narrative and export endpoints"
```

---

### Task 4: PublicationService and Exporters

**Files:**
- Create: `backend/app/Services/Publication/PublicationService.php`
- Create: `backend/app/Services/Publication/Exporters/DocxExporter.php`
- Create: `backend/app/Services/Publication/Exporters/PdfExporter.php`
- Create: `backend/app/Services/Publication/Exporters/FiguresExporter.php`

**Step 1: Write test for PublicationService**

Create `backend/tests/Unit/PublicationServiceTest.php`:

```php
<?php

namespace Tests\Unit;

use App\Services\Publication\PublicationService;
use Tests\TestCase;

class PublicationServiceTest extends TestCase
{
    public function test_export_returns_streamed_response_for_docx(): void
    {
        $service = app(PublicationService::class);

        $payload = [
            'template' => 'generic-ohdsi',
            'format' => 'docx',
            'title' => 'Test Publication',
            'authors' => ['Dr. Test'],
            'sections' => [
                [
                    'type' => 'methods',
                    'content' => 'This study used a cohort design.',
                    'included' => true,
                ],
            ],
        ];

        $response = $service->export($payload);

        $this->assertInstanceOf(\Symfony\Component\HttpFoundation\StreamedResponse::class, $response);
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_export_returns_streamed_response_for_pdf(): void
    {
        $service = app(PublicationService::class);

        $payload = [
            'template' => 'generic-ohdsi',
            'format' => 'pdf',
            'title' => 'Test Publication',
            'authors' => ['Dr. Test'],
            'sections' => [
                [
                    'type' => 'results',
                    'content' => 'The hazard ratio was 0.85 (95% CI: 0.72-1.01).',
                    'included' => true,
                ],
            ],
        ];

        $response = $service->export($payload);

        $this->assertInstanceOf(\Symfony\Component\HttpFoundation\StreamedResponse::class, $response);
    }
}
```

**Step 2: Run test to verify it fails**

```bash
cd backend && vendor/bin/pest tests/Unit/PublicationServiceTest.php
```

Expected: FAIL (class not found)

**Step 3: Create PublicationService**

```php
<?php

namespace App\Services\Publication;

use App\Services\Publication\Exporters\DocxExporter;
use App\Services\Publication\Exporters\FiguresExporter;
use App\Services\Publication\Exporters\PdfExporter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicationService
{
    public function __construct(
        private readonly DocxExporter $docxExporter,
        private readonly PdfExporter $pdfExporter,
        private readonly FiguresExporter $figuresExporter,
    ) {}

    /**
     * Export a publication document in the requested format.
     *
     * @param  array<string, mixed>  $payload
     */
    public function export(array $payload): StreamedResponse
    {
        $sections = collect($payload['sections'])->where('included', true)->values()->all();

        $document = [
            'title' => $payload['title'],
            'authors' => $payload['authors'],
            'template' => $payload['template'],
            'sections' => $sections,
        ];

        return match ($payload['format']) {
            'docx' => $this->docxExporter->export($document),
            'pdf' => $this->pdfExporter->export($document),
            'figures-zip' => $this->figuresExporter->export($document),
            default => throw new \InvalidArgumentException("Unsupported format: {$payload['format']}"),
        };
    }
}
```

**Step 4: Create DocxExporter**

```php
<?php

namespace App\Services\Publication\Exporters;

use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\SimpleType\Jc;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocxExporter
{
    /**
     * Export document as DOCX.
     *
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $phpWord = new PhpWord();

        // Default font
        $phpWord->setDefaultFontName('Times New Roman');
        $phpWord->setDefaultFontSize(12);

        $section = $phpWord->addSection([
            'marginTop' => 1440,    // 1 inch
            'marginBottom' => 1440,
            'marginLeft' => 1440,
            'marginRight' => 1440,
        ]);

        // Title page
        $section->addText(
            $document['title'],
            ['size' => 16, 'bold' => true],
            ['alignment' => Jc::CENTER, 'spaceAfter' => 240]
        );

        $section->addText(
            implode(', ', $document['authors']),
            ['size' => 12, 'italic' => true],
            ['alignment' => Jc::CENTER, 'spaceAfter' => 480]
        );

        $section->addText(
            'Generated ' . now()->format('F j, Y'),
            ['size' => 10, 'color' => '666666'],
            ['alignment' => Jc::CENTER, 'spaceAfter' => 480]
        );

        // Sections
        $figureNum = 1;
        foreach ($document['sections'] as $sec) {
            $type = $sec['type'] ?? 'unknown';

            if ($type === 'diagram') {
                // Embed SVG as image if possible
                if (! empty($sec['svg'])) {
                    $this->embedSvgImage($section, $sec['svg']);
                }
                $caption = $sec['caption'] ?? "Figure {$figureNum}";
                $section->addText(
                    "Figure {$figureNum}. {$caption}",
                    ['size' => 10, 'italic' => true],
                    ['alignment' => Jc::CENTER, 'spaceAfter' => 240]
                );
                $figureNum++;
            } else {
                // Text section
                $heading = match ($type) {
                    'methods' => 'Methods',
                    'results' => 'Results',
                    'discussion' => 'Discussion',
                    default => ucfirst($type),
                };

                $section->addText(
                    $heading,
                    ['size' => 14, 'bold' => true],
                    ['spaceAfter' => 120, 'spaceBefore' => 240]
                );

                $content = $sec['content'] ?? '';
                foreach (explode("\n\n", $content) as $paragraph) {
                    $paragraph = trim($paragraph);
                    if ($paragraph !== '') {
                        $section->addText(
                            $paragraph,
                            ['size' => 12],
                            ['spaceAfter' => 120, 'alignment' => Jc::BOTH]
                        );
                    }
                }
            }
        }

        $filename = str_replace(' ', '_', $document['title']) . '.docx';

        return new StreamedResponse(function () use ($phpWord) {
            $writer = IOFactory::createWriter($phpWord, 'Word2007');
            $writer->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    /**
     * Convert SVG to PNG and embed in document section.
     */
    private function embedSvgImage(\PhpOffice\PhpWord\Element\Section $section, string $svg): void
    {
        try {
            if (extension_loaded('imagick')) {
                $imagick = new \Imagick();
                $imagick->setResolution(300, 300);
                $imagick->readImageBlob($svg);
                $imagick->setImageFormat('png');

                $tempPath = tempnam(sys_get_temp_dir(), 'pub_') . '.png';
                $imagick->writeImage($tempPath);
                $imagick->destroy();

                $section->addImage($tempPath, [
                    'width' => 450,
                    'alignment' => Jc::CENTER,
                ]);

                @unlink($tempPath);
            }
        } catch (\Throwable $e) {
            // Skip image embedding on failure; caption still appears
            \Illuminate\Support\Facades\Log::warning('SVG embedding failed', ['error' => $e->getMessage()]);
        }
    }
}
```

**Step 5: Create PdfExporter**

```php
<?php

namespace App\Services\Publication\Exporters;

use Symfony\Component\HttpFoundation\StreamedResponse;

class PdfExporter
{
    /**
     * Export document as PDF via HTML rendering.
     *
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $html = $this->renderHtml($document);
        $filename = str_replace(' ', '_', $document['title']) . '.pdf';

        // Use DOMPDF if available, otherwise return HTML for browser print
        if (class_exists(\Dompdf\Dompdf::class)) {
            return new StreamedResponse(function () use ($html) {
                $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => false]);
                $dompdf->loadHtml($html);
                $dompdf->setPaper('letter', 'portrait');
                $dompdf->render();
                echo $dompdf->output();
            }, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            ]);
        }

        // Fallback: return HTML that the browser can print to PDF
        return new StreamedResponse(function () use ($html) {
            echo $html;
        }, 200, [
            'Content-Type' => 'text/html',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
        ]);
    }

    /**
     * Render document as styled HTML.
     *
     * @param  array<string, mixed>  $document
     */
    private function renderHtml(array $document): string
    {
        $body = '';
        $figureNum = 1;

        foreach ($document['sections'] as $sec) {
            $type = $sec['type'] ?? 'unknown';

            if ($type === 'diagram') {
                if (! empty($sec['svg'])) {
                    $body .= '<div style="text-align:center;margin:24px 0;">' . $sec['svg'] . '</div>';
                }
                $caption = $sec['caption'] ?? "Figure {$figureNum}";
                $body .= "<p style=\"text-align:center;font-style:italic;font-size:10pt;\">Figure {$figureNum}. {$caption}</p>";
                $figureNum++;
            } else {
                $heading = match ($type) {
                    'methods' => 'Methods',
                    'results' => 'Results',
                    'discussion' => 'Discussion',
                    default => ucfirst($type),
                };
                $body .= "<h2>{$heading}</h2>";
                $content = htmlspecialchars($sec['content'] ?? '', ENT_QUOTES, 'UTF-8');
                foreach (explode("\n\n", $content) as $p) {
                    $p = trim($p);
                    if ($p !== '') {
                        $body .= "<p>{$p}</p>";
                    }
                }
            }
        }

        $title = htmlspecialchars($document['title'], ENT_QUOTES, 'UTF-8');
        $authors = htmlspecialchars(implode(', ', $document['authors']), ENT_QUOTES, 'UTF-8');

        return <<<HTML
        <!DOCTYPE html>
        <html><head><meta charset="utf-8">
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; max-width: 7in; margin: 1in auto; line-height: 1.6; color: #111; }
          h1 { text-align: center; font-size: 16pt; margin-bottom: 4px; }
          .authors { text-align: center; font-style: italic; margin-bottom: 32px; }
          h2 { font-size: 14pt; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          p { text-align: justify; margin: 8px 0; }
          @media print { body { margin: 0; max-width: none; } }
        </style>
        </head><body>
        <h1>{$title}</h1>
        <p class="authors">{$authors}</p>
        {$body}
        </body></html>
        HTML;
    }
}
```

**Step 6: Create FiguresExporter**

```php
<?php

namespace App\Services\Publication\Exporters;

use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

class FiguresExporter
{
    /**
     * Export all diagram SVGs as a zip archive.
     *
     * @param  array<string, mixed>  $document
     */
    public function export(array $document): StreamedResponse
    {
        $filename = str_replace(' ', '_', $document['title']) . '_figures.zip';
        $tempZip = tempnam(sys_get_temp_dir(), 'pub_figures_') . '.zip';

        $zip = new ZipArchive();
        $zip->open($tempZip, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        $figureNum = 1;
        foreach ($document['sections'] as $sec) {
            if (($sec['type'] ?? '') === 'diagram' && ! empty($sec['svg'])) {
                $diagramType = $sec['diagram_type'] ?? 'figure';
                $zip->addFromString("figure_{$figureNum}_{$diagramType}.svg", $sec['svg']);
                $figureNum++;
            }
        }

        $zip->close();

        return new StreamedResponse(function () use ($tempZip) {
            readfile($tempZip);
            @unlink($tempZip);
        }, 200, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
```

**Step 7: Run tests**

```bash
cd backend && vendor/bin/pest tests/Unit/PublicationServiceTest.php
```

Expected: PASS

**Step 8: Commit**

```bash
git add backend/app/Services/Publication/ backend/tests/Unit/PublicationServiceTest.php
git commit -m "feat: add PublicationService with DOCX, PDF, and figures-zip exporters"
```

---

## Phase 2: Frontend Foundation

### Task 5: Install @dnd-kit/core

**Step 1: Install dependency**

```bash
docker compose exec node sh -c "cd /app && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --legacy-peer-deps"
```

**Step 2: Verify installation**

```bash
docker compose exec node sh -c "cd /app && node -e \"require('@dnd-kit/core')\""
```

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add @dnd-kit for drag-and-drop section reordering"
```

---

### Task 6: Update publish types and API client

**Files:**
- Modify: `frontend/src/features/publish/types/publish.ts`
- Modify: `frontend/src/features/publish/api/publishApi.ts`

**Step 1: Update types**

Replace `frontend/src/features/publish/types/publish.ts` with:

```typescript
export type ExportFormat = "docx" | "pdf" | "figures-zip" | "png" | "svg";

export type SectionType = "title" | "methods" | "results" | "diagram" | "discussion";

export type DiagramType = "consort" | "forest_plot" | "kaplan_meier" | "attrition";

export type NarrativeState = "idle" | "generating" | "draft" | "accepted";

export interface ReportSection {
  id: string;
  title: string;
  type: SectionType;
  analysisType?: string;
  executionId?: number;
  included: boolean;
  content: string;
  narrativeState: NarrativeState;
  diagramType?: DiagramType;
  diagramData?: Record<string, unknown>;
  svgMarkup?: string;
  caption?: string;
}

export interface SelectedExecution {
  executionId: number;
  analysisId: number;
  analysisType: string;
  analysisName: string;
  studyId?: number;
  studyTitle?: string;
  resultJson: Record<string, unknown> | null;
  designJson: Record<string, unknown> | null;
}

export interface PublishState {
  step: 1 | 2 | 3 | 4;
  selectedExecutions: SelectedExecution[];
  sections: ReportSection[];
  title: string;
  authors: string[];
  template: string;
  exportFormat: ExportFormat;
}

export interface NarrativeResponse {
  text: string;
  section_type: string;
  error?: string;
}
```

**Step 2: Update API client**

Replace `frontend/src/features/publish/api/publishApi.ts` with:

```typescript
import apiClient from "@/lib/api-client";
import type { NarrativeResponse, ExportFormat } from "../types/publish";

// ── Existing hooks (kept for backward compat) ──────────────────────────────

export { useStudiesForPublish, useStudyWithAnalyses } from "./publishApi.legacy";

// ── New API functions ───────────────────────────────────────────────────────

export interface NarrativeRequest {
  section_type: "methods" | "results" | "discussion" | "caption";
  analysis_id?: number;
  execution_id?: number;
  context: Record<string, unknown>;
}

export const generateNarrative = async (req: NarrativeRequest): Promise<NarrativeResponse> => {
  const { data } = await apiClient.post<{ data: NarrativeResponse }>("/publish/narrative", req);
  return data.data ?? data;
};

export interface ExportRequest {
  template: string;
  format: ExportFormat;
  title: string;
  authors: string[];
  sections: Array<{
    type: string;
    content?: string;
    included: boolean;
    svg?: string;
    caption?: string;
    diagram_type?: string;
  }>;
}

export const exportDocument = async (req: ExportRequest): Promise<Blob> => {
  const { data } = await apiClient.post("/publish/export", req, {
    responseType: "blob",
  });
  return data;
};

// ── Analysis picker queries ─────────────────────────────────────────────────

export interface AnalysisPickerItem {
  id: number;
  name: string;
  type: string;
  description: string | null;
  design_json: Record<string, unknown>;
  latest_execution: {
    id: number;
    status: string;
    result_json: Record<string, unknown> | null;
    completed_at: string | null;
  } | null;
}

export const fetchAllAnalyses = async (): Promise<AnalysisPickerItem[]> => {
  // Fetch all 7 analysis types in parallel
  const types = [
    "characterizations",
    "estimations",
    "predictions",
    "incidence-rates",
    "sccs",
    "evidence-synthesis",
    "pathways",
  ];

  const results = await Promise.all(
    types.map(async (type) => {
      try {
        const { data } = await apiClient.get(`/${type}`, { params: { per_page: 100 } });
        const items = data.data ?? data;
        const list = Array.isArray(items) ? items : items.data ?? [];
        return list.map((item: Record<string, unknown>) => ({
          ...item,
          type: type.replace(/-/g, "_"),
        }));
      } catch {
        return [];
      }
    })
  );

  return results.flat();
};
```

**Step 3: Rename existing publishApi.ts to legacy**

```bash
cp frontend/src/features/publish/api/publishApi.ts frontend/src/features/publish/api/publishApi.legacy.ts
```

Then update the legacy file to export only the hooks (useStudiesForPublish, useStudyWithAnalyses, export helpers).

**Step 4: Commit**

```bash
git add frontend/src/features/publish/types/publish.ts \
  frontend/src/features/publish/api/publishApi.ts \
  frontend/src/features/publish/api/publishApi.legacy.ts
git commit -m "feat: update publish types and API client for redesign"
```

---

### Task 7: Unified Analysis Picker component

**Files:**
- Create: `frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx`
- Create: `frontend/src/features/publish/components/AnalysisPickerCart.tsx`
- Create: `frontend/src/features/publish/hooks/useAnalysisPicker.ts`

**Step 1: Create useAnalysisPicker hook**

```typescript
// frontend/src/features/publish/hooks/useAnalysisPicker.ts
import { useQuery } from "@tanstack/react-query";
import { fetchAllAnalyses } from "../api/publishApi";

export function useAllAnalyses() {
  return useQuery({
    queryKey: ["publish", "all-analyses"],
    queryFn: fetchAllAnalyses,
    staleTime: 5 * 60 * 1000,
  });
}
```

**Step 2: Create AnalysisPickerCart**

A sidebar component showing selected executions with remove buttons. Receives `selectedExecutions` and `onRemove` as props. Renders a list with analysis name, type badge, and an X button.

```typescript
// frontend/src/features/publish/components/AnalysisPickerCart.tsx
import { X } from "lucide-react";
import type { SelectedExecution } from "../types/publish";

interface AnalysisPickerCartProps {
  selections: SelectedExecution[];
  onRemove: (executionId: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  characterizations: "Characterization",
  estimations: "Estimation",
  predictions: "Prediction",
  incidence_rates: "Incidence Rate",
  sccs: "SCCS",
  evidence_synthesis: "Evidence Synthesis",
  pathways: "Pathway",
};

export default function AnalysisPickerCart({ selections, onRemove }: AnalysisPickerCartProps) {
  if (selections.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#232328] p-4 text-center text-sm text-[#5A5650]">
        No analyses selected yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#8A857D]">
        {selections.length} selected
      </p>
      {selections.map((sel) => (
        <div
          key={sel.executionId}
          className="flex items-center justify-between rounded-lg bg-[#151518] px-3 py-2 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate text-[#F0EDE8]">{sel.analysisName}</p>
            <p className="text-xs text-[#5A5650]">
              {TYPE_LABELS[sel.analysisType] ?? sel.analysisType}
              {sel.studyTitle ? ` · ${sel.studyTitle}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(sel.executionId)}
            className="ml-2 flex-shrink-0 rounded p-1 text-[#5A5650] hover:bg-[#232328] hover:text-[#E85A6B]"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Create UnifiedAnalysisPicker**

Two-tab picker (From Studies / All Analyses) with the cart sidebar. The "From Studies" tab reuses the existing study selector pattern. The "All Analyses" tab shows a filterable table of all analysis executions grouped by type, showing only completed ones.

This is a larger component (~200 lines). Key structure:

```typescript
// frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx
import { useState } from "react";
import { Search } from "lucide-react";
import { useAllAnalyses } from "../hooks/useAnalysisPicker";
import { useStudiesForPublish } from "../api/publishApi";
import AnalysisPickerCart from "./AnalysisPickerCart";
import type { SelectedExecution } from "../types/publish";

interface UnifiedAnalysisPickerProps {
  selections: SelectedExecution[];
  onSelectionsChange: (selections: SelectedExecution[]) => void;
  onNext: () => void;
}

export default function UnifiedAnalysisPicker({
  selections,
  onSelectionsChange,
  onNext,
}: UnifiedAnalysisPickerProps) {
  const [tab, setTab] = useState<"studies" | "analyses">("analyses");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: analyses, isLoading: loadingAnalyses } = useAllAnalyses();
  const { data: studies, isLoading: loadingStudies } = useStudiesForPublish();

  const completedAnalyses = (analyses ?? []).filter(
    (a) => a.latest_execution?.status === "completed"
  );

  const filtered = completedAnalyses.filter((a) => {
    const matchesSearch = !search || a.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || a.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const isSelected = (executionId: number) =>
    selections.some((s) => s.executionId === executionId);

  function toggleAnalysis(analysis: typeof completedAnalyses[0]) {
    const execId = analysis.latest_execution!.id;
    if (isSelected(execId)) {
      onSelectionsChange(selections.filter((s) => s.executionId !== execId));
    } else {
      onSelectionsChange([
        ...selections,
        {
          executionId: execId,
          analysisId: analysis.id,
          analysisType: analysis.type,
          analysisName: analysis.name,
          resultJson: analysis.latest_execution!.result_json,
          designJson: analysis.design_json,
        },
      ]);
    }
  }

  return (
    <div className="flex gap-6">
      {/* Main picker area */}
      <div className="flex-1 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-[#0E0E11] p-1">
          {(["analyses", "studies"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-[#232328] text-[#F0EDE8]"
                  : "text-[#5A5650] hover:text-[#8A857D]"
              }`}
            >
              {t === "analyses" ? "All Analyses" : "From Studies"}
            </button>
          ))}
        </div>

        {/* Search + filter */}
        {tab === "analyses" && (
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]" />
              <input
                type="text"
                placeholder="Search analyses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#232328] bg-[#151518] py-2 pl-9 pr-3 text-sm text-[#F0EDE8] placeholder:text-[#5A5650] focus:border-[#C9A227] focus:outline-none"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="characterizations">Characterization</option>
              <option value="estimations">Estimation</option>
              <option value="predictions">Prediction</option>
              <option value="incidence_rates">Incidence Rate</option>
              <option value="sccs">SCCS</option>
              <option value="evidence_synthesis">Evidence Synthesis</option>
              <option value="pathways">Pathway</option>
            </select>
          </div>
        )}

        {/* Analysis list */}
        {tab === "analyses" && (
          <div className="space-y-2">
            {loadingAnalyses ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 animate-pulse rounded-lg bg-[#151518]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#5A5650]">
                No completed analyses found.
              </p>
            ) : (
              filtered.map((analysis) => {
                const execId = analysis.latest_execution!.id;
                const selected = isSelected(execId);
                return (
                  <button
                    key={`${analysis.type}-${analysis.id}`}
                    type="button"
                    onClick={() => toggleAnalysis(analysis)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-[#C9A227]/40 bg-[#C9A227]/5"
                        : "border-[#232328] bg-[#151518] hover:border-[#5A5650]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#F0EDE8]">{analysis.name}</p>
                        <p className="text-xs text-[#5A5650]">
                          {analysis.type.replace(/_/g, " ")} · Completed{" "}
                          {analysis.latest_execution?.completed_at
                            ? new Date(analysis.latest_execution.completed_at).toLocaleDateString()
                            : ""}
                        </p>
                      </div>
                      <div
                        className={`h-5 w-5 rounded border ${
                          selected
                            ? "border-[#C9A227] bg-[#C9A227]"
                            : "border-[#5A5650]"
                        } flex items-center justify-center`}
                      >
                        {selected && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6L5 9L10 3" stroke="#0E0E11" strokeWidth="2" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Studies tab - reuses existing pattern */}
        {tab === "studies" && (
          <div className="text-sm text-[#5A5650]">
            {loadingStudies ? (
              <div className="space-y-2">
                {[1, 2].map((n) => (
                  <div key={n} className="h-24 animate-pulse rounded-lg bg-[#151518]" />
                ))}
              </div>
            ) : (
              (studies ?? []).map((study) => (
                <div
                  key={study.id}
                  className="mb-3 rounded-lg border border-[#232328] bg-[#151518] p-4"
                >
                  <p className="font-medium text-[#F0EDE8]">{study.title ?? study.name}</p>
                  <p className="text-xs text-[#5A5650]">{study.study_type ?? "Study"}</p>
                  {/* Study execution selection would go here - similar to existing StudySelector */}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Cart sidebar */}
      <div className="w-64 flex-shrink-0">
        <h3 className="mb-3 text-sm font-semibold text-[#F0EDE8]">Selected</h3>
        <AnalysisPickerCart
          selections={selections}
          onRemove={(execId) =>
            onSelectionsChange(selections.filter((s) => s.executionId !== execId))
          }
        />
        {selections.length > 0 && (
          <button
            type="button"
            onClick={onNext}
            className="mt-4 w-full rounded-lg bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90 transition-colors"
          >
            Configure Document →
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx \
  frontend/src/features/publish/components/AnalysisPickerCart.tsx \
  frontend/src/features/publish/hooks/useAnalysisPicker.ts
git commit -m "feat: add unified analysis picker with cart sidebar"
```

---

## Phase 3: Document Configurator & AI Narrative

### Task 8: AI Narrative Block component

**Files:**
- Create: `frontend/src/features/publish/components/narrative/AiNarrativeBlock.tsx`
- Create: `frontend/src/features/publish/components/narrative/StructuredDataBlock.tsx`
- Create: `frontend/src/features/publish/hooks/useNarrativeGeneration.ts`

**Step 1: Create useNarrativeGeneration hook**

```typescript
// frontend/src/features/publish/hooks/useNarrativeGeneration.ts
import { useMutation } from "@tanstack/react-query";
import { generateNarrative, type NarrativeRequest } from "../api/publishApi";

export function useGenerateNarrative() {
  return useMutation({
    mutationFn: (req: NarrativeRequest) => generateNarrative(req),
  });
}
```

**Step 2: Create AiNarrativeBlock**

Component with states: idle → generating (spinner) → draft (editable textarea with "Accept"/"Regenerate" buttons) → accepted (locked text with "Edit" button). Shows "AI Draft" badge when in draft state.

**Step 3: Create StructuredDataBlock**

Simple tabular view of result_json key-value pairs. Used as the non-AI alternative.

**Step 4: Commit**

```bash
git add frontend/src/features/publish/components/narrative/ \
  frontend/src/features/publish/hooks/useNarrativeGeneration.ts
git commit -m "feat: add AI narrative block with generate/edit/accept workflow"
```

---

### Task 9: Document Configurator and Section Editor

**Files:**
- Create: `frontend/src/features/publish/components/DocumentConfigurator.tsx`
- Create: `frontend/src/features/publish/components/SectionEditor.tsx`

**Step 1: Create SectionEditor**

Individual section card with:
- Include/exclude toggle
- AI narrative vs structured data toggle
- Section title (editable for custom sections)
- AiNarrativeBlock or StructuredDataBlock based on toggle
- Drag handle for reordering

**Step 2: Create DocumentConfigurator**

Container that:
- Auto-generates sections from selected executions (Methods per unique design, Results per execution, auto-detected Diagrams)
- Uses @dnd-kit/sortable for drag-and-drop reordering
- Title and authors input fields at top
- Template selector (v1: Generic OHDSI only)
- "Preview Document" button to proceed to Step 3

**Step 3: Commit**

```bash
git add frontend/src/features/publish/components/DocumentConfigurator.tsx \
  frontend/src/features/publish/components/SectionEditor.tsx
git commit -m "feat: add document configurator with drag-and-drop sections"
```

---

## Phase 4: Diagram Components

### Task 10: DiagramWrapper and Forest Plot

**Files:**
- Create: `frontend/src/features/publish/components/diagrams/DiagramWrapper.tsx`
- Create: `frontend/src/features/publish/components/diagrams/ForestPlot.tsx`

**Step 1: Create DiagramWrapper**

Shared wrapper providing: figure number label, AI-generated caption, individual export button (SVG/PNG), consistent sizing.

**Step 2: Create ForestPlot**

D3-based forest plot for estimation/evidence synthesis results. Input: array of `{ label, estimate, ci_lower, ci_upper, weight? }`. Renders point estimates with whiskers, null line at 1.0, optional diamond for pooled estimate.

**Step 3: Commit**

```bash
git add frontend/src/features/publish/components/diagrams/
git commit -m "feat: add DiagramWrapper and ForestPlot diagram component"
```

---

### Task 11: Attrition Diagram

**Files:**
- Create: `frontend/src/features/publish/components/diagrams/AttritionDiagram.tsx`

Horizontal funnel/waterfall chart showing cohort population reduction at each inclusion criteria step. Input: array of `{ label, count, excluded }`.

**Commit:**

```bash
git add frontend/src/features/publish/components/diagrams/AttritionDiagram.tsx
git commit -m "feat: add cohort attrition diagram component"
```

---

### Task 12: CONSORT Flow Diagram

**Files:**
- Create: `frontend/src/features/publish/components/diagrams/ConsortDiagram.tsx`

Standard CONSORT-style flowchart. Input: enrollment count, allocation groups with counts, follow-up numbers, analysis population. D3 with custom tree layout, connecting arrows, and count annotations.

**Commit:**

```bash
git add frontend/src/features/publish/components/diagrams/ConsortDiagram.tsx
git commit -m "feat: add CONSORT flow diagram component"
```

---

### Task 13: Kaplan-Meier Curve

**Files:**
- Create: `frontend/src/features/publish/components/diagrams/KaplanMeierCurve.tsx`

Step-function survival curves. Input: two arrays of `{ time, survival, ci_lower?, ci_upper? }` for target and comparator. Risk table below the chart. Shaded CI bands. Censoring tick marks.

**Commit:**

```bash
git add frontend/src/features/publish/components/diagrams/KaplanMeierCurve.tsx
git commit -m "feat: add Kaplan-Meier survival curve diagram component"
```

---

## Phase 5: Preview & Export

### Task 14: Document Preview component

**Files:**
- Create: `frontend/src/features/publish/components/DocumentPreview.tsx`

Full document preview in white paper container (id: `publish-report-preview`). Renders all included sections in order with proper heading hierarchy, embedded diagram SVGs, narrative text, and auto-numbered figures/tables. Shows AI confirmation warning if any sections still in "draft" state.

**Commit:**

```bash
git add frontend/src/features/publish/components/DocumentPreview.tsx
git commit -m "feat: add document preview with figure numbering and AI confirmation"
```

---

### Task 15: Export Panel component

**Files:**
- Create: `frontend/src/features/publish/components/ExportPanel.tsx`
- Create: `frontend/src/features/publish/hooks/useDocumentExport.ts`

**Step 1: Create useDocumentExport hook**

```typescript
// frontend/src/features/publish/hooks/useDocumentExport.ts
import { useMutation } from "@tanstack/react-query";
import { exportDocument, type ExportRequest } from "../api/publishApi";

export function useExportDocument() {
  return useMutation({
    mutationFn: (req: ExportRequest) => exportDocument(req),
    onSuccess: (blob, variables) => {
      const ext = variables.format === "figures-zip" ? "zip" : variables.format;
      const filename = `${variables.title.replace(/\s+/g, "_")}.${ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
```

**Step 2: Create ExportPanel**

Format picker with 3 options (DOCX, PDF, Figures ZIP). Shows file size estimate. Export button triggers backend call, shows progress spinner, auto-downloads on success.

**Step 3: Commit**

```bash
git add frontend/src/features/publish/components/ExportPanel.tsx \
  frontend/src/features/publish/hooks/useDocumentExport.ts
git commit -m "feat: add export panel with DOCX/PDF/figures-zip download"
```

---

### Task 16: Rewrite PublishPage as 4-step wizard

**Files:**
- Modify: `frontend/src/features/publish/pages/PublishPage.tsx`
- Create: `frontend/src/features/publish/hooks/usePublishWorkflow.ts`
- Create: `frontend/src/features/publish/templates/generic-ohdsi.ts`

**Step 1: Create usePublishWorkflow hook**

Local state management (useReducer) for the 4-step wizard: selections, sections, title, authors, template, exportFormat. Actions: setStep, addSelection, removeSelection, updateSections, reorderSection, toggleSection, setTitle, setAuthors, setExportFormat.

**Step 2: Create generic-ohdsi template**

```typescript
// frontend/src/features/publish/templates/generic-ohdsi.ts
export const GENERIC_OHDSI_TEMPLATE = {
  id: "generic-ohdsi",
  name: "Generic OHDSI Publication",
  description: "Standard IMRaD structure for observational health data studies",
  requiredSections: ["methods", "results"],
  optionalSections: ["discussion"],
  sectionOrder: ["methods", "results", "diagram", "discussion"],
};
```

**Step 3: Rewrite PublishPage**

4-step wizard shell rendering:
- Step 1: `<UnifiedAnalysisPicker />`
- Step 2: `<DocumentConfigurator />`
- Step 3: `<DocumentPreview />`
- Step 4: `<ExportPanel />`

Progress bar at top showing current step. Back/Next navigation. Step labels: Select Analyses → Configure → Preview → Export.

**Step 4: Run frontend type check**

```bash
cd frontend && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add frontend/src/features/publish/
git commit -m "feat: rewrite PublishPage as 4-step wizard with unified picker and export"
```

---

## Phase 6: Integration & Deploy

### Task 17: End-to-end testing

**Files:**
- Modify: `e2e/tests/publish.spec.ts`

Update E2E tests to cover:
1. Page loads at `/publish` with step 1 visible
2. "All Analyses" tab shows completed analyses
3. Selecting an analysis adds it to cart
4. Proceeding to Step 2 shows document configurator
5. AI narrative toggle triggers generation (mock or real)
6. Preview renders sections correctly
7. Export button triggers download

**Commit:**

```bash
git add e2e/tests/publish.spec.ts
git commit -m "test: update E2E tests for publish feature redesign"
```

---

### Task 18: Deploy and verify

**Step 1: Run all tests**

```bash
cd backend && vendor/bin/pest
cd frontend && npx vitest run
cd frontend && npx tsc --noEmit
```

**Step 2: Build and deploy**

```bash
./deploy.sh
```

**Step 3: Verify in production**

1. Navigate to `https://parthenon.acumenus.net/publish`
2. Verify unified picker loads with completed analyses
3. Select an analysis, proceed through all 4 steps
4. Test DOCX export downloads correctly
5. Test AI narrative generation (if AI service is running)

**Step 4: Commit devlog**

```bash
git add docs/devlog/publish-redesign.md
git commit -m "docs: add publish feature redesign devlog"
git push origin main
```
