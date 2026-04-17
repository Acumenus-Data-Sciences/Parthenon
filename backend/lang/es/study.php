<?php

declare(strict_types=1);

return [
    'created' => 'Estudio creado.',
    'updated' => 'Estudio actualizado.',
    'deleted' => 'Estudio eliminado.',
    'execution_started' => 'Ejecución del estudio iniciada. Todos los análisis se han puesto en cola.',
    'analysis_added' => 'Análisis añadido al estudio.',
    'transitioned' => "Estudio cambiado a ':status'.",
    'analysis_removed' => 'Análisis eliminado del estudio.',
    'analysis_not_in_study' => 'El análisis no pertenece a este estudio.',

    'errors' => [
        'retrieve_many' => 'No se pudieron recuperar los estudios.',
        'create' => 'No se pudo crear el estudio.',
        'retrieve' => 'No se pudo recuperar el estudio.',
        'update' => 'No se pudo actualizar el estudio.',
        'delete' => 'No se pudo eliminar el estudio.',
        'execute' => 'No se pudo ejecutar el estudio.',
        'retrieve_progress' => 'No se pudo recuperar el progreso del estudio.',
        'retrieve_analyses' => 'No se pudieron recuperar los análisis del estudio.',
        'add_analysis' => 'No se pudo añadir el análisis al estudio.',
        'invalid_analysis_type' => 'Tipo de análisis no válido.',
        'add_analysis_failed' => 'No se pudo añadir el análisis.',
        'invalid_status_transition' => 'Transición de estado no válida.',
        'transition' => 'No se pudo cambiar el estado del estudio.',
        'remove_analysis' => 'No se pudo eliminar el análisis del estudio.',
    ],
];
