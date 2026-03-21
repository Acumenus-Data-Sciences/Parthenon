<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadAvatarRequest;
use App\Models\User;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Interfaces\ImageManagerInterface;

#[Group('User Profile', weight: 11)]
class UserProfileController extends Controller
{
    public function __construct(
        private readonly ImageManagerInterface $imageManager,
    ) {}

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $user->update($request->validated());

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => $user->fresh(),
        ]);
    }

    public function uploadAvatar(UploadAvatarRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        // Delete old avatar if exists
        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $file = $request->file('avatar');
        $extension = $file->getClientOriginalExtension();
        $filename = "avatars/{$user->id}.{$extension}";

        // Reprocess image via Intervention to strip EXIF/embedded scripts
        $image = $this->imageManager->read($file->getRealPath());
        $image->scaleDown(width: 400, height: 400);

        // Encode and store
        $encoded = match ($extension) {
            'png' => $image->toPng(),
            'webp' => $image->toWebp(quality: 85),
            default => $image->toJpeg(quality: 85),
        };

        Storage::disk('public')->put($filename, (string) $encoded);

        $user->update(['avatar' => $filename]);

        return response()->json([
            'message' => 'Avatar uploaded successfully',
            'avatar' => $filename,
        ]);
    }

    public function deleteAvatar(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $user->update(['avatar' => null]);

        return response()->json(['message' => 'Avatar removed successfully']);
    }
}
