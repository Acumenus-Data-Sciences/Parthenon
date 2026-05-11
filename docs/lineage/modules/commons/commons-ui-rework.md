# Commons UI Rework — Devlog

**Date:** 2026-03-13
**Scope:** Visual polish pass to close the gap between approved wireframe mockups and implementation

## What Was Done

### Full-Bleed Layout
- Added `.layout-full-bleed` CSS escape hatch in `layout.css` — strips `content-main` padding, max-width, and outer scroll when a child page opts in
- CommonsLayout uses `h-full layout-full-bleed` instead of hardcoded `h-[calc(100vh-64px)]`
- Three columns now fill the entire page below the topbar with no wasted space

### Sidebar (matching wireframe border-left active style)
- Active channel uses `border-l-2 border-primary bg-primary/15` instead of solid `bg-primary` fill
- Removed `Hash` icon component, using inline `# slug` text
- Section labels reduced to `11px` with tighter tracking
- Unread badges have `min-w-[18px]` for consistent pill width

### Varied Avatar Colors
- Created `utils/avatarColor.ts` — deterministic color from 8-color palette (crimson, blue, purple, cyan, emerald, amber, red, indigo) based on `userId % 8`
- Applied to `OnlineUsers` sidebar avatars and `MessageItem` message avatars
- Matches wireframe where JD=blue, MK=purple, SU=crimson

### Channel Header
- Added Pins / Members / Activity toggle buttons with bordered pill style
- Channel name uses `# name` format at 15px font weight 600
- Description shown inline at 12px

### Message Composer
- Added formatting toolbar: Bold, Italic, Code, Paperclip icons from lucide-react
- `wrapSelection()` helper wraps selected text with markdown syntax
- Container uses `bg-[#1a1a22]` matching wireframe's dark input area
- Label "Message #channel — Markdown supported" above textarea

### Message Density
- Messages use `py-2.5` padding and `gap-2.5` (vs cramped `py-2 gap-3`)
- Prose text color `#ccc` with `leading-relaxed` for breathing room
- Code blocks use `bg-[#1a1a22]` with `p-3` padding
- `space-y-1` between messages in list

### Right Panel
- Activity icon changed to `Zap` (matching wireframe lightning bolt)
- Placeholder text hierarchy: medium title + subtle "Coming in a future update"

## Lessons Learned
- The `content-main` CSS class with padding/max-width is great for data pages but needs an escape hatch for full-bleed layouts like chat
- CSS `:has()` selector enables clean opt-in without JavaScript state
- Hardcoded `calc(100vh - Npx)` is fragile — `h-full` with proper flex parents is more robust
- Small typography changes (11px labels, 13px channel names) compound into a significantly more polished feel

## Files Changed
- `frontend/src/styles/components/layout.css`
- `frontend/src/features/commons/components/CommonsLayout.tsx`
- `frontend/src/features/commons/components/chat/ChannelHeader.tsx`
- `frontend/src/features/commons/components/chat/MessageComposer.tsx`
- `frontend/src/features/commons/components/chat/MessageItem.tsx`
- `frontend/src/features/commons/components/chat/MessageList.tsx`
- `frontend/src/features/commons/components/sidebar/ChannelList.tsx`
- `frontend/src/features/commons/components/sidebar/OnlineUsers.tsx`
- `frontend/src/features/commons/components/rightpanel/RightPanel.tsx`
- `frontend/src/features/commons/utils/avatarColor.ts` (new)
