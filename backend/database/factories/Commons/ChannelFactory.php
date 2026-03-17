<?php

namespace Database\Factories\Commons;

use App\Models\Commons\Channel;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Channel> */
class ChannelFactory extends Factory
{
    protected $model = Channel::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.$this->faker->randomNumber(4),
            'description' => $this->faker->sentence(),
            'type' => 'channel',
            'visibility' => 'public',
            'study_id' => null,
            'created_by' => User::factory(),
            'archived_at' => null,
        ];
    }

    public function dm(): static
    {
        return $this->state(['type' => 'dm', 'visibility' => 'private']);
    }
}
