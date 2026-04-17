<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadAvatarRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Intervention\Image\Interfaces\ImageManagerInterface;

/**
 * @group User Profile
 */
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
            'message' => __('profile.updated'),
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
        $filename = "avatars/{$user->id}_".substr(md5((string) time()), 0, 8).".{$extension}";

        // Reprocess image via Intervention to strip EXIF/embedded scripts
        $image = $this->imageManager->read($file->getRealPath());
        $image->scaleDown(width: 400, height: 400);

        // Encode and store
        $encoded = match ($extension) {
            'png' => $image->toPng(),
            'webp' => $image->toWebp(quality: 85),
            default => $image->toJpeg(quality: 85),
        };

        if (! Storage::disk('public')->put($filename, (string) $encoded)) {
            return response()->json(['message' => __('profile.avatar_upload_failed')], 500);
        }

        $user->update(['avatar' => $filename]);

        return response()->json([
            'message' => __('profile.avatar_uploaded'),
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

        return response()->json(['message' => __('profile.avatar_removed')]);
    }

    /**
     * PUT /v1/user/theme
     *
     * Persist the authenticated user's theme preference.
     */
    public function updateTheme(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'theme_preference' => ['required', 'string', 'in:dark,light'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $user->update(['theme_preference' => $validated['theme_preference']]);

        return response()->json([
            'theme_preference' => $user->theme_preference,
        ]);
    }

    /**
     * PUT /v1/user/locale
     *
     * Persist the authenticated user's preferred interface language.
     */
    public function updateLocale(Request $request): JsonResponse
    {
        $supportedLocales = array_keys((array) config('parthenon-locales.supported', []));

        $validated = $request->validate([
            'locale' => ['required', 'string', Rule::in($supportedLocales)],
        ]);

        /** @var User $user */
        $user = $request->user();
        $user->update(['locale' => $validated['locale']]);

        return response()->json([
            'locale' => $user->locale,
        ]);
    }
}
