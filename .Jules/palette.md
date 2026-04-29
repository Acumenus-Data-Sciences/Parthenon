## 2024-04-22 - Added aria-labels to icon-only chat buttons
**Learning:** Found several icon-only buttons in the chat components lacking aria-labels, making them inaccessible to screen readers.
**Action:** Always add aria-labels to icon-only buttons, specifically in chat actions menus, emoji pickers, and reference pickers. Use i18n translation keys whenever possible for localized accessibility.

## 2024-04-29 - Added aria-labels to icon-only buttons in announcements
**Learning:** Icon-only buttons used for secondary actions (like bookmarking and deleting) in the Announcement Board lacked `aria-label` attributes.
**Action:** When adding or reviewing list-based UI components (like announcements, feeds, or lists of items), ensure all icon-only action buttons have descriptive `aria-label`s, preferably utilizing existing `title` translations.
