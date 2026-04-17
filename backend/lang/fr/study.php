<?php

declare(strict_types=1);

return [
    'created' => 'Étude créée.',
    'updated' => 'Étude mise à jour.',
    'deleted' => 'Étude supprimée.',
    'execution_started' => "Exécution de l'étude démarrée. Toutes les analyses ont été mises en file d'attente.",
    'analysis_added' => "Analyse ajoutée à l'étude.",
    'transitioned' => "Étude passée à ':status'.",
    'analysis_removed' => "Analyse retirée de l'étude.",
    'analysis_not_in_study' => "L'analyse n'appartient pas à cette étude.",

    'errors' => [
        'retrieve_many' => 'Impossible de récupérer les études.',
        'create' => "Impossible de créer l'étude.",
        'retrieve' => "Impossible de récupérer l'étude.",
        'update' => "Impossible de mettre à jour l'étude.",
        'delete' => "Impossible de supprimer l'étude.",
        'execute' => "Impossible d'exécuter l'étude.",
        'retrieve_progress' => "Impossible de récupérer la progression de l'étude.",
        'retrieve_analyses' => "Impossible de récupérer les analyses de l'étude.",
        'add_analysis' => "Impossible d'ajouter l'analyse à l'étude.",
        'invalid_analysis_type' => "Type d'analyse non valide.",
        'add_analysis_failed' => "Impossible d'ajouter l'analyse.",
        'invalid_status_transition' => "Transition d'état non valide.",
        'transition' => "Impossible de changer l'état de l'étude.",
        'remove_analysis' => "Impossible de retirer l'analyse de l'étude.",
    ],
];
