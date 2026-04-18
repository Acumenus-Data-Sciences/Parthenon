<?php

declare(strict_types=1);

return [
    'created' => 'تم إنشاء الدراسة.',
    'updated' => 'تم تحديث الدراسة.',
    'deleted' => 'تم حذف الدراسة.',
    'execution_started' => 'بدأ تنفيذ الدراسة. تم وضع جميع التحليلات في قائمة الانتظار.',
    'analysis_added' => 'تمت إضافة التحليل إلى الدراسة.',
    'transitioned' => "تم نقل الدراسة إلى ':status'.",
    'analysis_removed' => 'تمت إزالة التحليل من الدراسة.',
    'analysis_not_in_study' => 'التحليل لا ينتمي إلى هذه الدراسة.',

    'errors' => [
        'retrieve_many' => 'تعذر استرداد الدراسات.',
        'create' => 'تعذر إنشاء الدراسة.',
        'retrieve' => 'تعذر استرداد الدراسة.',
        'update' => 'تعذر تحديث الدراسة.',
        'delete' => 'تعذر حذف الدراسة.',
        'execute' => 'تعذر تنفيذ الدراسة.',
        'retrieve_progress' => 'تعذر استرداد تقدم الدراسة.',
        'retrieve_analyses' => 'تعذر استرداد تحليلات الدراسة.',
        'add_analysis' => 'تعذرت إضافة التحليل إلى الدراسة.',
        'invalid_analysis_type' => 'نوع التحليل غير صالح.',
        'add_analysis_failed' => 'تعذرت إضافة التحليل.',
        'invalid_status_transition' => 'انتقال الحالة غير صالح.',
        'transition' => 'تعذر تغيير حالة الدراسة.',
        'remove_analysis' => 'تعذرت إزالة التحليل من الدراسة.',
    ],
];
