<?php

declare(strict_types=1);

return [
    'failed' => 'Les données fournies ne sont pas valides.',
    'array' => 'Le champ :attribute doit être une liste.',
    'boolean' => 'Le champ :attribute doit être vrai ou faux.',
    'confirmed' => 'La confirmation de :attribute ne correspond pas.',
    'date' => 'Le champ :attribute doit être une date valide.',
    'email' => 'Le champ :attribute doit être une adresse e-mail valide.',
    'exists' => "Le :attribute sélectionné n'est pas valide.",
    'file' => 'Le champ :attribute doit être un fichier.',
    'image' => 'Le champ :attribute doit être une image.',
    'in' => "Le :attribute sélectionné n'est pas valide.",
    'integer' => 'Le champ :attribute doit être un entier.',
    'max' => [
        'array' => 'Le champ :attribute ne doit pas avoir plus de :max éléments.',
        'file' => 'Le champ :attribute ne doit pas dépasser :max kilo-octets.',
        'numeric' => 'Le champ :attribute ne doit pas être supérieur à :max.',
        'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.',
    ],
    'mimes' => 'Le champ :attribute doit être un fichier de type : :values.',
    'min' => [
        'array' => 'Le champ :attribute doit avoir au moins :min éléments.',
        'file' => 'Le champ :attribute doit faire au moins :min kilo-octets.',
        'numeric' => 'Le champ :attribute doit être au moins :min.',
        'string' => 'Le champ :attribute doit comporter au moins :min caractères.',
    ],
    'numeric' => 'Le champ :attribute doit être un nombre.',
    'required' => 'Le champ :attribute est obligatoire.',
    'string' => 'Le champ :attribute doit être une chaîne de texte.',
    'unique' => 'La valeur de :attribute est déjà utilisée.',
    'url' => 'Le champ :attribute doit être une URL valide.',

    'attributes' => [
        'avatar' => 'avatar',
        'bio' => 'biographie',
        'current_password' => 'mot de passe actuel',
        'department' => 'département',
        'email' => 'e-mail',
        'job_title' => 'poste',
        'locale' => 'langue',
        'name' => 'nom',
        'new_password' => 'nouveau mot de passe',
        'organization' => 'organisation',
        'password' => 'mot de passe',
        'phone_number' => 'téléphone',
        'theme_preference' => 'préférence de thème',
    ],
];
