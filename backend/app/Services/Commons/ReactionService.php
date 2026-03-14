<?php

namespace App\Services\Commons;

use App\Events\Commons\ReactionUpdated;
use App\Models\Commons\Message;
use App\Models\Commons\Reaction;
use App\Models\User;
use Illuminate\Support\Collection;

class ReactionService
{
    /**
     * Toggle a reaction on a message. Returns the updated reaction summary.
     *
     * @return array<string, array{count: int, users: list<array{id: int, name: string}>, reacted: bool}>
     */
    public function toggleReaction(Message $message, User $user, string $emoji): array
    {
        $existing = Reaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $emoji)
            ->first();

        if ($existing) {
            $existing->delete();
            $action = 'removed';
        } else {
            Reaction::create([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
            $action = 'added';
        }

        $summary = $this->getReactionSummary($message, $user);

        // Build broadcast summary without `reacted` (broadcast goes to all users)
        $broadcastSummary = $this->getReactionSummary($message, null);

        broadcast(new ReactionUpdated(
            $message,
            $emoji,
            $user,
            $action,
            $broadcastSummary,
        ))->toOthers();

        return $summary;
    }

    /**
     * Get reaction summary for a single message.
     * When $currentUser is provided, `reacted` reflects that user's state.
     * When $currentUser is null, `reacted` is omitted (for broadcasts).
     *
     * @return array<string, array{count: int, users: list<array{id: int, name: string}>}>
     */
    public function getReactionSummary(Message $message, ?User $currentUser): array
    {
        $reactions = Reaction::where('message_id', $message->id)
            ->with('user:id,name')
            ->get();

        return $this->buildSummary($reactions, $currentUser);
    }

    /**
     * Batch-load reaction summaries for a collection of messages.
     * Returns [message_id => summary].
     *
     * @param Collection<int, Message> $messages
     * @return array<int, array<string, array{count: int, users: list<array{id: int, name: string}>}>>
     */
    public function getReactionSummaryForMessages(Collection $messages, ?User $currentUser): array
    {
        $messageIds = $messages->pluck('id')->all();

        if (empty($messageIds)) {
            return [];
        }

        $reactions = Reaction::whereIn('message_id', $messageIds)
            ->with('user:id,name')
            ->get()
            ->groupBy('message_id');

        $result = [];
        foreach ($messageIds as $id) {
            $messageReactions = $reactions->get($id, collect());
            $summary = $this->buildSummary($messageReactions, $currentUser);
            if (! empty($summary)) {
                $result[$id] = $summary;
            }
        }

        return $result;
    }

    /**
     * @param Collection<int, Reaction> $reactions
     * @return array<string, mixed>
     */
    private function buildSummary(Collection $reactions, ?User $currentUser): array
    {
        $grouped = $reactions->groupBy('emoji');
        $summary = [];

        foreach ($grouped as $emoji => $emojiReactions) {
            $entry = [
                'count' => $emojiReactions->count(),
                'users' => $emojiReactions->map(fn (Reaction $r) => [
                    'id' => $r->user->id,
                    'name' => $r->user->name,
                ])->values()->all(),
            ];

            if ($currentUser !== null) {
                $entry['reacted'] = $emojiReactions->contains('user_id', $currentUser->id);
            }

            $summary[$emoji] = $entry;
        }

        return $summary;
    }
}
