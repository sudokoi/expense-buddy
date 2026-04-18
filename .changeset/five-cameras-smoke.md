---
"expense-buddy": minor
---

Revamp Settings and upgrade Android SMS ML inference.

- move common settings actions to the top-level screen and move payment management into a dedicated submenu
- add feature flags for math expressions and ML-only SMS import inference behavior
- upgrade the bundled Android SMS classifier to the stronger `seed-litert-embed-augmented-v1` model contract
- document the SMS ML model architectures and current Android-ready pipeline
