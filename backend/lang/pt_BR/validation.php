<?php

declare(strict_types=1);

return [
    'failed' => 'Os dados fornecidos são inválidos.',
    'array' => 'O campo :attribute deve ser uma lista.',
    'boolean' => 'O campo :attribute deve ser verdadeiro ou falso.',
    'confirmed' => 'A confirmação de :attribute não confere.',
    'date' => 'O campo :attribute deve ser uma data válida.',
    'email' => 'O campo :attribute deve ser um endereço de e-mail válido.',
    'exists' => 'O :attribute selecionado é inválido.',
    'file' => 'O campo :attribute deve ser um arquivo.',
    'image' => 'O campo :attribute deve ser uma imagem.',
    'in' => 'O :attribute selecionado é inválido.',
    'integer' => 'O campo :attribute deve ser um número inteiro.',
    'max' => [
        'array' => 'O campo :attribute não deve ter mais de :max itens.',
        'file' => 'O campo :attribute não deve ser maior que :max kilobytes.',
        'numeric' => 'O campo :attribute não deve ser maior que :max.',
        'string' => 'O campo :attribute não deve ter mais de :max caracteres.',
    ],
    'mimes' => 'O campo :attribute deve ser um arquivo do tipo: :values.',
    'min' => [
        'array' => 'O campo :attribute deve ter pelo menos :min itens.',
        'file' => 'O campo :attribute deve ter pelo menos :min kilobytes.',
        'numeric' => 'O campo :attribute deve ser pelo menos :min.',
        'string' => 'O campo :attribute deve ter pelo menos :min caracteres.',
    ],
    'numeric' => 'O campo :attribute deve ser um número.',
    'required' => 'O campo :attribute é obrigatório.',
    'string' => 'O campo :attribute deve ser uma string.',
    'unique' => 'O valor de :attribute já está em uso.',
    'url' => 'O campo :attribute deve ser uma URL válida.',

    'attributes' => [
        'avatar' => 'avatar',
        'bio' => 'biografia',
        'current_password' => 'senha atual',
        'department' => 'departamento',
        'email' => 'e-mail',
        'job_title' => 'cargo',
        'locale' => 'idioma',
        'name' => 'nome',
        'new_password' => 'nova senha',
        'organization' => 'organização',
        'password' => 'senha',
        'phone_number' => 'telefone',
        'theme_preference' => 'preferência de tema',
    ],
];
