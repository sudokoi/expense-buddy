---
"expense-buddy": major
---

BREAKING: Native GitHub sync setup now uses GitHub OAuth Device Flow ("Sign in with GitHub") instead of manually entering a Personal Access Token.

- Android/iOS: sign in via GitHub, then pick a repository (personal repos only; requires write access)
- Web: still uses manual Personal Access Token entry (unchanged)

If you previously configured sync on native using a PAT, you may need to sign in again and re-select your repo/branch.
