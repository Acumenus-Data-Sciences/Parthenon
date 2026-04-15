<?php

namespace Database\Seeders;

use App\Models\App\OidcEmailAlias;
use Illuminate\Database\Seeder;

class OidcEmailAliasSeeder extends Seeder
{
    public function run(): void
    {
        // Map Authentik work email (incoming) -> existing Parthenon canonical email.
        // Direction per Phase 0 prod snapshot decision. John (jdawe@acumenus.io)
        // is an exact match in both systems and needs no alias row. Lisa
        // (lmiller@acumenus.net) has no Parthenon row yet; reconciliation will
        // JIT-create her via the Parthenon Admins group gate in a later phase.
        $aliases = [
            ['sudoshi@acumenus.io', 'admin@acumenus.net',     'CMIO: Authentik -> existing Parthenon user id 117'],
            ['ebruno@acumenus.net', 'brunoemilyk@gmail.com',  'CEO: Authentik -> existing Parthenon user id 242'],
            ['kpatel@acumenus.net', 'kash37@yahoo.com',       'CIO: Authentik -> existing Parthenon user id 243'],
            ['dmuraco@acumenus.io', 'david.muraco@gmail.com', 'CTO: Authentik -> existing Parthenon user id 119'],
            ['gbock@acumenus.net',  'ghbock1@gmail.com',      'CSO: Authentik -> existing Parthenon user id 195'],
        ];
        foreach ($aliases as [$alias, $canonical, $note]) {
            OidcEmailAlias::updateOrCreate(
                ['alias_email' => strtolower($alias)],
                ['canonical_email' => strtolower($canonical), 'note' => $note]
            );
        }
    }
}
