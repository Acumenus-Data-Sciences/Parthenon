<?php

declare(strict_types=1);

return [
    'created' => '研究已创建。',
    'updated' => '研究已更新。',
    'deleted' => '研究已删除。',
    'execution_started' => '研究执行已开始。所有分析都已加入队列。',
    'analysis_added' => '分析已添加到研究。',
    'transitioned' => "研究已转换到 ':status'。",
    'analysis_removed' => '分析已从研究中移除。',
    'analysis_not_in_study' => '该分析不属于此研究。',

    'errors' => [
        'retrieve_many' => '无法获取研究。',
        'create' => '无法创建研究。',
        'retrieve' => '无法获取研究。',
        'update' => '无法更新研究。',
        'delete' => '无法删除研究。',
        'execute' => '无法执行研究。',
        'retrieve_progress' => '无法获取研究进度。',
        'retrieve_analyses' => '无法获取研究分析。',
        'add_analysis' => '无法将分析添加到研究。',
        'invalid_analysis_type' => '分析类型无效。',
        'add_analysis_failed' => '无法添加分析。',
        'invalid_status_transition' => '状态转换无效。',
        'transition' => '无法转换研究状态。',
        'remove_analysis' => '无法从研究中移除分析。',
    ],
];
