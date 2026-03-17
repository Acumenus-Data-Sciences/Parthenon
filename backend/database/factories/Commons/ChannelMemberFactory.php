<?php

namespace Database\Factories\Commons;

use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<ChannelMember> */
class ChannelMemberFactory extends Factory
{
    protected $model = ChannelMember::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'channel_id' => Channel::factory(),
            'user_id' => User::factory(),
            'role' => 'member',
            'notification_preference' => 'all',
            'last_read_at' => null,
            'joined_at' => now(),
        ];
    }
}
