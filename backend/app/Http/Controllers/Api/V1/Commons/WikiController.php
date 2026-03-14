<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\WikiArticle;
use App\Models\Commons\WikiRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WikiController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = WikiArticle::with('author:id,name')
            ->orderByDesc('updated_at');

        if ($request->filled('q')) {
            $query->whereRaw(
                "to_tsvector('english', title || ' ' || body) @@ plainto_tsquery('english', ?)",
                [$request->input('q')]
            );
        }

        if ($request->filled('tag')) {
            $query->whereJsonContains('tags', $request->input('tag'));
        }

        $articles = $query->limit(50)->get();

        return response()->json(['data' => $articles]);
    }

    public function show(string $slug): JsonResponse
    {
        $article = WikiArticle::where('slug', $slug)
            ->with(['author:id,name', 'lastEditor:id,name'])
            ->firstOrFail();

        return response()->json(['data' => $article]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string|max:50000',
            'tags' => 'nullable|array',
            'tags.*' => 'string|max:50',
        ]);

        $slug = Str::slug($validated['title']);

        // Ensure unique slug
        $baseSlug = $slug;
        $counter = 1;
        while (WikiArticle::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$counter++;
        }

        $article = WikiArticle::create([
            'title' => $validated['title'],
            'slug' => $slug,
            'body' => $validated['body'],
            'tags' => $validated['tags'] ?? [],
            'created_by' => $request->user()->id,
            'last_edited_by' => $request->user()->id,
        ]);

        // Save initial revision
        WikiRevision::create([
            'article_id' => $article->id,
            'body' => $validated['body'],
            'edited_by' => $request->user()->id,
            'edit_summary' => 'Initial version',
        ]);

        $article->load('author:id,name');

        return response()->json(['data' => $article], 201);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $article = WikiArticle::where('slug', $slug)->firstOrFail();

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'body' => 'sometimes|string|max:50000',
            'tags' => 'sometimes|array',
            'tags.*' => 'string|max:50',
            'edit_summary' => 'nullable|string|max:255',
        ]);

        // Save revision if body changed
        if (isset($validated['body']) && $validated['body'] !== $article->body) {
            WikiRevision::create([
                'article_id' => $article->id,
                'body' => $validated['body'],
                'edited_by' => $request->user()->id,
                'edit_summary' => $validated['edit_summary'] ?? null,
            ]);
        }

        $updateData = array_intersect_key($validated, array_flip(['title', 'body', 'tags']));
        $updateData['last_edited_by'] = $request->user()->id;

        $article->update($updateData);
        $article->load(['author:id,name', 'lastEditor:id,name']);

        return response()->json(['data' => $article]);
    }

    public function destroy(Request $request, string $slug): JsonResponse
    {
        $article = WikiArticle::where('slug', $slug)->firstOrFail();

        if ($article->created_by !== $request->user()->id) {
            abort(403, 'You can only delete your own articles.');
        }

        $article->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function revisions(string $slug): JsonResponse
    {
        $article = WikiArticle::where('slug', $slug)->firstOrFail();

        $revisions = WikiRevision::where('article_id', $article->id)
            ->with('editor:id,name')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json(['data' => $revisions]);
    }
}
