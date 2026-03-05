<?php

namespace App\Services\Analysis;

use App\Models\App\Study;
use App\Models\App\StudyActivityLog;
use InvalidArgumentException;

class StudyStatusStateMachine
{
    /**
     * Valid status transitions.
     *
     * @var array<string, list<string>>
     */
    private const TRANSITIONS = [
        'draft' => ['protocol_development', 'withdrawn'],
        'protocol_development' => ['feasibility', 'draft', 'withdrawn'],
        'feasibility' => ['irb_review', 'protocol_development', 'withdrawn'],
        'irb_review' => ['recruitment', 'feasibility', 'withdrawn'],
        'recruitment' => ['execution', 'irb_review', 'withdrawn'],
        'execution' => ['analysis', 'recruitment', 'withdrawn'],
        'analysis' => ['synthesis', 'execution', 'withdrawn'],
        'synthesis' => ['manuscript', 'analysis', 'withdrawn'],
        'manuscript' => ['published', 'synthesis', 'withdrawn'],
        'published' => ['archived'],
        'withdrawn' => ['draft'],
        'archived' => [],
    ];

    /**
     * All valid statuses.
     *
     * @return list<string>
     */
    public static function statuses(): array
    {
        return array_keys(self::TRANSITIONS);
    }

    /**
     * Get allowed next statuses for a given status.
     *
     * @return list<string>
     */
    public static function allowedTransitions(string $currentStatus): array
    {
        return self::TRANSITIONS[$currentStatus] ?? [];
    }

    /**
     * Check if a transition is valid.
     */
    public static function canTransition(string $from, string $to): bool
    {
        return in_array($to, self::allowedTransitions($from), true);
    }

    /**
     * Transition a study to a new status, logging the change.
     *
     * @throws InvalidArgumentException
     */
    public static function transition(Study $study, string $newStatus, ?int $userId = null, ?string $ipAddress = null): Study
    {
        $currentStatus = $study->status;

        if (! self::canTransition($currentStatus, $newStatus)) {
            $allowed = implode(', ', self::allowedTransitions($currentStatus));
            throw new InvalidArgumentException(
                "Cannot transition study from '{$currentStatus}' to '{$newStatus}'. Allowed: {$allowed}"
            );
        }

        $study->status = $newStatus;
        $study->save();

        StudyActivityLog::create([
            'study_id' => $study->id,
            'user_id' => $userId,
            'action' => 'status_changed',
            'entity_type' => 'study',
            'entity_id' => $study->id,
            'old_value' => ['status' => $currentStatus],
            'new_value' => ['status' => $newStatus],
            'ip_address' => $ipAddress,
        ]);

        return $study;
    }

    /**
     * Map status to corresponding phase.
     */
    public static function phaseForStatus(string $status): string
    {
        return match ($status) {
            'draft', 'protocol_development', 'feasibility', 'irb_review' => 'pre_study',
            'recruitment', 'execution', 'analysis', 'synthesis' => 'active',
            'manuscript', 'published', 'archived' => 'post_study',
            'withdrawn' => 'withdrawn',
            default => 'pre_study',
        };
    }
}
