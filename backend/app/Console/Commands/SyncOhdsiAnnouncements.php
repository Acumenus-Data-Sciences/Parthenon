<?php

namespace App\Console\Commands;

use App\Events\Commons\MessageSent;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use League\CommonMark\GithubFlavoredMarkdownConverter;

/**
 * Polls the X (Twitter) API for new @OHDSI posts and publishes them
 * as messages in the #announcements Commons channel.
 *
 * Requires X_BEARER_TOKEN in .env. If the token is absent the command
 * exits silently so the scheduler never fails in environments without
 * the credential configured.
 *
 * Schedule: every 15 minutes (registered in routes/console.php)
 */
class SyncOhdsiAnnouncements extends Command
{
    protected $signature = 'commons:sync-ohdsi-announcements
                            {--dry-run : Print tweets that would be posted without creating messages}
                            {--since= : Override the since_id (useful for backfill)}';

    protected $description = 'Sync recent @OHDSI X/Twitter posts to the #announcements channel';

    private const OHDSI_USERNAME = 'OHDSI';

    private const CACHE_KEY_USER_ID = 'ohdsi_twitter_user_id';

    private const CACHE_KEY_LAST_TWEET_ID = 'ohdsi_twitter_last_tweet_id';

    /** Redis set key that tracks individual posted tweet IDs for idempotency */
    private const CACHE_KEY_POSTED_IDS = 'ohdsi_twitter_posted_ids';

    private const X_API_BASE = 'https://api.twitter.com/2';

    public function handle(): int
    {
        $token = config('services.twitter.bearer_token');

        if (empty($token)) {
            $this->warn('X_BEARER_TOKEN not set — skipping OHDSI announcement sync.');
            return self::SUCCESS;
        }

        $channel = Channel::where('slug', 'announcements')->first();

        if (! $channel) {
            $this->error('#announcements channel not found. Run CommonsChannelSeeder first.');
            return self::FAILURE;
        }

        $poster = User::where('email', 'admin@acumenus.net')->first();

        if (! $poster) {
            $this->error('admin@acumenus.net user not found. Run php artisan admin:seed first.');
            return self::FAILURE;
        }

        $userId = $this->resolveOhdsiUserId($token);

        if (! $userId) {
            return self::FAILURE;
        }

        $sinceId = $this->option('since') ?: Cache::get(self::CACHE_KEY_LAST_TWEET_ID);

        $tweets = $this->fetchTweets($token, $userId, $sinceId);

        if (empty($tweets)) {
            $this->info('No new @OHDSI tweets found.');
            return self::SUCCESS;
        }

        // Tweets are returned newest-first; reverse so we post oldest first
        $tweets = array_reverse($tweets);

        foreach ($tweets as $tweet) {
            $body = $this->formatTweetAsMarkdown($tweet);

            if ($this->option('dry-run')) {
                $this->line("---\n{$body}\n");
                continue;
            }

            $this->postToChannel($channel, $poster, $tweet, $body);
        }

        // Persist the newest tweet ID (last element after reversal)
        if (! $this->option('dry-run')) {
            $newest = end($tweets);
            Cache::forever(self::CACHE_KEY_LAST_TWEET_ID, $newest['id']);
            $this->info(sprintf('Synced %d tweet(s). Last tweet ID: %s', count($tweets), $newest['id']));
        }

        return self::SUCCESS;
    }

    private function resolveOhdsiUserId(string $token): ?string
    {
        // Cache the user ID indefinitely — @OHDSI's numeric ID never changes
        return Cache::rememberForever(self::CACHE_KEY_USER_ID, function () use ($token) {
            $response = Http::withToken($token)
                ->timeout(10)
                ->get(self::X_API_BASE . '/users/by/username/' . self::OHDSI_USERNAME, [
                    'user.fields' => 'id,name',
                ]);

            if (! $response->successful()) {
                Log::error('X API: failed to resolve @OHDSI user ID', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                $this->error('X API error resolving @OHDSI user ID: ' . $response->status());
                return null;
            }

            return $response->json('data.id');
        });
    }

    /** @return array<int, array{id: string, text: string, created_at: string}> */
    private function fetchTweets(string $token, string $userId, ?string $sinceId): array
    {
        $params = [
            'max_results' => 10,
            'tweet.fields' => 'created_at,text',
            'exclude' => 'retweets,replies', // only original OHDSI posts
        ];

        if ($sinceId) {
            $params['since_id'] = $sinceId;
        }

        $response = Http::withToken($token)
            ->timeout(15)
            ->get(self::X_API_BASE . "/users/{$userId}/tweets", $params);

        if ($response->status() === 429) {
            $this->warn('X API rate limit reached — will retry next run.');
            Log::warning('X API rate limit reached during OHDSI sync.');
            return [];
        }

        if (! $response->successful()) {
            Log::error('X API: failed to fetch @OHDSI tweets', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            $this->error('X API error fetching tweets: ' . $response->status());
            return [];
        }

        return $response->json('data') ?? [];
    }

    /** @param array{id: string, text: string, created_at: string} $tweet */
    private function formatTweetAsMarkdown(array $tweet): string
    {
        $tweetUrl = 'https://x.com/' . self::OHDSI_USERNAME . '/status/' . $tweet['id'];
        $text = $tweet['text'];

        $date = isset($tweet['created_at'])
            ? date('M j, Y', strtotime($tweet['created_at']))
            : date('M j, Y');

        return "📣 **OHDSI Update** _{$date}_\n\n{$text}\n\n[View on X →]({$tweetUrl})";
    }

    /** @param array{id: string, text: string, created_at: string} $tweet */
    private function postToChannel(Channel $channel, User $poster, array $tweet, string $body): void
    {
        // Idempotency: skip if this tweet ID has already been posted
        $postedIds = Cache::get(self::CACHE_KEY_POSTED_IDS, []);

        if (in_array($tweet['id'], $postedIds, true)) {
            $this->line("Skipping already-posted tweet {$tweet['id']}.");
            return;
        }

        $bodyHtml = (new GithubFlavoredMarkdownConverter)->convert($body)->getContent();

        $message = Message::create([
            'channel_id' => $channel->id,
            'user_id' => $poster->id,
            'body' => $body,
            'body_html' => $bodyHtml,
            'depth' => 0,
            'is_edited' => false,
        ]);

        // Record tweet ID so future runs skip it
        $postedIds[] = $tweet['id'];
        // Keep the list bounded to the last 1000 tweet IDs
        if (count($postedIds) > 1000) {
            $postedIds = array_slice($postedIds, -1000);
        }
        Cache::forever(self::CACHE_KEY_POSTED_IDS, $postedIds);

        // Broadcast to any open Commons WebSocket connections
        try {
            broadcast(new MessageSent($message))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('OHDSI sync: broadcast failed (non-fatal)', ['error' => $e->getMessage()]);
        }

        $this->line("Posted tweet {$tweet['id']} as message #{$message->id}.");
    }
}
