<?php

namespace Database\Seeders;

use App\Models\App\PacsConnection;
use Illuminate\Database\Seeder;

class PacsConnectionSeeder extends Seeder
{
    public function run(): void
    {
        PacsConnection::updateOrCreate(
            ['name' => 'Local Orthanc'],
            [
                'type' => 'orthanc',
                'base_url' => 'http://orthanc:8042/dicom-web',
                'auth_type' => 'none',
                'is_default' => true,
                'is_active' => true,
            ],
        );
    }
}
