<?php

namespace Database\Factories\Commons;

use App\Models\Commons\Channel;
use App\Models\Commons\Notification;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Notification> */
class NotificationFactory extends Factory
{
    protected $model = Notification::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'user_id'    => User::factory(),
            'actor_id'   => User::factory(),
            'type'       => $this->faker->randomElement(['mention', 'dm']),
            'title'      => $this->faker->sentence(6),
            'body'       => $this->faker->sentence(10),
            'channel_id' => Channel::factory(),
            'message_id' => null,
            'read_at'    => null,
        ];
    }
}
