---
"expense-buddy": minor
---

Optimize sync engine with Git Trees API and SHA-based differential downloads

- Replace O(N) fetch phase with a single Git Trees API call to retrieve the full repository tree and blob SHAs
- Download only files whose SHA has changed since the last sync, skipping unchanged files entirely
- Reuse tree data in the push phase to eliminate a redundant `listFiles()` API call
- Fix sync notification count to reflect actual merge results (added + updated from remote) instead of raw download count
- Add `remote-sha-cache.ts` for persisting blob SHAs between syncs (AsyncStorage, local-only)
- Add `getRepositoryTree()` to the GitHub API client for tree-based fetching
- Graceful fallback to Contents API when the Trees API is unavailable (network errors, truncated trees, 404/500)
- Cold start (empty SHA cache) performs a full download, identical to pre-optimization behavior
- No changes to remote repository format, merge logic, or push-side differential sync
- Comprehensive property-based and integration tests covering all 6 correctness properties
