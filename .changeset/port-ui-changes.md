---
"expense-buddy": minor
---

UI and storage improvements

- **Faster local storage**: Switched to MMKV for quicker app data persistence, with a one-time automatic migration of your existing data on first launch.
- **Icon action buttons**: Compact icon-only buttons with long-press tooltips across expense rows, category and payment instrument actions, sheet close buttons, day navigation, and search.
- **Richer changelog**: Release notes now render full markdown — headings, ordered and unordered lists, inline and fenced code, links, and blockquotes.
- **Readable input placeholders**: Placeholder text now stays legible across all themes.
- **Improved "Report an Issue"**: The prompt now shows the actual number of logs that will be attached — up to 500 when signed in to GitHub, or up to 200 copied to the clipboard otherwise.
