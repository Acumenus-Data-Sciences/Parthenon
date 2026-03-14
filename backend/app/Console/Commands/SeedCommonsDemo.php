<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SeedCommonsDemo extends Command
{
    protected $signature = 'commons:seed-demo {--fresh : Clear existing commons data first}';
    protected $description = 'Seed Commons workspace with realistic demo data';

    public function handle(): int
    {
        if ($this->option('fresh')) {
            $this->info('Clearing existing commons data...');
            DB::table('commons_activities')->truncate();
            DB::table('commons_notifications')->truncate();
            DB::table('commons_wiki_revisions')->truncate();
            DB::table('commons_wiki_articles')->truncate();
            DB::table('commons_announcements')->truncate();
            DB::table('commons_review_requests')->truncate();
            DB::table('commons_pinned_messages')->truncate();
            DB::table('commons_message_reactions')->truncate();
            DB::table('commons_object_references')->truncate();
            DB::table('commons_messages')->truncate();
            DB::table('commons_channel_members')->truncate();
            DB::table('commons_channels')->truncate();
        }

        // Use real users from the system
        $users = DB::table('users')->select('id', 'name')->get()->keyBy('id');
        $userIds = $users->pluck('id')->toArray();

        if (count($userIds) < 3) {
            $this->error('Need at least 3 users. Run admin:seed first.');
            return 1;
        }

        // Pick up to 6 active users for demo
        $demoUsers = array_slice($userIds, 0, min(6, count($userIds)));
        $adminId = 117; // admin@acumenus.net

        $now = Carbon::now();
        $dayAgo = $now->copy()->subDay();
        $twoDaysAgo = $now->copy()->subDays(2);
        $threeDaysAgo = $now->copy()->subDays(3);

        // ─── Channels ────────────────────────────────────────
        $this->info('Creating channels...');

        $channelData = [
            ['name' => 'General', 'slug' => 'general', 'description' => 'General discussion for the team', 'type' => 'topic'],
            ['name' => 'Data Quality', 'slug' => 'data-quality', 'description' => 'Data quality checks, Achilles results, and DQD reports', 'type' => 'topic'],
            ['name' => 'Concept Sets', 'slug' => 'concept-sets', 'description' => 'Concept set design, review, and standardization', 'type' => 'topic'],
            ['name' => 'T2DM Cohort Study', 'slug' => 't2dm-cohort-study', 'description' => 'Type 2 diabetes mellitus cohort refinement', 'type' => 'study'],
            ['name' => 'CKD Progression', 'slug' => 'ckd-progression', 'description' => 'Chronic kidney disease progression study', 'type' => 'study'],
        ];

        $channelIds = [];
        foreach ($channelData as $ch) {
            $existing = DB::table('commons_channels')->where('slug', $ch['slug'])->first();
            if ($existing) {
                $channelIds[$ch['slug']] = $existing->id;
            } else {
                $channelIds[$ch['slug']] = DB::table('commons_channels')->insertGetId([
                    ...$ch,
                    'visibility' => 'public',
                    'created_by' => $adminId,
                    'created_at' => $threeDaysAgo,
                    'updated_at' => $threeDaysAgo,
                ]);
            }
        }

        // ─── Members ─────────────────────────────────────────
        $this->info('Adding channel members...');

        foreach ($channelIds as $slug => $channelId) {
            foreach ($demoUsers as $i => $userId) {
                DB::table('commons_channel_members')->updateOrInsert(
                    ['channel_id' => $channelId, 'user_id' => $userId],
                    [
                        'role' => $i === 0 ? 'owner' : ($i === 1 ? 'admin' : 'member'),
                        'notification_preference' => 'all',
                        'last_read_at' => $now,
                        'joined_at' => $threeDaysAgo->copy()->addHours($i),
                    ],
                );
            }
        }

        // ─── Messages for #general ───────────────────────────
        $this->info('Seeding messages...');

        // Clear old messages for general to avoid duplicates
        $generalId = $channelIds['general'];
        DB::table('commons_messages')->where('channel_id', $generalId)->delete();

        $u = fn(int $idx) => $demoUsers[$idx % count($demoUsers)];
        $uName = fn(int $id) => $users[$id]->name ?? 'User';

        $generalMessages = [
            [
                'user_id' => $u(0), 'body' => "Welcome to **Parthenon Commons**! This is our shared workspace for research collaboration. Pin important resources, share findings, and coordinate across studies.\n\nA few ground rules:\n- Use threads for extended discussions\n- Tag relevant cohorts and concept sets with the reference tool\n- Use `@mentions` to notify specific team members",
                'at' => $threeDaysAgo,
            ],
            [
                'user_id' => $u(1), 'body' => 'Great to have this space. I\'ve been looking for a centralized way to discuss cohort definitions without losing context in email chains.',
                'at' => $threeDaysAgo->copy()->addHours(2),
            ],
            [
                'user_id' => $u(2), 'body' => "Has anyone reviewed the latest Achilles results for the Eunomia dataset? The measurement completeness numbers look off — I'm seeing 72% for labs which seems low for a synthetic dataset.",
                'at' => $twoDaysAgo,
            ],
            [
                'user_id' => $u(1), 'body' => "I checked — it's because the GiBleed subset doesn't include a full lab panel. The measurement domain only has condition-adjacent labs (CBC, metabolic panel). It's expected for this dataset.",
                'at' => $twoDaysAgo->copy()->addHours(1),
                'parent_idx' => 2, // reply to message index 2
            ],
            [
                'user_id' => $u(0), 'body' => "Good catch. I've documented this in the wiki under \"Eunomia Dataset Limitations\". The real Acumenus CDM has 94% lab completeness for comparison.",
                'at' => $twoDaysAgo->copy()->addHours(2),
                'parent_idx' => 2,
            ],
            [
                'user_id' => $u(3 % count($demoUsers)), 'body' => "Heads up — I'm running a full Achilles characterization on the Acumenus source tonight. Should be done by morning. This will give us fresh data quality metrics across all domains.",
                'at' => $twoDaysAgo->copy()->addHours(6),
            ],
            [
                'user_id' => $u(0), 'body' => 'Reminder: the **Phase 2 collaboration features** are now live. You can:\n- Pin messages and reference objects inline\n- Request peer reviews on messages\n- Use @Abby for AI-powered institutional memory search\n- Browse the Knowledge Base for documented patterns',
                'at' => $dayAgo,
            ],
            [
                'user_id' => $u(2), 'body' => "Just tried @Abby — asked about heart failure concept sets and she pulled up three different sets with validation stats from previous discussions. This is incredibly useful for institutional memory.",
                'at' => $dayAgo->copy()->addHours(3),
            ],
            [
                'user_id' => $u(4 % count($demoUsers)), 'body' => "I'm working on standardizing our drug exposure cohort patterns. Current convention varies too much between studies — some use 90-day washout, others 180-day, with no documented rationale. Can we establish a standard?",
                'at' => $dayAgo->copy()->addHours(5),
            ],
            [
                'user_id' => $u(1), 'body' => 'Absolutely. I wrote up a wiki article on washout period selection last week. The key insight from our SGLT2 study: claims data needs 180 days due to refill gap artifacts, but pharmacy dispensing data works fine with 90 days.',
                'at' => $dayAgo->copy()->addHours(6),
                'parent_idx' => 8,
            ],
            [
                'user_id' => $u(0), 'body' => "That matches what I've seen. Let's formalize this as a network convention. @{$uName($u(4 % count($demoUsers)))} — can you draft a proposal for the next methods meeting?",
                'at' => $dayAgo->copy()->addHours(7),
                'parent_idx' => 8,
            ],
            [
                'user_id' => $u(3 % count($demoUsers)), 'body' => "Achilles run complete. Results are in the data explorer. Summary: **2,694 patients**, measurement completeness at 89%, condition mapping rate 97%. One concern: 12% of drug exposures have overlapping eras which may indicate ETL issues.",
                'at' => $now->copy()->subHours(8),
            ],
            [
                'user_id' => $u(0), 'body' => "Excellent. I'll review the drug exposure overlaps. This might be a known issue with the GiBleed ETL — the era construction logic handles combination therapies differently.",
                'at' => $now->copy()->subHours(7),
                'parent_idx' => 11,
            ],
            [
                'user_id' => $u(2), 'body' => 'Quick update: I pushed the updated T2DM inclusion criteria. Now requires **HbA1c ≥ 6.5% on two separate dates**. Cohort dropped from 42,310 to 38,871 patients — the tighter definition should reduce misclassification.',
                'at' => $now->copy()->subHours(4),
            ],
            [
                'user_id' => $u(1), 'body' => "The survival curves look much cleaner now. Median follow-up is 3.2 years. I think we're ready for multi-site execution — **requesting peer review**.",
                'at' => $now->copy()->subHours(3),
            ],
            [
                'user_id' => $u(0), 'body' => "Looks great. I'll review the cohort logic this afternoon. Can you also add a sensitivity analysis excluding patients with prior GLP-1 RA use? That's a potential confounder we discussed last week.",
                'at' => $now->copy()->subHours(2),
            ],
        ];

        $messageIds = [];
        foreach ($generalMessages as $idx => $msg) {
            $parentId = null;
            $depth = 0;
            if (isset($msg['parent_idx']) && isset($messageIds[$msg['parent_idx']])) {
                $parentId = $messageIds[$msg['parent_idx']];
                $depth = 1;
            }

            $messageIds[$idx] = DB::table('commons_messages')->insertGetId([
                'channel_id' => $generalId,
                'user_id' => $msg['user_id'],
                'parent_id' => $parentId,
                'depth' => $depth,
                'body' => $msg['body'],
                'is_edited' => $idx === 13, // Mark one message as edited
                'edited_at' => $idx === 13 ? $msg['at']->copy()->addMinutes(15) : null,
                'created_at' => $msg['at'],
                'updated_at' => $msg['at'],
            ]);
        }

        // ─── Object References ───────────────────────────────
        $this->info('Adding object references...');

        // Reference on the T2DM update message
        if (isset($messageIds[13])) {
            DB::table('commons_object_references')->insert([
                'message_id' => $messageIds[13],
                'referenceable_type' => 'cohort_definition',
                'referenceable_id' => 1,
                'display_name' => 'T2DM Primary v3.2',
                'created_at' => $now->copy()->subHours(4),
            ]);
        }

        // Reference on the survival curves message
        if (isset($messageIds[14])) {
            DB::table('commons_object_references')->insert([
                'message_id' => $messageIds[14],
                'referenceable_type' => 'study',
                'referenceable_id' => 1,
                'display_name' => 'KM Survival — T2DM v3.2',
                'created_at' => $now->copy()->subHours(3),
            ]);
        }

        // ─── Reactions ───────────────────────────────────────
        $this->info('Adding reactions...');

        $reactions = [
            [$messageIds[0], 'thumbsup', [$u(1), $u(2)]],
            [$messageIds[0], 'celebrate', [$u(3 % count($demoUsers))]],
            [$messageIds[6], 'thumbsup', [$u(1), $u(2), $u(3 % count($demoUsers))]],
            [$messageIds[6], 'celebrate', [$u(4 % count($demoUsers))]],
            [$messageIds[7], 'heart', [$u(0), $u(1)]],
            [$messageIds[7], 'eyes', [$u(3 % count($demoUsers))]],
            [$messageIds[11], 'thumbsup', [$u(0), $u(2)]],
            [$messageIds[13], 'thumbsup', [$u(0), $u(1)]],
            [$messageIds[13], 'eyes', [$u(3 % count($demoUsers)), $u(4 % count($demoUsers))]],
            [$messageIds[14], 'celebrate', [$u(0), $u(2)]],
        ];

        foreach ($reactions as [$msgId, $emoji, $reactors]) {
            foreach ($reactors as $userId) {
                DB::table('commons_message_reactions')->updateOrInsert(
                    ['message_id' => $msgId, 'user_id' => $userId, 'emoji' => $emoji],
                    ['created_at' => $now->copy()->subMinutes(rand(10, 300))],
                );
            }
        }

        // ─── Pins ────────────────────────────────────────────
        $this->info('Pinning messages...');

        DB::table('commons_pinned_messages')->where('channel_id', $generalId)->delete();
        DB::table('commons_pinned_messages')->insert([
            ['channel_id' => $generalId, 'message_id' => $messageIds[0], 'pinned_by' => $u(0), 'pinned_at' => $twoDaysAgo],
            ['channel_id' => $generalId, 'message_id' => $messageIds[6], 'pinned_by' => $u(0), 'pinned_at' => $dayAgo],
        ]);

        // ─── Review Request ──────────────────────────────────
        $this->info('Creating review requests...');

        DB::table('commons_review_requests')->where('channel_id', $generalId)->delete();
        DB::table('commons_review_requests')->insert([
            'message_id' => $messageIds[14],
            'channel_id' => $generalId,
            'requested_by' => $u(1),
            'reviewer_id' => $u(0),
            'status' => 'pending',
            'created_at' => $now->copy()->subHours(3),
            'updated_at' => $now->copy()->subHours(3),
        ]);

        // ─── Activities ──────────────────────────────────────
        $this->info('Logging activities...');

        DB::table('commons_activities')->where('channel_id', $generalId)->delete();
        $activities = [
            ['event_type' => 'channel_created', 'title' => 'Channel created', 'description' => "#{$uName($u(0))} created #general", 'user_id' => $u(0), 'at' => $threeDaysAgo],
            ['event_type' => 'member_joined', 'title' => "{$uName($u(1))} joined", 'description' => null, 'user_id' => $u(1), 'at' => $threeDaysAgo->copy()->addHour()],
            ['event_type' => 'member_joined', 'title' => "{$uName($u(2))} joined", 'description' => null, 'user_id' => $u(2), 'at' => $threeDaysAgo->copy()->addHours(2)],
            ['event_type' => 'message_pinned', 'title' => 'Message pinned', 'description' => "{$uName($u(0))} pinned a welcome message", 'user_id' => $u(0), 'at' => $twoDaysAgo],
            ['event_type' => 'message_pinned', 'title' => 'Message pinned', 'description' => "{$uName($u(0))} pinned Phase 2 announcement", 'user_id' => $u(0), 'at' => $dayAgo],
            ['event_type' => 'review_created', 'title' => 'Review requested', 'description' => "{$uName($u(1))} requests peer review for multi-site execution", 'user_id' => $u(1), 'at' => $now->copy()->subHours(3)],
        ];

        foreach ($activities as $act) {
            DB::table('commons_activities')->insert([
                'channel_id' => $generalId,
                'user_id' => $act['user_id'],
                'event_type' => $act['event_type'],
                'title' => $act['title'],
                'description' => $act['description'],
                'created_at' => $act['at'],
            ]);
        }

        // ─── Announcements ───────────────────────────────────
        $this->info('Creating announcements...');

        DB::table('commons_announcements')->truncate();
        DB::table('commons_announcements')->insert([
            [
                'channel_id' => null,
                'user_id' => $u(0),
                'title' => 'Parthenon v2.0 — Commons Workspace Now Live',
                'body' => "The Commons collaboration workspace is now available to all team members. Key features:\n\n- **Real-time messaging** with threads, reactions, and @mentions\n- **AI-powered research companion** (Abby) with institutional memory\n- **Peer review workflows** for cohort definitions and study protocols\n- **Knowledge base** for documenting research patterns\n\nStart by exploring the #general channel and trying out @Abby.",
                'category' => 'milestone',
                'is_pinned' => true,
                'created_at' => $threeDaysAgo,
                'updated_at' => $threeDaysAgo,
            ],
            [
                'channel_id' => null,
                'user_id' => $u(0),
                'title' => 'Achilles Characterization Complete — Review Results',
                'body' => "Fresh Achilles characterization results are now available in the Data Explorer for the Acumenus CDM. Please review the data quality metrics for your study cohorts and flag any concerns in the #data-quality channel.",
                'category' => 'data_update',
                'is_pinned' => false,
                'created_at' => $now->copy()->subHours(8),
                'updated_at' => $now->copy()->subHours(8),
            ],
            [
                'channel_id' => null,
                'user_id' => $u(1),
                'title' => 'Methods Meeting — Washout Period Standardization',
                'body' => "We're holding a methods meeting next week to discuss standardizing drug exposure washout periods across studies. Please review the wiki article on washout period selection before attending.\n\nAgenda:\n1. Current variation across studies\n2. Evidence from SGLT2 and CKD studies\n3. Proposal for network-wide convention",
                'category' => 'general',
                'is_pinned' => false,
                'created_at' => $dayAgo->copy()->addHours(8),
                'updated_at' => $dayAgo->copy()->addHours(8),
            ],
        ]);

        // ─── Wiki Articles ───────────────────────────────────
        $this->info('Creating wiki articles...');

        DB::table('commons_wiki_revisions')->truncate();
        DB::table('commons_wiki_articles')->truncate();

        $articles = [
            [
                'title' => 'Cohort Definition Best Practices',
                'slug' => 'cohort-definition-best-practices',
                'body' => "# Cohort Definition Best Practices\n\nThis guide documents our network's conventions for building OMOP cohort definitions.\n\n## Inclusion Criteria\n\n- Require **2+ qualifying events** on separate dates to reduce false positives\n- Use observation period constraints (≥365 days prior observation)\n- Prefer condition_occurrence over condition_era for acute conditions\n\n## Exclusion Criteria\n\n- Exclude patients with <6 months follow-up\n- Document exclusion rationale in the cohort description\n\n## Validation\n\n- Run cohort diagnostics before any analysis\n- Compare cohort size against published prevalence estimates\n- Review age/gender distributions for face validity",
                'tags' => '["cohort","methodology","best-practices"]',
                'created_by' => $u(0),
            ],
            [
                'title' => 'Drug Exposure Washout Periods',
                'slug' => 'drug-exposure-washout-periods',
                'body' => "# Drug Exposure Washout Periods\n\n## Key Findings\n\nWashout period selection depends on data source type:\n\n### Claims Data\n- **Recommended: 180 days** minimum\n- Reason: Refill gaps in claims data create false washout periods\n- Evidence: SGLT2 Outcomes Study (Jan 2026) — 90 days initially considered but rejected\n\n### Pharmacy Dispensing Data\n- **90 days** is acceptable\n- More precise fill dates reduce false washout artifacts\n- Evidence: CKD Progression Study (Nov 2025) — 90-day washout validated\n\n### No Washout\n- Appropriate for persistent/continuous exposure definitions\n- Evidence: HTN Phenotyping Study — team determined persistent exposure was better design\n\n## Decision Framework\n\n1. Check data source type (claims vs. dispensing)\n2. Review refill gap distribution in DQ dashboard\n3. Document washout rationale in study protocol",
                'tags' => '["drug-exposure","washout","methodology"]',
                'created_by' => $u(1),
            ],
            [
                'title' => 'Eunomia Dataset Limitations',
                'slug' => 'eunomia-dataset-limitations',
                'body' => "# Eunomia Dataset Limitations\n\nThe GiBleed Eunomia subset is useful for demonstration but has known limitations:\n\n- **2,694 patients** only (synthetic)\n- Measurement domain limited to condition-adjacent labs (CBC, metabolic panel)\n- Lab completeness: ~72% (vs 94% on real Acumenus CDM)\n- Drug exposure eras may have overlaps due to ETL combination therapy handling\n- Vocabulary subset: 444 concepts, 480 relationships\n\nFor production analyses, always use the Acumenus CDM source.",
                'tags' => '["eunomia","data-quality","limitations"]',
                'created_by' => $u(0),
            ],
        ];

        foreach ($articles as $art) {
            $artId = DB::table('commons_wiki_articles')->insertGetId([
                ...$art,
                'created_at' => $twoDaysAgo,
                'updated_at' => $dayAgo,
            ]);
            DB::table('commons_wiki_revisions')->insert([
                'article_id' => $artId,
                'body' => $art['body'],
                'edited_by' => $art['created_by'],
                'edit_summary' => 'Initial version',
                'created_at' => $twoDaysAgo,
            ]);
        }

        $this->info('✅ Commons demo data seeded successfully!');
        $this->table(['Metric', 'Count'], [
            ['Channels', count($channelIds)],
            ['Messages', count($messageIds)],
            ['Reactions', count($reactions)],
            ['Pins', 2],
            ['Reviews', 1],
            ['Activities', count($activities)],
            ['Announcements', 3],
            ['Wiki Articles', count($articles)],
        ]);

        return 0;
    }
}
