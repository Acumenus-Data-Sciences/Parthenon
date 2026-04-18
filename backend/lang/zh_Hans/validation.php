<?php

declare(strict_types=1);

return [
    'failed' => '提供的数据无效。',
    'array' => ':attribute 字段必须是数组。',
    'boolean' => ':attribute 字段必须为 true 或 false。',
    'confirmed' => ':attribute 确认值不匹配。',
    'date' => ':attribute 字段必须是有效日期。',
    'email' => ':attribute 字段必须是有效的电子邮件地址。',
    'exists' => '所选的 :attribute 无效。',
    'file' => ':attribute 字段必须是文件。',
    'image' => ':attribute 字段必须是图片。',
    'in' => '所选的 :attribute 无效。',
    'integer' => ':attribute 字段必须是整数。',
    'max' => [
        'array' => ':attribute 字段不得超过 :max 项。',
        'file' => ':attribute 字段不得大于 :max KB。',
        'numeric' => ':attribute 字段不得大于 :max。',
        'string' => ':attribute 字段不得超过 :max 个字符。',
    ],
    'mimes' => ':attribute 字段必须是以下类型的文件: :values。',
    'min' => [
        'array' => ':attribute 字段至少需要 :min 项。',
        'file' => ':attribute 字段至少需要 :min KB。',
        'numeric' => ':attribute 字段至少为 :min。',
        'string' => ':attribute 字段至少需要 :min 个字符。',
    ],
    'numeric' => ':attribute 字段必须是数字。',
    'required' => ':attribute 字段为必填项。',
    'string' => ':attribute 字段必须是字符串。',
    'unique' => ':attribute 已被使用。',
    'url' => ':attribute 字段必须是有效的 URL。',

    'attributes' => [
        'avatar' => '头像',
        'bio' => '简介',
        'current_password' => '当前密码',
        'department' => '部门',
        'email' => '电子邮件',
        'job_title' => '职位',
        'locale' => '语言',
        'name' => '姓名',
        'new_password' => '新密码',
        'organization' => '组织',
        'password' => '密码',
        'phone_number' => '电话号码',
        'theme_preference' => '主题偏好',
    ],
];
