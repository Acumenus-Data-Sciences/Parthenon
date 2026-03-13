# Commons Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real-time channel-based messaging within Parthenon using Laravel Reverb WebSockets, with a three-panel UI (channel sidebar, message area, right panel shell) and simple online/offline presence.

**Architecture:** Laravel Reverb WebSocket server (new Docker service) broadcasts events to a React frontend via laravel-echo. Channels, members, and messages are stored in PostgreSQL (app schema). TanStack Query manages data fetching; Echo listeners handle real-time updates. The Commons page uses a three-panel flex layout matching Parthenon's dark theme.

**Tech Stack:** Laravel 11 + Reverb, React 19 + TypeScript, TanStack Query, laravel-echo + pusher-js, react-markdown + remark-gfm + rehype-sanitize, league/commonmark, PostgreSQL 16 (Docker)

**Spec:** `docs/superpowers/specs/2026-03-13-commons-phase1-design.md`

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `backend/database/migrations/2026_03_13_500001_create_commons_channels_table.php` | Channels schema |
| `backend/database/migrations/2026_03_13_500002_create_commons_channel_members_table.php` | Members schema |
| `backend/database/migrations/2026_03_13_500003_create_commons_messages_table.php` | Messages schema |
| `backend/app/Models/Commons/Channel.php` | Channel Eloquent model |
| `backend/app/Models/Commons/ChannelMember.php` | ChannelMember model |
| `backend/app/Models/Commons/Message.php` | Message model |
| `backend/app/Services/Commons/MessageService.php` | Markdown rendering, message creation |
| `backend/app/Http/Controllers/Api/V1/Commons/ChannelController.php` | Channel CRUD |
| `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php` | Message CRUD + broadcast |
| `backend/app/Http/Controllers/Api/V1/Commons/MemberController.php` | Join/leave/read |
| `backend/app/Http/Requests/Commons/CreateChannelRequest.php` | Channel creation validation |
| `backend/app/Http/Requests/Commons/UpdateChannelRequest.php` | Channel update validation |
| `backend/app/Http/Requests/Commons/SendMessageRequest.php` | Message send validation |
| `backend/app/Http/Requests/Commons/UpdateMessageRequest.php` | Message edit validation |
| `backend/app/Policies/Commons/ChannelPolicy.php` | Channel authorization |
| `backend/app/Policies/Commons/MessagePolicy.php` | Message authorization |
| `backend/app/Events/Commons/MessageSent.php` | Broadcast event for new messages |
| `backend/app/Events/Commons/MessageUpdated.php` | Broadcast event for edits/deletes |
| `backend/database/seeders/CommonsChannelSeeder.php` | Seed default channels |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/routes/api.php` | Add Commons route group |
| `backend/routes/channels.php` | Add broadcast channel authorization |
| `backend/database/seeders/DatabaseSeeder.php` | Call CommonsChannelSeeder |
| `docker-compose.yml` | Add reverb service |
| `backend/.env` | Add Reverb env vars |

### Frontend — New Files
| File | Responsibility |
|------|----------------|
| `frontend/src/features/commons/types.ts` | TypeScript interfaces |
| `frontend/src/features/commons/api.ts` | API functions + TanStack Query hooks |
| `frontend/src/features/commons/hooks/usePresence.ts` | Echo presence channel hook |
| `frontend/src/features/commons/hooks/useEcho.ts` | Echo instance provider hook |
| `frontend/src/features/commons/pages/CommonsPage.tsx` | Route-level page component |
| `frontend/src/features/commons/components/CommonsLayout.tsx` | Three-panel layout |
| `frontend/src/features/commons/components/sidebar/ChannelList.tsx` | Channel list with sections |
| `frontend/src/features/commons/components/sidebar/ChannelSearch.tsx` | Channel search/filter |
| `frontend/src/features/commons/components/sidebar/OnlineUsers.tsx` | Online users panel |
| `frontend/src/features/commons/components/chat/ChannelHeader.tsx` | Channel name + controls |
| `frontend/src/features/commons/components/chat/MessageList.tsx` | Scrollable message list |
| `frontend/src/features/commons/components/chat/MessageItem.tsx` | Single message row |
| `frontend/src/features/commons/components/chat/MessageComposer.tsx` | Markdown composer |
| `frontend/src/features/commons/components/rightpanel/RightPanel.tsx` | Tabbed placeholder panel |
| `frontend/src/lib/echo.ts` | Laravel Echo singleton setup |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/components/layout/Sidebar.tsx` | Add Commons nav item |
| `frontend/src/app/router.tsx` | Add /commons routes |

---

## Chunk 1: Infrastructure & Database

### Task 1: Install Laravel Reverb

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/.env`
- Modify: `backend/config/broadcasting.php` (auto-published by reverb:install)

- [ ] **Step 1: Install Reverb via Composer**

```bash
docker compose exec php composer require laravel/reverb
```

- [ ] **Step 2: Publish Reverb config**

```bash
docker compose exec php php artisan reverb:install
```

This publishes `config/reverb.php` and updates `config/broadcasting.php`. It also generates `REVERB_APP_ID`, `REVERB_APP_KEY`, and `REVERB_APP_SECRET` in `.env`.

- [ ] **Step 3: Update backend/.env with Reverb settings**

Ensure these values exist (reverb:install may have added them):

```env
BROADCAST_CONNECTION=reverb
REVERB_HOST=reverb
REVERB_PORT=8080
REVERB_SCHEME=http
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

- [ ] **Step 4: Add Reverb service to docker-compose.yml**

Add this service after the existing `php` service:

```yaml
  reverb:
    container_name: parthenon-reverb
    build:
      context: .
      dockerfile: docker/php/Dockerfile
    command: php artisan reverb:start --host=0.0.0.0 --port=8080
    ports:
      - "${REVERB_PORT:-8080}:8080"
    env_file:
      - ./backend/.env
    volumes:
      - ./backend:/var/www/html
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - parthenon
    healthcheck:
      test: ["CMD", "php", "-r", "echo @fsockopen('127.0.0.1', 8080) ? 'ok' : exit(1);"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

- [ ] **Step 5: Start Reverb and verify**

```bash
docker compose up -d reverb
docker compose ps reverb
```

Expected: `parthenon-reverb` shows `healthy`.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/config/broadcasting.php backend/config/reverb.php backend/composer.json backend/composer.lock backend/.env.example
git commit -m "feat(commons): add Laravel Reverb WebSocket server"
```

---

### Task 2: Install Frontend WebSocket Packages

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install laravel-echo, pusher-js, and rehype-sanitize**

Note: `react-markdown` and `remark-gfm` are already in package.json.

```bash
docker compose exec node sh -c "cd /app && npm install --legacy-peer-deps laravel-echo pusher-js rehype-sanitize"
```

- [ ] **Step 2: Verify installation**

```bash
docker compose exec node sh -c "cd /app && node -e \"require('laravel-echo'); console.log('echo ok')\""
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(commons): add laravel-echo, pusher-js, rehype-sanitize"
```

---

### Task 3: Create Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_13_500001_create_commons_channels_table.php`
- Create: `backend/database/migrations/2026_03_13_500002_create_commons_channel_members_table.php`
- Create: `backend/database/migrations/2026_03_13_500003_create_commons_messages_table.php`

- [ ] **Step 1: Create commons_channels migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_channels', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 100)->unique();
            $table->text('description')->nullable();
            $table->string('type', 20)->default('topic');
            $table->string('visibility', 20)->default('public');
            $table->foreignId('study_id')->nullable()->constrained('studies')->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index('type');
        });

        DB::statement('CREATE INDEX idx_channels_study ON commons_channels (study_id) WHERE study_id IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_channels');
    }
};
```

- [ ] **Step 2: Create commons_channel_members migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_channel_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 20)->default('member');
            $table->string('notification_preference', 20)->default('mentions');
            $table->timestamp('last_read_at')->nullable();
            $table->timestamp('joined_at')->useCurrent();

            $table->unique(['channel_id', 'user_id']);
            $table->index('user_id');
            $table->index('channel_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_channel_members');
    }
};
```

- [ ] **Step 3: Create commons_messages migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commons_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained('commons_channels')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('commons_messages')->cascadeOnDelete();
            $table->text('body');
            $table->text('body_html')->nullable();
            $table->boolean('is_edited')->default(false);
            $table->timestamp('edited_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });

        DB::statement('CREATE INDEX idx_messages_channel_created ON commons_messages (channel_id, created_at DESC)');
        DB::statement('CREATE INDEX idx_messages_parent ON commons_messages (parent_id) WHERE parent_id IS NOT NULL');
        DB::statement("CREATE INDEX idx_messages_search ON commons_messages USING gin(to_tsvector('english', body))");
    }

    public function down(): void
    {
        Schema::dropIfExists('commons_messages');
    }
};
```

- [ ] **Step 4: Run migrations**

```bash
docker compose exec php php artisan migrate
```

Expected: 3 tables created successfully.

- [ ] **Step 5: Verify tables exist**

```bash
docker compose exec php php artisan tinker --execute="echo implode(', ', Schema::getTableListing());" | grep commons
```

Expected: Output includes `commons_channels`, `commons_channel_members`, `commons_messages`.

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/2026_03_13_50000*
git commit -m "feat(commons): add channel, member, and message migrations"
```

---

### Task 4: Create Eloquent Models

**Files:**
- Create: `backend/app/Models/Commons/Channel.php`
- Create: `backend/app/Models/Commons/ChannelMember.php`
- Create: `backend/app/Models/Commons/Message.php`

- [ ] **Step 1: Create Channel model**

```php
<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Channel extends Model
{
    protected $table = 'commons_channels';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'type',
        'visibility',
        'study_id',
        'created_by',
        'archived_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<ChannelMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(ChannelMember::class, 'channel_id');
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'channel_id');
    }

    public function isPublic(): bool
    {
        return $this->visibility === 'public';
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }
}
```

- [ ] **Step 2: Create ChannelMember model**

```php
<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelMember extends Model
{
    public $timestamps = false;

    protected $table = 'commons_channel_members';

    protected $fillable = [
        'channel_id',
        'user_id',
        'role',
        'notification_preference',
        'last_read_at',
        'joined_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_read_at' => 'datetime',
            'joined_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class, 'channel_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isOwner(): bool
    {
        return $this->role === 'owner';
    }

    public function isAdmin(): bool
    {
        return in_array($this->role, ['owner', 'admin'], true);
    }
}
```

- [ ] **Step 3: Create Message model**

```php
<?php

namespace App\Models\Commons;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    protected $table = 'commons_messages';

    protected $fillable = [
        'channel_id',
        'user_id',
        'parent_id',
        'body',
        'body_html',
        'is_edited',
        'edited_at',
        'deleted_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_edited' => 'boolean',
            'edited_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class, 'channel_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'parent_id');
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function replies(): HasMany
    {
        return $this->hasMany(Message::class, 'parent_id');
    }

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }
}
```

- [ ] **Step 4: Verify models load**

```bash
docker compose exec php php artisan tinker --execute="new App\Models\Commons\Channel(); new App\Models\Commons\ChannelMember(); new App\Models\Commons\Message(); echo 'Models OK';"
```

Expected: `Models OK`

- [ ] **Step 5: Commit**

```bash
git add backend/app/Models/Commons/
git commit -m "feat(commons): add Channel, ChannelMember, Message Eloquent models"
```

---

## Chunk 2: Backend API

### Task 5: Create MessageService

**Files:**
- Create: `backend/app/Services/Commons/MessageService.php`

- [ ] **Step 1: Install league/commonmark (if not already present)**

```bash
docker compose exec php composer show league/commonmark 2>/dev/null && echo "Already installed" || docker compose exec php composer require league/commonmark
```

- [ ] **Step 2: Create MessageService**

```php
<?php

namespace App\Services\Commons;

use App\Events\Commons\MessageSent;
use App\Events\Commons\MessageUpdated;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use League\CommonMark\CommonMarkConverter;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\DisallowedRawHtml\DisallowedRawHtmlExtension;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\MarkdownConverter;

class MessageService
{
    private MarkdownConverter $converter;

    public function __construct()
    {
        $environment = new Environment([
            'disallowed_raw_html' => [
                'disallowed_tags' => [],
            ],
        ]);
        $environment->addExtension(new CommonMarkCoreExtension());
        $environment->addExtension(new GithubFlavoredMarkdownExtension());
        $environment->addExtension(new DisallowedRawHtmlExtension());

        $this->converter = new MarkdownConverter($environment);
    }

    public function renderMarkdown(string $body): string
    {
        return $this->converter->convert($body)->getContent();
    }

    public function createMessage(Channel $channel, int $userId, string $body, ?int $parentId = null): Message
    {
        $message = Message::create([
            'channel_id' => $channel->id,
            'user_id' => $userId,
            'parent_id' => $parentId,
            'body' => $body,
            'body_html' => $this->renderMarkdown($body),
        ]);

        $message->load('user');

        // Auto-join user to channel if public and not a member
        if ($channel->isPublic()) {
            ChannelMember::firstOrCreate(
                ['channel_id' => $channel->id, 'user_id' => $userId],
                ['role' => 'member', 'joined_at' => now()],
            );
        }

        broadcast(new MessageSent($message))->toOthers();

        return $message;
    }

    public function updateMessage(Message $message, string $body): Message
    {
        $message->update([
            'body' => $body,
            'body_html' => $this->renderMarkdown($body),
            'is_edited' => true,
            'edited_at' => now(),
        ]);

        broadcast(new MessageUpdated($message, 'edited'))->toOthers();

        return $message;
    }

    public function deleteMessage(Message $message): Message
    {
        $message->update([
            'deleted_at' => now(),
        ]);

        broadcast(new MessageUpdated($message, 'deleted'))->toOthers();

        return $message;
    }
}
```

- [ ] **Step 3: Verify syntax**

```bash
docker compose exec php php -l app/Services/Commons/MessageService.php
```

Expected: `No syntax errors detected`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/Commons/MessageService.php
git commit -m "feat(commons): add MessageService with Markdown rendering"
```

---

### Task 6: Create Broadcast Events

**Files:**
- Create: `backend/app/Events/Commons/MessageSent.php`
- Create: `backend/app/Events/Commons/MessageUpdated.php`

- [ ] **Step 1: Create MessageSent event**

```php
<?php

namespace App\Events\Commons;

use App\Models\Commons\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("commons.channel.{$this->message->channel_id}")];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'channel_id' => $this->message->channel_id,
                'user' => [
                    'id' => $this->message->user->id,
                    'name' => $this->message->user->name,
                ],
                'body' => $this->message->body,
                'body_html' => $this->message->body_html,
                'parent_id' => $this->message->parent_id,
                'is_edited' => $this->message->is_edited,
                'created_at' => $this->message->created_at->toISOString(),
            ],
        ];
    }
}
```

- [ ] **Step 2: Create MessageUpdated event**

```php
<?php

namespace App\Events\Commons;

use App\Models\Commons\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Message $message,
        public string $action,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("commons.channel.{$this->message->channel_id}")];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'body' => $this->message->body,
                'body_html' => $this->message->body_html,
                'is_edited' => $this->message->is_edited,
                'deleted_at' => $this->message->deleted_at?->toISOString(),
            ],
            'action' => $this->action,
        ];
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Events/Commons/
git commit -m "feat(commons): add MessageSent and MessageUpdated broadcast events"
```

---

### Task 7: Create Form Requests

**Files:**
- Create: `backend/app/Http/Requests/Commons/CreateChannelRequest.php`
- Create: `backend/app/Http/Requests/Commons/UpdateChannelRequest.php`
- Create: `backend/app/Http/Requests/Commons/SendMessageRequest.php`
- Create: `backend/app/Http/Requests/Commons/UpdateMessageRequest.php`

- [ ] **Step 1: Create all four Form Requests**

`CreateChannelRequest.php`:
```php
<?php

namespace App\Http\Requests\Commons;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'slug' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/', Rule::unique('commons_channels', 'slug')],
            'description' => 'nullable|string|max:500',
            'type' => 'required|string|in:topic,study,custom',
            'visibility' => 'required|string|in:public,private',
            'study_id' => 'nullable|integer|exists:studies,id',
        ];
    }
}
```

`UpdateChannelRequest.php`:
```php
<?php

namespace App\Http\Requests\Commons;

use Illuminate\Foundation\Http\FormRequest;

class UpdateChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:500',
        ];
    }
}
```

`SendMessageRequest.php`:
```php
<?php

namespace App\Http\Requests\Commons;

use Illuminate\Foundation\Http\FormRequest;

class SendMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'body' => 'required|string|max:10000',
        ];
    }
}
```

`UpdateMessageRequest.php`:
```php
<?php

namespace App\Http\Requests\Commons;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'body' => 'required|string|max:10000',
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Http/Requests/Commons/
git commit -m "feat(commons): add Form Request validation classes"
```

---

### Task 8: Create Policies

**Files:**
- Create: `backend/app/Policies/Commons/ChannelPolicy.php`
- Create: `backend/app/Policies/Commons/MessagePolicy.php`

- [ ] **Step 1: Create ChannelPolicy**

```php
<?php

namespace App\Policies\Commons;

use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use App\Models\User;

class ChannelPolicy
{
    public function view(User $user, Channel $channel): bool
    {
        if ($channel->isPublic()) {
            return true;
        }

        return $this->isMember($user, $channel);
    }

    public function update(User $user, Channel $channel): bool
    {
        $member = $this->getMember($user, $channel);

        return $member !== null && $member->isAdmin();
    }

    public function archive(User $user, Channel $channel): bool
    {
        $member = $this->getMember($user, $channel);

        return $member !== null && $member->isOwner();
    }

    public function sendMessage(User $user, Channel $channel): bool
    {
        if ($channel->isPublic()) {
            return true;
        }

        return $this->isMember($user, $channel);
    }

    private function isMember(User $user, Channel $channel): bool
    {
        return ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->exists();
    }

    private function getMember(User $user, Channel $channel): ?ChannelMember
    {
        return ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->first();
    }
}
```

- [ ] **Step 2: Create MessagePolicy**

```php
<?php

namespace App\Policies\Commons;

use App\Models\Commons\ChannelMember;
use App\Models\Commons\Message;
use App\Models\User;

class MessagePolicy
{
    public function update(User $user, Message $message): bool
    {
        return $message->user_id === $user->id && ! $message->isDeleted();
    }

    public function delete(User $user, Message $message): bool
    {
        if ($message->isDeleted()) {
            return false;
        }

        // Author can delete their own messages
        if ($message->user_id === $user->id) {
            return true;
        }

        // Channel admin/owner can delete any message
        $member = ChannelMember::where('channel_id', $message->channel_id)
            ->where('user_id', $user->id)
            ->first();

        return $member !== null && $member->isAdmin();
    }
}
```

- [ ] **Step 3: Register policies in AuthServiceProvider (or auto-discovery)**

Laravel 11 uses auto-discovery for policies. Verify the naming convention matches: `App\Policies\Commons\ChannelPolicy` maps to `App\Models\Commons\Channel`. If auto-discovery doesn't work, register in `bootstrap/app.php`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/Policies/Commons/
git commit -m "feat(commons): add ChannelPolicy and MessagePolicy"
```

---

### Task 9: Create Controllers

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/Commons/ChannelController.php`
- Create: `backend/app/Http/Controllers/Api/V1/Commons/MessageController.php`
- Create: `backend/app/Http/Controllers/Api/V1/Commons/MemberController.php`

- [ ] **Step 1: Create ChannelController**

```php
<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\CreateChannelRequest;
use App\Http\Requests\Commons\UpdateChannelRequest;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $channels = Channel::whereNull('archived_at')
            ->where(function ($query) use ($user) {
                $query->where('visibility', 'public')
                    ->orWhereHas('members', fn ($q) => $q->where('user_id', $user->id));
            })
            ->withCount('members')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $channels]);
    }

    public function store(CreateChannelRequest $request): JsonResponse
    {
        $channel = Channel::create([
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        // Creator becomes owner
        ChannelMember::create([
            'channel_id' => $channel->id,
            'user_id' => $request->user()->id,
            'role' => 'owner',
            'joined_at' => now(),
        ]);

        $channel->loadCount('members');

        return response()->json(['data' => $channel], 201);
    }

    public function show(string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)
            ->withCount('members')
            ->firstOrFail();

        $this->authorize('view', $channel);

        return response()->json(['data' => $channel]);
    }

    public function update(UpdateChannelRequest $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('update', $channel);

        $channel->update($request->validated());

        return response()->json(['data' => $channel]);
    }

    public function archive(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('archive', $channel);

        $channel->update(['archived_at' => now()]);

        return response()->json(['data' => $channel]);
    }
}
```

- [ ] **Step 2: Create MessageController**

```php
<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Http\Requests\Commons\SendMessageRequest;
use App\Http\Requests\Commons\UpdateMessageRequest;
use App\Models\Commons\Channel;
use App\Models\Commons\Message;
use App\Services\Commons\MessageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function __construct(private MessageService $messageService) {}

    public function index(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $query = Message::where('channel_id', $channel->id)
            ->whereNull('deleted_at')
            ->whereNull('parent_id')
            ->with('user:id,name')
            ->orderByDesc('id');

        if ($request->has('before')) {
            $query->where('id', '<', (int) $request->input('before'));
        }

        $limit = min((int) $request->input('limit', 50), 100);
        $messages = $query->limit($limit)->get();

        return response()->json(['data' => $messages]);
    }

    public function store(SendMessageRequest $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('sendMessage', $channel);

        $message = $this->messageService->createMessage(
            $channel,
            $request->user()->id,
            $request->validated('body'),
        );

        return response()->json(['data' => $message], 201);
    }

    public function update(UpdateMessageRequest $request, int $id): JsonResponse
    {
        $message = Message::findOrFail($id);
        $this->authorize('update', $message);

        $message = $this->messageService->updateMessage(
            $message,
            $request->validated('body'),
        );

        return response()->json(['data' => $message]);
    }

    public function destroy(int $id): JsonResponse
    {
        $message = Message::findOrFail($id);
        $this->authorize('delete', $message);

        $this->messageService->deleteMessage($message);

        return response()->json(['data' => $message]);
    }
}
```

- [ ] **Step 3: Create MemberController**

```php
<?php

namespace App\Http\Controllers\Api\V1\Commons;

use App\Http\Controllers\Controller;
use App\Models\Commons\Channel;
use App\Models\Commons\ChannelMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemberController extends Controller
{
    public function index(string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $this->authorize('view', $channel);

        $members = ChannelMember::where('channel_id', $channel->id)
            ->with('user:id,name,email')
            ->orderBy('joined_at')
            ->get();

        return response()->json(['data' => $members]);
    }

    public function store(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();

        if ($channel->isPublic()) {
            // Public channels: self-join only
            $userId = $request->user()->id;
        } else {
            // Private channels: admin can invite others
            $this->authorize('update', $channel);
            $request->validate(['user_id' => 'sometimes|integer|exists:users,id']);
            $userId = $request->input('user_id', $request->user()->id);
        }

        $member = ChannelMember::firstOrCreate(
            ['channel_id' => $channel->id, 'user_id' => $userId],
            ['role' => 'member', 'joined_at' => now()],
        );

        $member->load('user:id,name,email');

        return response()->json(['data' => $member], 201);
    }

    public function destroy(Request $request, string $slug, int $memberId): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();
        $member = ChannelMember::where('channel_id', $channel->id)
            ->findOrFail($memberId);

        // Can remove self, or admin can remove others
        $isSelf = $member->user_id === $request->user()->id;
        if (! $isSelf) {
            $this->authorize('update', $channel);
        }

        $member->delete();

        return response()->json(null, 204);
    }

    public function markRead(Request $request, string $slug): JsonResponse
    {
        $channel = Channel::where('slug', $slug)->firstOrFail();

        ChannelMember::where('channel_id', $channel->id)
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => now()]);

        return response()->json(['status' => 'ok']);
    }
}
```

- [ ] **Step 4: Verify syntax on all controllers**

```bash
docker compose exec php php -l app/Http/Controllers/Api/V1/Commons/ChannelController.php && \
docker compose exec php php -l app/Http/Controllers/Api/V1/Commons/MessageController.php && \
docker compose exec php php -l app/Http/Controllers/Api/V1/Commons/MemberController.php
```

Expected: `No syntax errors detected` for all three.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/Commons/
git commit -m "feat(commons): add Channel, Message, Member controllers"
```

---

### Task 10: Register Routes and Broadcast Channels

**Files:**
- Modify: `backend/routes/api.php`
- Modify: `backend/routes/channels.php`

- [ ] **Step 1: Add Commons routes to api.php**

Add inside the `Route::middleware('auth:sanctum')->group(function () { ... })` block:

```php
// ── Commons Workspace ──────────────────────────────────────────────
Route::prefix('commons')->group(function () {
    Route::get('channels', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'index']);
    Route::post('channels', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'store']);
    Route::get('channels/{slug}', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'show']);
    Route::patch('channels/{slug}', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'update']);
    Route::post('channels/{slug}/archive', [App\Http\Controllers\Api\V1\Commons\ChannelController::class, 'archive']);

    Route::get('channels/{slug}/messages', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'index']);
    Route::post('channels/{slug}/messages', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'store'])
        ->middleware('throttle:60,1');
    Route::patch('messages/{id}', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'update']);
    Route::delete('messages/{id}', [App\Http\Controllers\Api\V1\Commons\MessageController::class, 'destroy']);

    Route::get('channels/{slug}/members', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'index']);
    Route::post('channels/{slug}/members', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'store']);
    Route::delete('channels/{slug}/members/{memberId}', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'destroy']);
    Route::post('channels/{slug}/read', [App\Http\Controllers\Api\V1\Commons\MemberController::class, 'markRead']);
});
```

- [ ] **Step 2: Add broadcast channel authorization to channels.php**

```php
use App\Models\Commons\ChannelMember;

Broadcast::channel('commons.online', function ($user) {
    return ['id' => $user->id, 'name' => $user->name];
});

Broadcast::channel('commons.channel.{channelId}', function ($user, int $channelId) {
    return ChannelMember::where('channel_id', $channelId)
        ->where('user_id', $user->id)
        ->exists();
});
```

- [ ] **Step 3: Verify routes are registered**

```bash
docker compose exec php php artisan route:list --path=commons
```

Expected: 14 routes listed under `api/v1/commons/`.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/api.php backend/routes/channels.php
git commit -m "feat(commons): register API routes and broadcast channels"
```

---

### Task 11: Create Channel Seeder

**Files:**
- Create: `backend/database/seeders/CommonsChannelSeeder.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`

- [ ] **Step 1: Create CommonsChannelSeeder**

```php
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
```

- [ ] **Step 2: Add to DatabaseSeeder**

Add this line after the existing seeder calls (before the closing brace of `run()`):

```php
$this->call(CommonsChannelSeeder::class);
```

- [ ] **Step 3: Run the seeder**

```bash
docker compose exec php php artisan db:seed --class=CommonsChannelSeeder
```

Expected: `Commons channels seeded: general, data-quality, concept-sets`

- [ ] **Step 4: Verify channels exist**

```bash
docker compose exec php php artisan tinker --execute="echo App\Models\Commons\Channel::count() . ' channels, ' . App\Models\Commons\ChannelMember::count() . ' memberships';"
```

Expected: `3 channels, N memberships` (where N = 3 × number of users).

- [ ] **Step 5: Smoke test the API**

```bash
# Login and get token
TOKEN=$(curl -s http://localhost:8082/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@acumenus.net","password":"superuser"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# List channels
curl -s http://localhost:8082/api/v1/commons/channels -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
```

Expected: JSON response with 3 channels.

- [ ] **Step 6: Commit**

```bash
git add backend/database/seeders/CommonsChannelSeeder.php backend/database/seeders/DatabaseSeeder.php
git commit -m "feat(commons): add channel seeder with general, data-quality, concept-sets"
```

---

## Chunk 3: Frontend Foundation

### Task 12: Create Echo Client Setup

**Files:**
- Create: `frontend/src/lib/echo.ts`

- [ ] **Step 1: Create Echo singleton**

```typescript
import Echo from "laravel-echo";
import Pusher from "pusher-js";

// Pusher must be on window for Echo to find it
(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;

let echoInstance: Echo | null = null;

export function getEcho(): Echo {
  if (!echoInstance) {
    // Read token from Zustand persisted auth store
    const stored = localStorage.getItem("parthenon-auth");
    const token = stored ? JSON.parse(stored)?.state?.token ?? "" : "";

    echoInstance = new Echo({
      broadcaster: "reverb",
      key: import.meta.env.VITE_REVERB_APP_KEY,
      wsHost: import.meta.env.VITE_REVERB_HOST ?? "localhost",
      wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
      forceTLS: import.meta.env.VITE_REVERB_SCHEME === "https",
      enabledTransports: ["ws", "wss"],
      authEndpoint: "/broadcasting/auth",
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
  return echoInstance;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/echo.ts
git commit -m "feat(commons): add Laravel Echo client setup"
```

---

### Task 13: Create TypeScript Types

**Files:**
- Create: `frontend/src/features/commons/types.ts`

- [ ] **Step 1: Create types file**

```typescript
export interface ChannelUser {
  id: number;
  name: string;
}

export interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: "topic" | "study" | "custom";
  visibility: "public" | "private";
  study_id: number | null;
  created_by: number;
  archived_at: string | null;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelMember {
  id: number;
  channel_id: number;
  user_id: number;
  role: "owner" | "admin" | "member";
  notification_preference: "all" | "mentions" | "none";
  last_read_at: string | null;
  joined_at: string;
  user: ChannelUser;
}

export interface Message {
  id: number;
  channel_id: number;
  user: ChannelUser;
  body: string;
  body_html: string | null;
  parent_id: number | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface PresenceUser {
  id: number;
  name: string;
}

export interface CreateChannelPayload {
  name: string;
  slug: string;
  description?: string;
  type: "topic" | "study" | "custom";
  visibility: "public" | "private";
  study_id?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/types.ts
git commit -m "feat(commons): add TypeScript interfaces"
```

---

### Task 14: Create API Functions and Hooks

**Files:**
- Create: `frontend/src/features/commons/api.ts`

- [ ] **Step 1: Create API functions and TanStack Query hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { Channel, ChannelMember, CreateChannelPayload, Message } from "./types";

const CHANNELS_KEY = "commons-channels";
const MESSAGES_KEY = "commons-messages";
const MEMBERS_KEY = "commons-members";

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function fetchChannels(): Promise<Channel[]> {
  const { data } = await apiClient.get<{ data: Channel[] }>("/commons/channels");
  return data.data;
}

async function createChannel(payload: CreateChannelPayload): Promise<Channel> {
  const { data } = await apiClient.post<{ data: Channel }>("/commons/channels", payload);
  return data.data;
}

async function fetchChannel(slug: string): Promise<Channel> {
  const { data } = await apiClient.get<{ data: Channel }>(`/commons/channels/${slug}`);
  return data.data;
}

async function fetchMessages(slug: string, before?: number): Promise<Message[]> {
  const params = new URLSearchParams();
  if (before) params.set("before", String(before));
  params.set("limit", "50");
  const { data } = await apiClient.get<{ data: Message[] }>(
    `/commons/channels/${slug}/messages?${params.toString()}`,
  );
  return data.data;
}

async function sendMessage(slug: string, body: string): Promise<Message> {
  const { data } = await apiClient.post<{ data: Message }>(
    `/commons/channels/${slug}/messages`,
    { body },
  );
  return data.data;
}

async function updateMessage(id: number, body: string): Promise<Message> {
  const { data } = await apiClient.patch<{ data: Message }>(
    `/commons/messages/${id}`,
    { body },
  );
  return data.data;
}

async function deleteMessage(id: number): Promise<void> {
  await apiClient.delete(`/commons/messages/${id}`);
}

async function fetchMembers(slug: string): Promise<ChannelMember[]> {
  const { data } = await apiClient.get<{ data: ChannelMember[] }>(
    `/commons/channels/${slug}/members`,
  );
  return data.data;
}

async function joinChannel(slug: string): Promise<ChannelMember> {
  const { data } = await apiClient.post<{ data: ChannelMember }>(
    `/commons/channels/${slug}/members`,
  );
  return data.data;
}

async function markChannelRead(slug: string): Promise<void> {
  await apiClient.post(`/commons/channels/${slug}/read`);
}

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useChannels() {
  return useQuery({
    queryKey: [CHANNELS_KEY],
    queryFn: fetchChannels,
  });
}

export function useChannel(slug: string) {
  return useQuery({
    queryKey: [CHANNELS_KEY, slug],
    queryFn: () => fetchChannel(slug),
    enabled: !!slug,
  });
}

export function useMessages(slug: string) {
  return useQuery({
    queryKey: [MESSAGES_KEY, slug],
    queryFn: () => fetchMessages(slug),
    enabled: !!slug,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, body }: { slug: string; body: string }) => sendMessage(slug, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [MESSAGES_KEY, variables.slug] });
    },
  });
}

export function useCreateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createChannel,
    onSuccess: () => qc.invalidateQueries({ queryKey: [CHANNELS_KEY] }),
  });
}

export function useJoinChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinChannel,
    onSuccess: () => qc.invalidateQueries({ queryKey: [CHANNELS_KEY] }),
  });
}

export function useMembers(slug: string) {
  return useQuery({
    queryKey: [MEMBERS_KEY, slug],
    queryFn: () => fetchMembers(slug),
    enabled: !!slug,
  });
}

export function useMarkRead() {
  return useMutation({ mutationFn: markChannelRead });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/commons/api.ts
git commit -m "feat(commons): add API functions and TanStack Query hooks"
```

---

### Task 15: Create Echo Hooks

**Files:**
- Create: `frontend/src/features/commons/hooks/useEcho.ts`
- Create: `frontend/src/features/commons/hooks/usePresence.ts`

- [ ] **Step 1: Create useEcho hook**

```typescript
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import type { Message } from "../types";

/**
 * Subscribe to real-time message events for a channel.
 * Appends new messages to the TanStack Query cache.
 */
export function useChannelSubscription(channelId: number | undefined, slug: string) {
  const qc = useQueryClient();
  const subscribedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!channelId || subscribedRef.current === channelId) return;

    const echo = getEcho();

    // Leave previous channel
    if (subscribedRef.current !== null) {
      echo.leave(`commons.channel.${subscribedRef.current}`);
    }

    echo
      .private(`commons.channel.${channelId}`)
      .listen("MessageSent", (event: { message: Message }) => {
        qc.setQueryData<Message[]>(["commons-messages", slug], (old) => {
          if (!old) return [event.message];
          // Avoid duplicates
          if (old.some((m) => m.id === event.message.id)) return old;
          return [event.message, ...old];
        });
      })
      .listen("MessageUpdated", (event: { message: Partial<Message>; action: string }) => {
        qc.setQueryData<Message[]>(["commons-messages", slug], (old) => {
          if (!old) return old;
          return old.map((m) =>
            m.id === event.message.id ? { ...m, ...event.message } : m,
          );
        });
      });

    subscribedRef.current = channelId;

    return () => {
      echo.leave(`commons.channel.${channelId}`);
      subscribedRef.current = null;
    };
  }, [channelId, slug, qc]);
}
```

- [ ] **Step 2: Create usePresence hook**

```typescript
import { useEffect, useState } from "react";
import { getEcho } from "@/lib/echo";
import type { PresenceUser } from "../types";

/**
 * Subscribe to the global Commons presence channel.
 * Returns the list of currently online users.
 */
export function usePresence(): PresenceUser[] {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const echo = getEcho();

    echo
      .join("commons.online")
      .here((users: PresenceUser[]) => {
        setOnlineUsers(users);
      })
      .joining((user: PresenceUser) => {
        setOnlineUsers((prev) =>
          prev.some((u) => u.id === user.id) ? prev : [...prev, user],
        );
      })
      .leaving((user: PresenceUser) => {
        setOnlineUsers((prev) => prev.filter((u) => u.id !== user.id));
      });

    return () => {
      echo.leave("commons.online");
    };
  }, []);

  return onlineUsers;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/commons/hooks/
git commit -m "feat(commons): add useChannelSubscription and usePresence hooks"
```

---

## Chunk 4: Frontend UI

### Task 16: Create UI Components — Sidebar

**Files:**
- Create: `frontend/src/features/commons/components/sidebar/ChannelList.tsx`
- Create: `frontend/src/features/commons/components/sidebar/ChannelSearch.tsx`
- Create: `frontend/src/features/commons/components/sidebar/OnlineUsers.tsx`

- [ ] **Step 1: Create ChannelSearch**

```tsx
import { useState } from "react";
import { Search } from "lucide-react";

interface ChannelSearchProps {
  onSearch: (query: string) => void;
}

export function ChannelSearch({ onSearch }: ChannelSearchProps) {
  const [query, setQuery] = useState("");

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search channels..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSearch(e.target.value);
        }}
        className="w-full rounded-md border border-border bg-muted pl-9 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create ChannelList**

```tsx
import { useMemo, useState } from "react";
import { Hash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Channel } from "../../types";
import { ChannelSearch } from "./ChannelSearch";

interface ChannelListProps {
  channels: Channel[];
  activeSlug: string;
}

export function ChannelList({ channels, activeSlug }: ChannelListProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return channels;
    const q = search.toLowerCase();
    return channels.filter((c) => c.name.toLowerCase().includes(q));
  }, [channels, search]);

  const topicChannels = filtered.filter((c) => c.type === "topic" || c.type === "custom");
  const studyChannels = filtered.filter((c) => c.type === "study");

  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 pb-2">
        <ChannelSearch onSearch={setSearch} />
      </div>

      <SectionLabel>Channels</SectionLabel>
      {topicChannels.map((ch) => (
        <ChannelItem
          key={ch.id}
          channel={ch}
          isActive={ch.slug === activeSlug}
          onClick={() => navigate(`/commons/${ch.slug}`)}
        />
      ))}

      {studyChannels.length > 0 && (
        <>
          <SectionLabel>Study Channels</SectionLabel>
          {studyChannels.map((ch) => (
            <ChannelItem
              key={ch.id}
              channel={ch}
              isActive={ch.slug === activeSlug}
              onClick={() => navigate(`/commons/${ch.slug}`)}
            />
          ))}
        </>
      )}

      <SectionLabel>Direct Messages</SectionLabel>
      <p className="px-4 text-xs italic text-muted-foreground">Phase 2</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
}: {
  channel: Channel;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Hash className="h-4 w-4 shrink-0" />
      <span className="truncate">{channel.name.toLowerCase().replace(/\s+/g, "-")}</span>
    </button>
  );
}
```

- [ ] **Step 3: Create OnlineUsers**

```tsx
import type { PresenceUser } from "../../types";

interface OnlineUsersProps {
  users: PresenceUser[];
}

export function OnlineUsers({ users }: OnlineUsersProps) {
  return (
    <div className="border-t border-border px-3 py-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Online — {users.length}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {users.map((user) => (
          <div
            key={user.id}
            title={user.name}
            className="relative flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
          >
            {getInitials(user.name)}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
          </div>
        ))}
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/sidebar/
git commit -m "feat(commons): add ChannelList, ChannelSearch, OnlineUsers sidebar components"
```

---

### Task 17: Create UI Components — Chat

**Files:**
- Create: `frontend/src/features/commons/components/chat/ChannelHeader.tsx`
- Create: `frontend/src/features/commons/components/chat/MessageItem.tsx`
- Create: `frontend/src/features/commons/components/chat/MessageList.tsx`
- Create: `frontend/src/features/commons/components/chat/MessageComposer.tsx`

- [ ] **Step 1: Create ChannelHeader**

```tsx
import { Hash, Users } from "lucide-react";
import type { Channel } from "../../types";

interface ChannelHeaderProps {
  channel: Channel;
}

export function ChannelHeader({ channel }: ChannelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">{channel.name}</h2>
        {channel.description && (
          <span className="text-sm text-muted-foreground">{channel.description}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>{channel.members_count}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MessageItem**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import type { Message } from "../../types";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group flex gap-3 px-5 py-2 hover:bg-muted/30">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
        {getInitials(message.user.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">{message.user.name}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
          {message.is_edited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-foreground [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_pre]:rounded-md [&_code]:text-teal-400">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {message.body}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
```

- [ ] **Step 3: Create MessageList**

```tsx
import { useEffect, useRef } from "react";
import type { Message } from "../../types";
import { MessageItem } from "./MessageItem";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (messages.length > prevCountRef.current) {
      const container = containerRef.current;
      if (container) {
        const isAtBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isAtBottom) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading messages...</p>
      </div>
    );
  }

  // Messages come from API in descending order — reverse for display
  const sorted = [...messages].reverse();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {sorted.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </p>
        </div>
      ) : (
        <div className="py-4">
          {sorted.map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 4: Create MessageComposer**

```tsx
import { useState, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface MessageComposerProps {
  channelName: string;
  onSend: (body: string) => void;
  disabled?: boolean;
}

export function MessageComposer({ channelName, onSend, disabled }: MessageComposerProps) {
  const [body, setBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setBody("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="border-t border-border px-5 py-3">
      <div className="rounded-lg border border-border bg-muted p-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message #${channelName} — Markdown supported`}
          rows={2}
          disabled={disabled}
          className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            **bold** *italic* `code` — Shift+Enter for new line
          </p>
          <button
            onClick={handleSubmit}
            disabled={disabled || !body.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/commons/components/chat/
git commit -m "feat(commons): add ChannelHeader, MessageItem, MessageList, MessageComposer"
```

---

### Task 18: Create Right Panel and Layout

**Files:**
- Create: `frontend/src/features/commons/components/rightpanel/RightPanel.tsx`
- Create: `frontend/src/features/commons/components/CommonsLayout.tsx`
- Create: `frontend/src/features/commons/pages/CommonsPage.tsx`

- [ ] **Step 1: Create RightPanel**

```tsx
import { useState } from "react";
import { Activity, Pin, FileText } from "lucide-react";

const TABS = [
  { key: "activity", label: "Activity", icon: Activity },
  { key: "pinned", label: "Pinned", icon: Pin },
  { key: "files", label: "Files", icon: FileText },
] as const;

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<string>("activity");
  const active = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  return (
    <div className="flex w-[280px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <active.icon className="h-8 w-8" />
        <p className="text-sm font-medium">{active.label}</p>
        <p className="text-xs">Coming in a future update</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CommonsLayout**

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useChannels, useChannel, useMessages, useSendMessage, useMarkRead } from "../api";
import { usePresence } from "../hooks/usePresence";
import { useChannelSubscription } from "../hooks/useEcho";
import { ChannelList } from "./sidebar/ChannelList";
import { OnlineUsers } from "./sidebar/OnlineUsers";
import { ChannelHeader } from "./chat/ChannelHeader";
import { MessageList } from "./chat/MessageList";
import { MessageComposer } from "./chat/MessageComposer";
import { RightPanel } from "./rightpanel/RightPanel";

export function CommonsLayout() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const activeSlug = slug ?? "general";

  const { data: channels = [], isLoading: channelsLoading } = useChannels();
  const { data: channel } = useChannel(activeSlug);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeSlug);
  const sendMessage = useSendMessage();
  const markRead = useMarkRead();
  const onlineUsers = usePresence();

  // Subscribe to real-time events for the active channel
  useChannelSubscription(channel?.id, activeSlug);

  // Mark channel as read when viewed
  useEffect(() => {
    if (activeSlug) {
      markRead.mutate(activeSlug);
    }
  }, [activeSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect to /commons/general if no slug
  useEffect(() => {
    if (!slug && channels.length > 0) {
      navigate(`/commons/general`, { replace: true });
    }
  }, [slug, channels, navigate]);

  function handleSend(body: string) {
    sendMessage.mutate({ slug: activeSlug, body });
  }

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left sidebar */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
        <div className="p-4">
          <h1 className="text-lg font-bold text-foreground">Commons</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channelsLoading ? (
            <p className="px-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <ChannelList channels={channels} activeSlug={activeSlug} />
          )}
        </div>
        <OnlineUsers users={onlineUsers} />
      </div>

      {/* Center chat area */}
      <div className="flex flex-1 flex-col">
        {channel && <ChannelHeader channel={channel} />}
        <MessageList messages={messages} isLoading={messagesLoading} />
        {channel && (
          <MessageComposer
            channelName={channel.name.toLowerCase().replace(/\s+/g, "-")}
            onSend={handleSend}
            disabled={sendMessage.isPending}
          />
        )}
      </div>

      {/* Right panel */}
      <RightPanel />
    </div>
  );
}
```

- [ ] **Step 3: Create CommonsPage**

```tsx
import { CommonsLayout } from "../components/CommonsLayout";

export default function CommonsPage() {
  return <CommonsLayout />;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/commons/components/rightpanel/ frontend/src/features/commons/components/CommonsLayout.tsx frontend/src/features/commons/pages/
git commit -m "feat(commons): add CommonsLayout, RightPanel, and CommonsPage"
```

---

### Task 19: Add Routing and Sidebar Navigation

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Commons routes to router.tsx**

Add inside the protected route `children` array, after the Dashboard `index` route:

```tsx
{
  path: "commons",
  children: [
    {
      index: true,
      lazy: () =>
        import("@/features/commons/pages/CommonsPage").then((m) => ({
          Component: m.default,
        })),
    },
    {
      path: ":slug",
      lazy: () =>
        import("@/features/commons/pages/CommonsPage").then((m) => ({
          Component: m.default,
        })),
    },
  ],
},
```

- [ ] **Step 2: Add Commons to sidebar nav items**

In `frontend/src/components/layout/Sidebar.tsx`:

1. Add `MessageSquare` to the lucide-react import:
```tsx
import { ..., MessageSquare } from "lucide-react";
```

2. Add the Commons nav item right after the Dashboard entry in the `navItems` array:
```tsx
{ path: "/commons", label: "Commons", icon: MessageSquare },
```

The `navItems` array should now start with:
```tsx
const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/commons", label: "Commons", icon: MessageSquare },
  {
    path: "/data-sources",
    label: "Data",
    ...
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

Expected: No errors.

- [ ] **Step 4: Build frontend**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(commons): add routing and sidebar navigation entry"
```

---

### Task 20: Deploy and End-to-End Verification

- [ ] **Step 1: Run deploy script**

```bash
./deploy.sh
```

- [ ] **Step 2: Verify Commons page loads**

Open `https://parthenon.acumenus.net/commons` in browser. Expected:
- Three-panel layout renders
- Channel sidebar shows #general, #data-quality, #concept-sets
- #general is selected by default
- Message area shows "No messages yet" or messages if seeded
- Right panel shows placeholder tabs
- Composer is functional

- [ ] **Step 3: Send a test message**

Type "Hello from Commons!" in the composer and press Enter. Verify:
- Message appears immediately in the list
- Message renders with correct user name and timestamp

- [ ] **Step 4: Verify real-time in a second tab**

Open a second browser tab at `/commons`. Send a message from tab 1. Verify it appears in tab 2 without refresh.

- [ ] **Step 5: Final commit with all remaining files**

```bash
git add -A
git status
git commit -m "feat(commons): Phase 1 Foundation — complete real-time messaging"
```
