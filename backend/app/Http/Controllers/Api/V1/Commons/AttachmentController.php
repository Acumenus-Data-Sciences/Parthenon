<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Attachment;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @group Commons
 */
class AttachmentController extends Controller
{
    use AuthorizesRequests;

    private const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

    private const ALLOWED_MIMES = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain', 'text/csv',
        'application/json',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    public function store(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('sendMessage', $channel);

        $request->validate([
            'file' => 'required|file|max:10240', // 10 MB
            'message_id' => 'required|integer|exists:commons_messages,id',
        ]);

        $message = Message::where('id', $request->input('message_id'))
            ->where('channel_id', $channel->id)
            ->firstOrFail();

        $file = $request->file('file');

        if (! in_array($file->getMimeType(), self::ALLOWED_MIMES, true)) {
            return response()->json(['message' => 'File type not allowed.'], 422);
        }

        $path = $file->store("commons/{$channel->id}", 'public');

        $attachment = Attachment::create([
            'message_id' => $message->id,
            'user_id' => $request->user()->id,
            'original_name' => $file->getClientOriginalName(),
            'stored_path' => $path,
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
        ]);

        return response()->json(['data' => $attachment], 201);
    }

    public function download(int $id): StreamedResponse
    {
        $attachment = Attachment::findOrFail($id);

        return Storage::disk('public')->download(
            $attachment->stored_path,
            $attachment->original_name,
        );
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $attachment = Attachment::findOrFail($id);

        // Only the uploader can delete
        if ($attachment->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        Storage::disk('public')->delete($attachment->stored_path);
        $attachment->delete();

        return response()->json(['data' => null]);
    }
}
