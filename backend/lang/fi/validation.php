<?php

declare(strict_types=1);

return [
    'failed' => 'Annetut tiedot eivät kelpaa.',
    'array' => ':attribute-kentän on oltava lista.',
    'boolean' => ':attribute-kentän on oltava tosi tai epätosi.',
    'confirmed' => ':attribute-vahvistus ei täsmää.',
    'date' => ':attribute-kentän on oltava kelvollinen päivämäärä.',
    'email' => ':attribute-kentän on oltava kelvollinen sähköpostiosoite.',
    'exists' => 'Valittu :attribute ei kelpaa.',
    'file' => ':attribute-kentän on oltava tiedosto.',
    'image' => ':attribute-kentän on oltava kuva.',
    'in' => 'Valittu :attribute ei kelpaa.',
    'integer' => ':attribute-kentän on oltava kokonaisluku.',
    'max' => [
        'array' => ':attribute-kentässä saa olla enintään :max kohdetta.',
        'file' => ':attribute-kenttä saa olla enintään :max kilotavua.',
        'numeric' => ':attribute-kenttä saa olla enintään :max.',
        'string' => ':attribute-kenttä saa olla enintään :max merkkiä.',
    ],
    'mimes' => ':attribute-kentän on oltava tiedostotyyppiä: :values.',
    'min' => [
        'array' => ':attribute-kentässä on oltava vähintään :min kohdetta.',
        'file' => ':attribute-kentän on oltava vähintään :min kilotavua.',
        'numeric' => ':attribute-kentän on oltava vähintään :min.',
        'string' => ':attribute-kentän on oltava vähintään :min merkkiä.',
    ],
    'numeric' => ':attribute-kentän on oltava numero.',
    'required' => ':attribute-kenttä on pakollinen.',
    'string' => ':attribute-kentän on oltava merkkijono.',
    'unique' => ':attribute on jo käytössä.',
    'url' => ':attribute-kentän on oltava kelvollinen URL-osoite.',

    'attributes' => [
        'avatar' => 'avatar',
        'bio' => 'kuvaus',
        'current_password' => 'nykyinen salasana',
        'department' => 'osasto',
        'email' => 'sähköposti',
        'job_title' => 'tehtävänimike',
        'locale' => 'kieli',
        'name' => 'nimi',
        'new_password' => 'uusi salasana',
        'organization' => 'organisaatio',
        'password' => 'salasana',
        'phone_number' => 'puhelinnumero',
        'theme_preference' => 'teema-asetus',
    ],
];
