## 2024-04-22 - Added aria-labels to icon-only chat buttons
**Learning:** Found several icon-only buttons in the chat components lacking aria-labels, making them inaccessible to screen readers.
**Action:** Always add aria-labels to icon-only buttons, specifically in chat actions menus, emoji pickers, and reference pickers. Use i18n translation keys whenever possible for localized accessibility.
