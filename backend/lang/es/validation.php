<?php

declare(strict_types=1);

return [
    'failed' => 'Los datos proporcionados no son válidos.',
    'array' => 'El campo :attribute debe ser una lista.',
    'boolean' => 'El campo :attribute debe ser verdadero o falso.',
    'confirmed' => 'La confirmación de :attribute no coincide.',
    'date' => 'El campo :attribute debe ser una fecha válida.',
    'email' => 'El campo :attribute debe ser una dirección de correo válida.',
    'exists' => 'El :attribute seleccionado no es válido.',
    'file' => 'El campo :attribute debe ser un archivo.',
    'image' => 'El campo :attribute debe ser una imagen.',
    'in' => 'El :attribute seleccionado no es válido.',
    'integer' => 'El campo :attribute debe ser un entero.',
    'max' => [
        'array' => 'El campo :attribute no debe tener más de :max elementos.',
        'file' => 'El campo :attribute no debe superar :max kilobytes.',
        'numeric' => 'El campo :attribute no debe ser mayor que :max.',
        'string' => 'El campo :attribute no debe superar :max caracteres.',
    ],
    'mimes' => 'El campo :attribute debe ser un archivo de tipo: :values.',
    'min' => [
        'array' => 'El campo :attribute debe tener al menos :min elementos.',
        'file' => 'El campo :attribute debe tener al menos :min kilobytes.',
        'numeric' => 'El campo :attribute debe ser al menos :min.',
        'string' => 'El campo :attribute debe tener al menos :min caracteres.',
    ],
    'numeric' => 'El campo :attribute debe ser un número.',
    'required' => 'El campo :attribute es obligatorio.',
    'string' => 'El campo :attribute debe ser una cadena de texto.',
    'unique' => 'El valor de :attribute ya está en uso.',
    'url' => 'El campo :attribute debe ser una URL válida.',

    'attributes' => [
        'avatar' => 'avatar',
        'bio' => 'biografía',
        'current_password' => 'contraseña actual',
        'department' => 'departamento',
        'email' => 'correo electrónico',
        'job_title' => 'cargo',
        'locale' => 'idioma',
        'name' => 'nombre',
        'new_password' => 'nueva contraseña',
        'organization' => 'organización',
        'password' => 'contraseña',
        'phone_number' => 'teléfono',
        'theme_preference' => 'preferencia de tema',
    ],
];
