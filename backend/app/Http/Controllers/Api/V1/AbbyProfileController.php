<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateAbbyProfileRequest;
use App\Models\App\AbbyUserProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AbbyProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $profile = AbbyUserProfile::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'research_interests' => [],
                'expertise_domains' => (object) [],
                'interaction_preferences' => (object) [],
                'frequently_used' => (object) [],
            ]
        );

        return response()->json(['data' => $profile]);
    }

    public function update(UpdateAbbyProfileRequest $request): JsonResponse
    {
        $profile = AbbyUserProfile::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'research_interests' => [],
                'expertise_domains' => (object) [],
                'interaction_preferences' => (object) [],
                'frequently_used' => (object) [],
            ]
        );

        $profile->update($request->validated());

        return response()->json(['data' => $profile->fresh()]);
    }

    public function reset(Request $request): JsonResponse
    {
        AbbyUserProfile::where('user_id', $request->user()->id)->update([
            'research_interests' => DB::raw("'{}'::text[]"),
            'expertise_domains' => json_encode((object) []),
            'interaction_preferences' => json_encode((object) []),
            'frequently_used' => json_encode((object) []),
            'learned_at' => now(),
        ]);

        return response()->json(['message' => 'Profile reset successfully']);
    }
}
