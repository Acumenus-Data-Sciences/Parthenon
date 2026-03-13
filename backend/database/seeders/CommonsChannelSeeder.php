<?php

namespace Database\Seeders;

use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\User;
use Illuminate\Database\Seeder;

class CommonsChannelSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@acumenus.net')->first();

        if (! $admin) {
            $this->command->warn('Admin user not found — skipping Commons channel seeding.');

            return;
        }

        $channels = [
            ['name' => 'General', 'slug' => 'general', 'description' => 'General discussion for the team'],
            ['name' => 'Data Quality', 'slug' => 'data-quality', 'description' => 'Data quality discussions and DQD results'],
            ['name' => 'Concept Sets', 'slug' => 'concept-sets', 'description' => 'Concept set design and review'],
        ];

        foreach ($channels as $channelData) {
            $channel = Channel::firstOrCreate(
                ['slug' => $channelData['slug']],
                [
                    'name' => $channelData['name'],
                    'description' => $channelData['description'],
                    'type' => 'topic',
                    'visibility' => 'public',
                    'created_by' => $admin->id,
                ],
            );

            // Auto-join all existing users
            $userIds = User::pluck('id');
            foreach ($userIds as $userId) {
                ChannelMember::firstOrCreate(
                    ['channel_id' => $channel->id, 'user_id' => $userId],
                    [
                        'role' => $userId === $admin->id ? 'owner' : 'member',
                        'joined_at' => now(),
                    ],
                );
            }
        }

        $this->command->info('Commons channels seeded: general, data-quality, concept-sets');
    }
}
