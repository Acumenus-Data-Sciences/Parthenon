<?php

declare(strict_types=1);

return [
    'failed' => '제공된 데이터가 유효하지 않습니다.',
    'array' => ':attribute 필드는 배열이어야 합니다.',
    'boolean' => ':attribute 필드는 true 또는 false여야 합니다.',
    'confirmed' => ':attribute 확인 값이 일치하지 않습니다.',
    'date' => ':attribute 필드는 올바른 날짜여야 합니다.',
    'email' => ':attribute 필드는 유효한 이메일 주소여야 합니다.',
    'exists' => '선택한 :attribute이(가) 올바르지 않습니다.',
    'file' => ':attribute 필드는 파일이어야 합니다.',
    'image' => ':attribute 필드는 이미지여야 합니다.',
    'in' => '선택한 :attribute이(가) 올바르지 않습니다.',
    'integer' => ':attribute 필드는 정수여야 합니다.',
    'max' => [
        'array' => ':attribute 필드는 :max개를 초과할 수 없습니다.',
        'file' => ':attribute 필드는 :maxKB를 초과할 수 없습니다.',
        'numeric' => ':attribute 필드는 :max보다 클 수 없습니다.',
        'string' => ':attribute 필드는 :max자를 초과할 수 없습니다.',
    ],
    'mimes' => ':attribute 필드는 다음 형식의 파일이어야 합니다: :values.',
    'min' => [
        'array' => ':attribute 필드는 최소 :min개여야 합니다.',
        'file' => ':attribute 필드는 최소 :minKB여야 합니다.',
        'numeric' => ':attribute 필드는 최소 :min이어야 합니다.',
        'string' => ':attribute 필드는 최소 :min자여야 합니다.',
    ],
    'numeric' => ':attribute 필드는 숫자여야 합니다.',
    'required' => ':attribute 필드는 필수입니다.',
    'string' => ':attribute 필드는 문자열이어야 합니다.',
    'unique' => ':attribute 값은 이미 사용 중입니다.',
    'url' => ':attribute 필드는 유효한 URL이어야 합니다.',

    'attributes' => [
        'avatar' => '아바타',
        'bio' => '소개',
        'current_password' => '현재 비밀번호',
        'department' => '부서',
        'email' => '이메일',
        'job_title' => '직무',
        'locale' => '언어',
        'name' => '이름',
        'new_password' => '새 비밀번호',
        'organization' => '조직',
        'password' => '비밀번호',
        'phone_number' => '전화번호',
        'theme_preference' => '테마 환경설정',
    ],
];
