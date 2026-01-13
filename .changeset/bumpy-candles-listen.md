---
"expense-buddy": major
---

BREAKING: Native GitHub sync setup now uses GitHub OAuth Device Flow ("Sign in with GitHub") instead of manually entering a Personal Access Token.

- Android/iOS: sign in via GitHub, then pick a repository (personal repos only; requires write access)
- During sign-in, the app shows a device code with actions to copy the code and open the GitHub verification page in your browser
- Web: still uses manual Personal Access Token entry (unchanged)

If you previously configured sync on native using a PAT, you may need to sign in again and re-select your repo/branch.
