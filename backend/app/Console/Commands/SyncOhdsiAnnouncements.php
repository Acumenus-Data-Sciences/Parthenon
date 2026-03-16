<?php

namespace App\Console\Commands;

use App\Models\Commons\Announcement;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use League\CommonMark\GithubFlavoredMarkdownConverter;

/**
 * Polls the OHDSI Discourse RSS feed and creates Announcement records
 * so new topics appear in the Commons Announcement Board automatically.
 *
 * No API key required — forums.ohdsi.org is public Discourse.
 *
 * Schedule: every 15 minutes (registered in routes/console.php)
 *
 * On first run (cold start) only items from the last 24 hours are posted
 * to avoid flooding the board with historical topics.
 *
 * Announcements expire after 30 days and are auto-excluded by the index query.
 */
class SyncOhdsiAnnouncements extends Command
{
    protected $signature = 'commons:sync-ohdsi-announcements
                            {--dry-run   : Print topics that would be posted without creating announcements}
                            {--backfill= : Post topics from the last N hours (overrides the 24h cold-start limit)}';

    protected $description = 'Sync new OHDSI Discourse forum topics to the Commons Announcement Board';

    private const RSS_URL = 'https://forums.ohdsi.org/latest.rss';

    /** Cache key: array of already-posted topic GUIDs (bounded to last 500) */
    private const CACHE_KEY_SEEN = 'ohdsi_rss_seen_guids';

    /** Cache key: flag set after first successful run */
    private const CACHE_KEY_INITIALIZED = 'ohdsi_rss_initialized';

    /** How many days before an RSS-sourced announcement auto-expires */
    private const EXPIRE_DAYS = 30;

    public function handle(): int
    {
        $poster = User::where('email', 'admin@acumenus.net')->first();

        if (! $poster) {
            $this->error('admin@acumenus.net user not found. Run php artisan admin:seed first.');

            return self::FAILURE;
        }

        $items = $this->fetchRssItems();

        if ($items === null) {
            return self::FAILURE;
        }

        if (empty($items)) {
            $this->info('RSS feed returned no items.');

            return self::SUCCESS;
        }

        $seenGuids = Cache::get(self::CACHE_KEY_SEEN, []);
        $isFirstRun = ! Cache::has(self::CACHE_KEY_INITIALIZED);

        // On first run cap to items from the last 24 h (or --backfill=N hours)
        $backfillHours = $this->option('backfill') ? (int) $this->option('backfill') : ($isFirstRun ? 24 : null);
        $cutoff = $backfillHours ? now()->subHours($backfillHours) : null;

        $posted = 0;

        foreach ($items as $item) {
            $guid    = (string) ($item->guid ?? $item->link ?? '');
            $pubDate = isset($item->pubDate) ? \Carbon\Carbon::parse((string) $item->pubDate) : now();

            if (in_array($guid, $seenGuids, true)) {
                continue;
            }

            if ($cutoff && $pubDate->lt($cutoff)) {
                $this->line('Skipping old item ('.$pubDate->toDateString().'): '.$this->truncate((string) $item->title, 60));
                $seenGuids[] = $guid;

                continue;
            }

            $title = $this->parseTitle($item);
            $body  = $this->formatBody($item, $pubDate);

            if ($this->option('dry-run')) {
                $this->line("---\n**{$title}**\n{$body}\n");
            } else {
                $this->createAnnouncement($poster, $title, $body, $pubDate);
                $posted++;
            }

            $seenGuids[] = $guid;
        }

        // Keep the seen list bounded
        if (count($seenGuids) > 500) {
            $seenGuids = array_slice($seenGuids, -500);
        }

        if (! $this->option('dry-run')) {
            Cache::forever(self::CACHE_KEY_SEEN, $seenGuids);
            Cache::forever(self::CACHE_KEY_INITIALIZED, true);
            $this->info($posted > 0
                ? "Published {$posted} new OHDSI topic(s) to the Announcement Board."
                : 'No new topics since last run.');
        }

        return self::SUCCESS;
    }

    /** @return array<int, \SimpleXMLElement>|null */
    private function fetchRssItems(): ?array
    {
        $response = Http::timeout(15)
            ->withHeaders(['Accept' => 'application/rss+xml, application/xml'])
            ->get(self::RSS_URL);

        if (! $response->successful()) {
            Log::error('OHDSI RSS fetch failed', ['status' => $response->status()]);
            $this->error('Failed to fetch OHDSI RSS feed: HTTP '.$response->status());

            return null;
        }

        $xml = @simplexml_load_string($response->body());

        if ($xml === false) {
            Log::error('OHDSI RSS parse failed', ['body_preview' => substr($response->body(), 0, 200)]);
            $this->error('Failed to parse OHDSI RSS feed.');

            return null;
        }

        return iterator_to_array($xml->channel->item, false);
    }

    private function parseTitle(\SimpleXMLElement $item): string
    {
        return $this->truncate(
            html_entity_decode(strip_tags((string) $item->title), ENT_QUOTES | ENT_HTML5),
            250
        );
    }

    private function formatBody(\SimpleXMLElement $item, \Carbon\Carbon $pubDate): string
    {
        $link     = (string) $item->link;
        $author   = (string) ($item->children('dc', true)->creator ?? '');
        $category = (string) ($item->category ?? '');

        // Strip HTML from the description, collapse whitespace, truncate
        $descRaw = html_entity_decode(strip_tags((string) $item->description), ENT_QUOTES | ENT_HTML5);
        $excerpt = $this->truncate(trim(preg_replace('/\s+/', ' ', $descRaw) ?? ''), 400);

        $meta = array_filter([
            $category ?: null,
            $author ? "by {$author}" : null,
            $pubDate->format('M j, Y'),
        ]);

        return implode("\n\n", array_filter([
            implode(' · ', $meta),
            $excerpt ?: null,
            "[Read on OHDSI Forums →]({$link})",
        ]));
    }

    private function createAnnouncement(User $poster, string $title, string $body, \Carbon\Carbon $pubDate): void
    {
        $bodyHtml = (new GithubFlavoredMarkdownConverter)->convert($body)->getContent();

        Announcement::create([
            'user_id'    => $poster->id,
            'channel_id' => null,          // global — visible on all channels' boards
            'title'      => $title,
            'body'       => $body,
            'body_html'  => $bodyHtml,
            'category'   => 'general',
            'is_pinned'  => false,
            'expires_at' => $pubDate->copy()->addDays(self::EXPIRE_DAYS),
        ]);
    }

    private function truncate(string $text, int $limit): string
    {
        if (mb_strlen($text) <= $limit) {
            return $text;
        }

        return rtrim(mb_substr($text, 0, $limit)).'…';
    }
}
