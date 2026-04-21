---
"expense-buddy": patch
---

Move Play Store update and in-app review support into a tracked local Expo module.

Play-installed Android builds now use native Play Core flows for in-app update checks, background download/install handoff, and conservative in-app review prompts, while non-Play builds keep the GitHub-release fallback behavior.
