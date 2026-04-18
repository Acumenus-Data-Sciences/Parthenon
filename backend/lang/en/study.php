<?php

declare(strict_types=1);

return [
    'created' => 'Study created.',
    'updated' => 'Study updated.',
    'deleted' => 'Study deleted.',
    'execution_started' => 'Study execution started. All analyses have been queued.',
    'analysis_added' => 'Analysis added to study.',
    'transitioned' => "Study transitioned to ':status'.",
    'analysis_removed' => 'Analysis removed from study.',
    'analysis_not_in_study' => 'Analysis does not belong to this study.',

    'errors' => [
        'retrieve_many' => 'Failed to retrieve studies.',
        'create' => 'Failed to create study.',
        'retrieve' => 'Failed to retrieve study.',
        'update' => 'Failed to update study.',
        'delete' => 'Failed to delete study.',
        'execute' => 'Failed to execute study.',
        'retrieve_progress' => 'Failed to retrieve study progress.',
        'retrieve_analyses' => 'Failed to retrieve study analyses.',
        'add_analysis' => 'Failed to add analysis to study.',
        'invalid_analysis_type' => 'Invalid analysis type.',
        'add_analysis_failed' => 'Failed to add analysis.',
        'invalid_status_transition' => 'Invalid status transition.',
        'transition' => 'Failed to transition study status.',
        'remove_analysis' => 'Failed to remove analysis from study.',
    ],
];
