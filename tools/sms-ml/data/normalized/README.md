# Normalized Datasets

This directory contains normalized JSONL datasets used by the SMS ML workspace.

Current dataset:

- `seed-train.jsonl`
- `seed-val.jsonl`
- `seed-summary.json`

These files are generated from the seed reference dataset with:

- stable record IDs
- explicit provenance fields
- normalized transaction fields
- an optional `baseline_category_seed`

Important:

- `target_category` is intentionally `null` until the seed dataset is manually labeled
- `baseline_category_seed` is derived from the current regex heuristic and is not ground truth