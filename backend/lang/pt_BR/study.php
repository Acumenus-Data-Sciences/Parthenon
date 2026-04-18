<?php

declare(strict_types=1);

return [
    'created' => 'Estudo criado.',
    'updated' => 'Estudo atualizado.',
    'deleted' => 'Estudo excluído.',
    'execution_started' => 'Execução do estudo iniciada. Todas as análises foram enfileiradas.',
    'analysis_added' => 'Análise adicionada ao estudo.',
    'transitioned' => "Estudo alterado para ':status'.",
    'analysis_removed' => 'Análise removida do estudo.',
    'analysis_not_in_study' => 'A análise não pertence a este estudo.',

    'errors' => [
        'retrieve_many' => 'Não foi possível recuperar os estudos.',
        'create' => 'Não foi possível criar o estudo.',
        'retrieve' => 'Não foi possível recuperar o estudo.',
        'update' => 'Não foi possível atualizar o estudo.',
        'delete' => 'Não foi possível excluir o estudo.',
        'execute' => 'Não foi possível executar o estudo.',
        'retrieve_progress' => 'Não foi possível recuperar o progresso do estudo.',
        'retrieve_analyses' => 'Não foi possível recuperar as análises do estudo.',
        'add_analysis' => 'Não foi possível adicionar a análise ao estudo.',
        'invalid_analysis_type' => 'Tipo de análise inválido.',
        'add_analysis_failed' => 'Não foi possível adicionar a análise.',
        'invalid_status_transition' => 'Transição de status inválida.',
        'transition' => 'Não foi possível alterar o status do estudo.',
        'remove_analysis' => 'Não foi possível remover a análise do estudo.',
    ],
];
