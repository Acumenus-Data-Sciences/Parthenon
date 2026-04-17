<?php

declare(strict_types=1);

return [
    'created' => 'Studie erstellt.',
    'updated' => 'Studie aktualisiert.',
    'deleted' => 'Studie gelöscht.',
    'execution_started' => 'Studienausführung gestartet. Alle Analysen wurden in die Warteschlange gestellt.',
    'analysis_added' => 'Analyse zur Studie hinzugefügt.',
    'transitioned' => "Studie zu ':status' überführt.",
    'analysis_removed' => 'Analyse aus der Studie entfernt.',
    'analysis_not_in_study' => 'Die Analyse gehört nicht zu dieser Studie.',

    'errors' => [
        'retrieve_many' => 'Studien konnten nicht abgerufen werden.',
        'create' => 'Studie konnte nicht erstellt werden.',
        'retrieve' => 'Studie konnte nicht abgerufen werden.',
        'update' => 'Studie konnte nicht aktualisiert werden.',
        'delete' => 'Studie konnte nicht gelöscht werden.',
        'execute' => 'Studie konnte nicht ausgeführt werden.',
        'retrieve_progress' => 'Studienfortschritt konnte nicht abgerufen werden.',
        'retrieve_analyses' => 'Studienanalysen konnten nicht abgerufen werden.',
        'add_analysis' => 'Analyse konnte nicht zur Studie hinzugefügt werden.',
        'invalid_analysis_type' => 'Ungültiger Analysetyp.',
        'add_analysis_failed' => 'Analyse konnte nicht hinzugefügt werden.',
        'invalid_status_transition' => 'Ungültiger Statusübergang.',
        'transition' => 'Studienstatus konnte nicht geändert werden.',
        'remove_analysis' => 'Analyse konnte nicht aus der Studie entfernt werden.',
    ],
];
