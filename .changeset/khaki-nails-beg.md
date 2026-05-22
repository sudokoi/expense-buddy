---
"expense-buddy": minor
---

Add Android-only background SMS transaction alerts that detect new messages offline, post local notifications, and reopen the existing review-first SMS import flow.

Play-installed Android builds now prefer the standard full-screen Google Play in-app update flow instead of background flexible downloads, with flexible fallback kept for cases where immediate updates are unavailable. The in-app review request path also uses lighter local gating so review prompts are easier to reach on eligible Play installs, while still leaving final dialog display up to Google Play.
