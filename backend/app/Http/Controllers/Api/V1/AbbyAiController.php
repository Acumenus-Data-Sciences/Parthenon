<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\App\AbbyConversation;
use App\Models\App\AbbyMessage;
use App\Models\App\AbbyUserProfile;
use App\Services\AI\AbbyAiService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[Group('AI Assistant (Abby)', weight: 210)]
class AbbyAiController extends Controller
{
    public function __construct(
        private readonly AbbyAiService $abbyAi,
    ) {}

    /**
     * POST /api/v1/abby/build-cohort
     * Parse NL prompt → cohort expression JSON (does NOT save).
     */
    public function buildCohort(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => 'required|string|min:10|max:3000',
            'source_id' => 'sometimes|nullable|integer',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $result = $this->abbyAi->buildCohortFromPrompt(
            $validated['prompt'],
            $validated['source_id'] ?? null,
            $validated['page_context'] ?? 'cohort-builder',
        );

        return response()->json($result);
    }

    /**
     * POST /api/v1/abby/create-cohort
     * Parse NL prompt → build cohort expression → persist CohortDefinition.
     * Returns the saved cohort + full build output for immediate UI display.
     */
    public function createCohort(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => 'required|string|min:10|max:3000',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $result = $this->abbyAi->buildCohortAndSave(
            $validated['prompt'],
            $request->user(),
            $validated['page_context'] ?? 'cohort-builder',
        );

        return response()->json([
            'data' => $result['cohort_definition'],
            'build' => [
                'expression' => $result['expression'],
                'explanation' => $result['explanation'],
                'concept_sets' => $result['concept_sets'],
                'warnings' => $result['warnings'],
                'llm_confidence' => $result['llm_confidence'],
            ],
            'message' => 'Cohort created. Review the definition and generate when ready.',
        ], 201);
    }

    /**
     * POST /api/v1/abby/chat
     * Page-aware conversational assistant powered by MedGemma.
     * Abby adapts her persona and knowledge focus to the current UI page.
     *
     * page_context values: cohort-builder | vocabulary-search | achilles | dqd |
     *                      risk-scores | network | patient-profiles | studies | general
     */
    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|min:1|max:4000',
            'page_context' => 'sometimes|string|max:64',
            'page_data' => 'sometimes|array',
            'history' => 'sometimes|array',
            'history.*.role' => 'required_with:history|string|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:4000',
            'user_profile' => 'sometimes|array',
            'user_profile.name' => 'sometimes|string|max:255',
            'user_profile.roles' => 'sometimes|array',
            'conversation_id' => 'sometimes|nullable|integer|exists:abby_conversations,id',
        ]);

        $user = $request->user();
        $abbyProfile = $user ? AbbyUserProfile::where('user_id', $user->id)->first() : null;
        $profileData = $abbyProfile ? $abbyProfile->toArray() : [];

        $userProfilePayload = $validated['user_profile'] ?? [];
        $userProfilePayload['research_profile'] = $profileData;

        $result = $this->abbyAi->chat(
            message: $validated['message'],
            pageContext: $validated['page_context'] ?? 'general',
            pageData: $validated['page_data'] ?? [],
            history: $validated['history'] ?? [],
            userProfile: $userProfilePayload,
            userId: $user?->id,
            conversationId: $validated['conversation_id'] ?? null,
        );

        // Persist messages to conversation
        $conversationId = $validated['conversation_id'] ?? null;

        if ($user) {
            try {
                if ($conversationId) {
                    $conversation = AbbyConversation::forUser($user->id)->find($conversationId);
                } else {
                    $conversation = AbbyConversation::create([
                        'user_id' => $user->id,
                        'title' => mb_substr($validated['message'], 0, 500),
                        'page_context' => $validated['page_context'] ?? 'general',
                    ]);
                }

                if ($conversation) {
                    AbbyMessage::create([
                        'conversation_id' => $conversation->id,
                        'role' => 'user',
                        'content' => $validated['message'],
                        'metadata' => isset($validated['page_data']) ? ['page_data' => $validated['page_data']] : null,
                    ]);

                    $assistantContent = $result['reply'] ?? $result['message'] ?? '';
                    $assistantMetadata = null;
                    if (isset($result['suggestions'])) {
                        $assistantMetadata = ['suggestions' => $result['suggestions']];
                    }

                    AbbyMessage::create([
                        'conversation_id' => $conversation->id,
                        'role' => 'assistant',
                        'content' => $assistantContent,
                        'metadata' => $assistantMetadata,
                    ]);

                    $result['conversation_id'] = $conversation->id;
                }
            } catch (\Throwable) {
                // Persistence failure should not break the chat response
            }
        }

        return response()->json($result);
    }

    /**
     * POST /api/v1/abby/chat/stream
     * SSE streaming version of the chat endpoint.
     * Proxies to the Python AI service streaming endpoint.
     */
    public function chatStream(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|min:1|max:4000',
            'page_context' => 'sometimes|string|max:64',
            'page_data' => 'sometimes|array',
            'history' => 'sometimes|array',
            'history.*.role' => 'required_with:history|string|in:user,assistant',
            'history.*.content' => 'required_with:history|string|max:4000',
            'user_profile' => 'sometimes|array',
            'user_profile.name' => 'sometimes|string|max:255',
            'user_profile.roles' => 'sometimes|array',
            'conversation_id' => 'sometimes|nullable|integer|exists:abby_conversations,id',
        ]);

        $aiBaseUrl = config('services.ai.base_url', 'http://python-ai:8000');
        $user = $request->user();

        // Load user research profile for stream payload
        $abbyProfile = $user ? AbbyUserProfile::where('user_id', $user->id)->first() : null;
        $profileData = $abbyProfile ? $abbyProfile->toArray() : [];
        $userProfilePayload = $validated['user_profile'] ?? [];
        $userProfilePayload['research_profile'] = $profileData;

        // Resolve or create conversation before streaming
        $conversationId = $validated['conversation_id'] ?? null;
        $conversation = null;

        if ($user) {
            try {
                if ($conversationId) {
                    $conversation = AbbyConversation::forUser($user->id)->find($conversationId);
                } else {
                    $conversation = AbbyConversation::create([
                        'user_id' => $user->id,
                        'title' => mb_substr($validated['message'], 0, 500),
                        'page_context' => $validated['page_context'] ?? 'general',
                    ]);
                }

                if ($conversation) {
                    AbbyMessage::create([
                        'conversation_id' => $conversation->id,
                        'role' => 'user',
                        'content' => $validated['message'],
                        'metadata' => isset($validated['page_data']) ? ['page_data' => $validated['page_data']] : null,
                    ]);
                }
            } catch (\Throwable) {
                // Persistence failure should not break the stream
            }
        }

        $resolvedConversation = $conversation;

        return new StreamedResponse(function () use ($validated, $aiBaseUrl, $resolvedConversation, $userProfilePayload, $user): void {
            $ch = curl_init("{$aiBaseUrl}/abby/chat/stream");
            if ($ch === false) {
                echo 'data: '.json_encode(['error' => 'Failed to connect to AI service'])."\n\n";
                echo "data: [DONE]\n\n";

                return;
            }

            $fullResponse = '';
            $pageData = $validated['page_data'] ?? [];
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode([
                    'message' => $validated['message'],
                    'page_context' => $validated['page_context'] ?? 'general',
                    'page_data' => empty($pageData) ? (object) [] : $pageData,
                    'history' => $validated['history'] ?? [],
                    'user_profile' => $userProfilePayload ?: null,
                    'user_id' => $user?->id,
                    'conversation_id' => $resolvedConversation?->id,
                ]),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: text/event-stream',
                ],
                CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$fullResponse, $resolvedConversation) {
                    // Accumulate streamed content for persistence
                    if ($resolvedConversation) {
                        foreach (explode("\n", $data) as $line) {
                            $line = trim($line);
                            if (str_starts_with($line, 'data: ') && $line !== 'data: [DONE]') {
                                $decoded = json_decode(substr($line, 6), true);
                                if (isset($decoded['token'])) {
                                    $fullResponse .= $decoded['token'];
                                }
                            }
                        }
                    }

                    // Send conversation_id in the first chunk if we created one
                    echo $data;
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();

                    return strlen($data);
                },
                CURLOPT_TIMEOUT => 120,
            ]);

            // Send conversation_id event before streaming AI response
            if ($resolvedConversation) {
                echo 'data: '.json_encode(['conversation_id' => $resolvedConversation->id])."\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            }

            curl_exec($ch);

            if (curl_errno($ch)) {
                echo 'data: '.json_encode(['error' => 'AI service error: '.curl_error($ch)])."\n\n";
                echo "data: [DONE]\n\n";
            }

            curl_close($ch);

            // Persist assistant response after stream completes
            if ($resolvedConversation && $fullResponse !== '') {
                try {
                    AbbyMessage::create([
                        'conversation_id' => $resolvedConversation->id,
                        'role' => 'assistant',
                        'content' => $fullResponse,
                    ]);
                } catch (\Throwable) {
                    // Persistence failure should not break the stream
                }
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * POST /api/v1/abby/suggest-criteria
     */
    public function suggestCriteria(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'domain' => 'required|string|in:condition,drug,procedure,measurement,observation',
            'description' => 'required|string|min:2|max:500',
        ]);

        $suggestions = $this->abbyAi->suggestCriteria(
            $validated['domain'],
            $validated['description'],
        );

        return response()->json(['suggestions' => $suggestions]);
    }

    /**
     * POST /api/v1/abby/explain
     */
    public function explain(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $explanation = $this->abbyAi->explainExpression($validated['expression']);

        return response()->json(['explanation' => $explanation]);
    }

    /**
     * POST /api/v1/abby/suggest-protocol
     * AI-assisted study protocol suggestion based on title, description, and type.
     */
    public function suggestProtocol(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|min:5|max:500',
            'description' => 'sometimes|string|max:3000',
            'study_type' => 'required|string|max:100',
        ]);

        $result = $this->abbyAi->suggestStudyProtocol(
            $validated['title'],
            $validated['description'] ?? '',
            $validated['study_type'],
        );

        return response()->json($result);
    }

    /**
     * POST /api/v1/abby/refine
     */
    public function refine(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'expression' => 'required|array',
            'prompt' => 'required|string|min:5|max:2000',
            'page_context' => 'sometimes|string|max:64',
        ]);

        $result = $this->abbyAi->refineCohort(
            $validated['expression'],
            $validated['prompt'],
        );

        return response()->json($result);
    }
}
