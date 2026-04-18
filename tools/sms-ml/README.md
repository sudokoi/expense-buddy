# SMS ML Workspace

This workspace contains the offline tooling for training, evaluating, and exporting
an on-device SMS categorization model.

Scope:

- benchmark datasets and anonymized fixture tooling
- offline training and evaluation
- model export for the Android inference runtime

Non-goals:

- app runtime code
- raw production SMS storage in the repository

## Layout

- `src/sms_ml/` Python package for training and evaluation code
- `tests/` Python tests for the ML workspace
- `data/reference/` recovered historical reference datasets
- `data/normalized/` normalized JSONL datasets for current experiments
- `data/labels/` manual labeling queues and reviewed category labels
- `data/additional/` imported synthetic and augmentation source datasets
- `artifacts/` local training outputs and reports, gitignored
- `models/generated/` exported model files, gitignored until a model contract is finalized

## Commands

Run these from the repository root:

- `yarn ml:sync`
- `yarn ml:import:seed`
- `yarn ml:prepare:seed`
- `yarn ml:labels:init`
- `yarn ml:labels:apply`
- `yarn ml:benchmark:seed`
- `yarn ml:benchmark:taxonomy`
- `yarn ml:train:seed-logreg`
- `yarn ml:benchmark:logreg`
- `yarn ml:train:seed-litert`
- `yarn ml:benchmark:litert`
- `yarn ml:train:seed-litert-embed`
- `yarn ml:benchmark:litert-embed`
- `yarn ml:train:seed-litert-attention`
- `yarn ml:benchmark:litert-attention`
- `yarn ml:export:seed-litert:android`
- `yarn ml:lint`
- `yarn ml:format`
- `yarn ml:typecheck`
- `yarn ml:test`
- `yarn ml:check`

Or run them directly inside this workspace with `uv`.

## Data handling

Do not commit raw SMS exports or unreviewed personal message data.

Only use:

- intentionally curated anonymized fixtures
- masked or synthetic SMS samples
- derived evaluation outputs that do not contain sensitive raw source content

## Seed Dataset Flow

The initial seed data is available in `data/reference/`.

To prepare it for the new workspace:

- run `yarn ml:import:seed` to refresh the seed reference files from local git history
- run `yarn ml:prepare:seed` to write normalized JSONL files into `data/normalized/`
- run `yarn ml:labels:init` to generate a CSV label queue for debit transactions
- fill in `data/labels/seed-label-queue.csv`
- run `yarn ml:labels:apply` to merge reviewed categories back into the normalized JSONL files
- run `yarn ml:benchmark:seed` to benchmark the current regex baseline and write a report into `artifacts/benchmarks/`
- run `yarn ml:benchmark:taxonomy` to benchmark the taxonomy-first heuristic baseline against the same labeled seed dataset
- run `yarn ml:train:seed-logreg` to train the first text classifier bootstrap model and write metrics into `artifacts/training/`
- run `yarn ml:benchmark:logreg` to benchmark a hybrid predictor that keeps deterministic extraction but swaps in the trained model for category prediction
- run `yarn ml:train:seed-litert` to train and export the first LiteRT-ready Android classifier bundle
- run `yarn ml:benchmark:litert` to benchmark the exported LiteRT model in the same hybrid extraction-plus-category flow used by the app
- run `yarn ml:train:seed-litert-embed` to train a stronger embedding-based LiteRT candidate over hashed token IDs
- run `yarn ml:benchmark:litert-embed` to benchmark the embedding-based hybrid predictor against the same seed dataset
- run `yarn ml:train:seed-litert-attention` to train an LSTM-plus-attention sequence candidate
- run `yarn ml:benchmark:litert-attention` to benchmark the attention hybrid predictor offline via the saved Keras model artifact
- run `yarn ml:export:seed-litert:android` to copy the latest LiteRT model bundle into the Android native module assets

Current limitation:

- the seed data starts without true expense-category labels, so category accuracy remains unavailable until the dataset is manually labeled

Public-source note:

- direct, reusable public transaction-SMS datasets are scarce; see `docs/public-sources.md` for the reviewed source shortlist and reuse caveats

## Reference Notes

- `current-regex` reflects the shipped parser's current offline category heuristics
- `taxonomy-first` uses the explicit merchant and text mapping policy from the seed labeling workflow
- `seed-logreg-v1` is the first trainable bootstrap category model and currently uses TF-IDF plus logistic regression over labeled debit SMS text
- `seed-litert-v1` is the first native-ready Android category model and uses hashed token features plus a LiteRT-exported softmax classifier
- `seed-litert-embed-v1` is the current stronger LiteRT candidate and uses hashed token IDs plus learned embeddings and average pooling
- `seed-litert-attention-v1` is an LSTM-plus-attention experiment that currently benchmarks offline only because its export still requires Select TF ops
- fuel and travel intents are intentionally collapsed into `Transport` because the shipped app taxonomy does not yet expose separate `Fuel` or `Travel` categories
- because the current seed labels were auto-seeded from the same mapping policy, `taxonomy-first` is a bootstrap sanity-check baseline rather than an unbiased offline winner
- for the same reason, `seed-logreg-v1` is useful for plumbing and export experiments but not yet for credible product claims