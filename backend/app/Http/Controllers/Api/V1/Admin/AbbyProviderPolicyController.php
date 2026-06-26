<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\App\AbbyProviderProfile;
use App\Models\App\AbbySurfacePolicy;
use App\Services\AI\AbbyProviderPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * @group Administration
 */
class AbbyProviderPolicyController extends Controller
{
    public function __construct(private readonly AbbyProviderPolicyService $policies) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'profiles' => AbbyProviderProfile::orderBy('profile_id')->get(),
            'surface_policies' => AbbySurfacePolicy::orderBy('surface')->get(),
            'catalog' => $this->policies->catalog(),
        ]);
    }

    public function storeProfile(Request $request): JsonResponse
    {
        $validated = $this->validateProfile($request);
        $this->policies->throwIfErrors(
            $this->policies->validateProfileAttributes($validated),
            'profile',
        );

        $profile = AbbyProviderProfile::create(array_merge($validated, [
            'updated_by' => $request->user()->id,
        ]));

        return response()->json($profile->fresh(), 201);
    }

    public function updateProfile(Request $request, string $profileId): JsonResponse
    {
        $profile = AbbyProviderProfile::where('profile_id', $profileId)->firstOrFail();
        $validated = $this->validateProfile($request, updating: true, existingProfileId: $profileId);
        $merged = array_merge($profile->toArray(), $validated);
        $this->policies->throwIfErrors(
            $this->policies->validateProfileAttributes($merged),
            'profile',
        );

        $profile->fill(array_merge($validated, ['updated_by' => $request->user()->id]));
        $profile->save();

        return response()->json($profile->fresh());
    }

    public function archiveProfile(Request $request, string $profileId): JsonResponse
    {
        $profile = AbbyProviderProfile::where('profile_id', $profileId)->firstOrFail();
        $references = $this->policies->profilePolicyReferences($profileId);

        if ($references !== []) {
            return $this->profileInUseResponse($references);
        }

        $profile->forceFill([
            'is_enabled' => false,
            'updated_by' => $request->user()->id,
        ])->save();

        return response()->json($profile->fresh());
    }

    public function destroyProfile(string $profileId): JsonResponse
    {
        $profile = AbbyProviderProfile::where('profile_id', $profileId)->firstOrFail();
        $references = $this->policies->profilePolicyReferences($profileId);

        if ($references !== []) {
            return $this->profileInUseResponse($references);
        }

        $profile->delete();

        return response()->json([
            'deleted' => true,
            'profile_id' => $profileId,
        ]);
    }

    public function updateSurfacePolicy(Request $request, string $surface): JsonResponse
    {
        $validated = $request->validate([
            'provider_mode' => ['required', Rule::in(AbbyProviderPolicyService::MODES)],
            'default_profile_id' => ['nullable', 'string', 'max:100'],
            'fallback_profile_ids' => ['sometimes', 'array'],
            'fallback_profile_ids.*' => ['string', 'max:100'],
            'never_send_phi_to_cloud' => ['sometimes', 'boolean'],
            'allow_cloud' => ['sometimes', 'boolean'],
            'required_capabilities' => ['sometimes', 'array'],
            'required_capabilities.*' => ['string', Rule::in(AbbyProviderPolicyService::CAPABILITIES)],
            'settings' => ['sometimes', 'array'],
        ]);

        $policy = AbbySurfacePolicy::firstOrNew(['surface' => $surface]);
        $policy->fill(array_merge($validated, ['updated_by' => $request->user()->id]));
        $this->policies->throwIfErrors(
            $this->policies->validateSurfacePolicy($policy),
            'surface_policy',
        );
        $policy->save();

        return response()->json($policy->fresh());
    }

    public function simulate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'surface' => ['sometimes', 'string', Rule::in(AbbyProviderPolicyService::SURFACES)],
            'message' => ['required', 'string', 'max:12000'],
            'page_context' => ['sometimes', 'string', 'max:120'],
        ]);

        return response()->json($this->policies->simulateRoute($validated));
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProfile(
        Request $request,
        bool $updating = false,
        ?string $existingProfileId = null,
    ): array {
        $required = $updating ? 'sometimes' : 'required';

        return $request->validate([
            'profile_id' => [
                $required,
                'string',
                'max:100',
                Rule::unique('abby_provider_profiles', 'profile_id')->ignore(
                    AbbyProviderProfile::where('profile_id', $existingProfileId)->value('id'),
                ),
            ],
            'display_name' => [$required, 'string', 'max:120'],
            'provider_type' => [$required, 'string', 'max:50'],
            'transport' => [$required, Rule::in(AbbyProviderPolicyService::TRANSPORTS)],
            'entitlement_type' => [$required, Rule::in(AbbyProviderPolicyService::ENTITLEMENTS)],
            'model' => [$required, 'string', 'max:200'],
            'base_url' => ['nullable', 'string', 'max:500'],
            'provider_setting_type' => ['nullable', 'string', 'max:50'],
            'is_enabled' => ['sometimes', 'boolean'],
            'capabilities' => ['sometimes', 'array'],
            'capabilities.*' => ['string', Rule::in(AbbyProviderPolicyService::CAPABILITIES)],
            'safety' => ['sometimes', 'array'],
            'limits' => ['sometimes', 'array'],
            'fallback_profile_ids' => ['sometimes', 'array'],
            'fallback_profile_ids.*' => ['string', 'max:100'],
            'notes' => ['sometimes', 'array'],
            'notes.*' => ['string', 'max:500'],
        ]);
    }

    /**
     * @param  array<int, array{surface: string, role: string, index?: int}>  $references
     */
    private function profileInUseResponse(array $references): JsonResponse
    {
        return response()->json([
            'message' => 'Profile is still referenced by Abby surface policies.',
            'errors' => [
                'profile' => ['profile_in_use'],
            ],
            'references' => $references,
        ], 422);
    }
}
