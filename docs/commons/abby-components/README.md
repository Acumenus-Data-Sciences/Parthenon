# Abby — AI Research Companion Components

React 19 + TypeScript components for integrating Abby into the Parthenon Commons workspace.

## Directory Structure

```
src/modules/commons/components/abby/
├── index.ts                        # Barrel exports
├── types/
│   └── abby.ts                     # TypeScript interfaces for all Abby entities
├── services/
│   └── abbyService.ts              # API client for Laravel AbbyController
├── hooks/
│   └── useAbby.ts                  # React hooks: useAbbyQuery, useAbbyFeedback, useAbbyMention
└── components/
    ├── AbbyAvatar.tsx              # Gradient avatar with optional status dot
    ├── AbbyResponseCard.tsx        # Full AI response: body + refs + sources + feedback
    ├── AbbySourceAttribution.tsx   # Expandable source panel with relevance scores
    ├── AbbyFeedback.tsx            # Helpful/not-helpful with categorized negative feedback
    ├── AbbyTypingIndicator.tsx     # Multi-stage RAG pipeline progress display
    ├── AbbyMentionHandler.tsx      # Detects @Abby in composer, orchestrates query lifecycle
    └── AskAbbyChannel.tsx          # Dedicated #ask-abby channel with conversational UX
```

## Component Overview

### AbbyAvatar
Consistent visual identity for Abby across all contexts. Emerald gradient background with "Ab" monogram. Three sizes (sm/md/lg) and optional online status dot.

### AbbyResponseCard
The primary rendering component for Abby's AI responses in the message stream. Composes `AbbySourceAttribution` and `AbbyFeedback` as child sections. Supports full and compact modes. Renders object reference chips that link to platform entities.

### AbbySourceAttribution
Expandable panel showing which pieces of institutional memory informed Abby's response. Each source shows:
- Origin (channel name, wiki, review decision)
- Author and date
- Snippet preview
- Relevance score bar

Collapsed by default for clean UX.

### AbbyFeedback
Two-state feedback widget:
- **Positive**: single-click "Helpful" → confirmation
- **Negative**: expands to categorized tags (inaccurate recall, wrong source, missing context, too verbose, hallucination) + optional free-text comment

### AbbyTypingIndicator
Shows the RAG pipeline stages as Abby processes a query:
1. ✓ Analyzing your question
2. ✓ Searching N knowledge collections
3. ⟳ Reading N relevant sources
4. ○ Composing response

Each stage animates through pending → active (spinner) → done (checkmark).

### AbbyMentionHandler
Orchestrates the @Abby lifecycle within any Commons channel:
1. Listens for `commons:message-sent` custom events
2. Detects @Abby mentions via regex
3. Extracts the query text
4. Fires `useAbbyQuery` hook
5. Renders `AbbyTypingIndicator` during processing
6. Renders `AbbyResponseCard` on completion
7. Renders error state with retry on failure

### AskAbbyChannel
Full-page dedicated channel for Abby interactions:
- Welcome card with suggested prompt chips
- Conversational bubble layout (user right-aligned, Abby left-aligned)
- Inline source attribution and object references
- Feedback buttons on every response
- Auto-scroll and keyboard submit

## Integration Points

### In any Commons channel (via @mention):
```tsx
// In your ChannelView component
import { AbbyMentionHandler } from '@/modules/commons/components/abby';

<AbbyMentionHandler
  channelId={channel.id}
  channelName={channel.name}
  parentMessageId={activeThread?.id}
/>
```

### In the message composer (to detect mentions):
```tsx
import { dispatchAbbyMentionEvent } from '@/modules/commons/components/abby';

// When a message is submitted:
function onSubmit(text: string) {
  // ... save message normally ...
  dispatchAbbyMentionEvent(text, currentUser.name);
}
```

### As the dedicated #ask-abby page:
```tsx
import { AskAbbyChannel } from '@/modules/commons/components/abby';

<AskAbbyChannel className="h-screen" />
```

## API Endpoints (Laravel)

These components expect the following API routes:

```
POST /api/commons/abby/query     → AbbyController@query
POST /api/commons/abby/feedback  → AbbyController@feedback
GET  /api/commons/abby/history   → AbbyController@history
```

## Styling

All components use Tailwind CSS classes compatible with Parthenon's TailwindCSS v4 configuration. Dark mode is fully supported via `dark:` variants. The emerald color family is Abby's brand color — used for the avatar gradient, AI badge, status indicator, and the "Ask" button.

## Dependencies

- React 19
- TypeScript
- TailwindCSS v4 (already in Parthenon)
- No additional packages required
