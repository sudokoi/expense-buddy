# SMS ML Reference

This document is the stable handoff reference for developers and LLM agents
working in the SMS ML workspace.

## Current taxonomy

- Food
- Transport
- Groceries
- Rent
- Utilities
- Entertainment
- Health
- Other

## Mapping policy

- food-related merchants such as Zomato, Swiggy, Domino's, Pizza Hut, KFC, and Starbucks map to `Food`
- ride-hailing and commute merchants such as Uber and Ola map to `Transport`
- grocery merchants such as Zepto, Instamart, Blinkit, BigBasket, and Grofers map to `Groceries`
- entertainment merchants such as Netflix, BookMyShow, and Spotify map to `Entertainment`
- electricity and other utility bill text maps to `Utilities`
- Apollo, pharmacy, medicine, and similar health text maps to `Health`
- fuel and travel-ticket intents are collapsed to `Transport`
- uncertain cases default to `Other`

## Current baselines

- `current-regex`: existing regex-heavy parser reproduced in Python for offline evaluation
- `taxonomy-first`: deterministic category mapper using the explicit merchant and text policy used to seed labels
- `seed-logreg-v1`: first trainable bootstrap classifier using TF-IDF plus logistic regression over labeled debit SMS text
- `seed-litert-v1`: first Android-native classifier using hashed token features and a LiteRT-exported softmax model
- `seed-litert-embed-v1`: stronger LiteRT candidate using hashed token IDs plus learned embeddings and average pooling
- `seed-litert-attention-v1`: LSTM-plus-attention sequence candidate currently usable as an offline benchmark only

## Current measured state

- `current-regex` category accuracy on the current labeled seed set: `0.5578635014836796`
- `taxonomy-first` category accuracy on the current labeled seed set: `1.0`
- `seed-logreg-v1` validation accuracy on labeled debit seed data: `0.9393939393939394`
- `seed-litert-v1` validation accuracy on labeled debit seed data: `0.8636363636363636`
- `seed-litert-embed-v1` validation accuracy on labeled debit seed data: `0.9696969696969697`
- `seed-litert-attention-v1` validation accuracy on labeled debit seed data: `0.9545454545454546`
- `seed-logreg-hybrid` category accuracy on the current labeled seed set: `0.9881305637982196`
- `seed-litert-hybrid` category accuracy on the current labeled seed set: `0.857566765578635`
- `seed-litert-embed-hybrid` category accuracy on the current labeled seed set: `0.8724035608308606`
- `seed-litert-attention-hybrid` category accuracy on the current labeled seed set: `0.8635014836795252`

## Evaluation warning

- the current labeled seed dataset was initialized from the same taxonomy-first mapping policy
- a perfect taxonomy-first score on the current seed labels is therefore expected and should not be treated as a production-quality comparison
- use the taxonomy-first baseline as a sanity check and bootstrapping tool, not as the final benchmark to beat
- any model trained purely on these heuristic labels inherits the same ceiling and should be treated as a workflow bootstrap rather than a production-ready quality signal
- the very high `seed-logreg-hybrid` score should be read in the same light: it is useful for plumbing validation, not yet for product claims

## Seed workflow

1. Import the seed reference dataset from local git history.
2. Normalize into JSONL with provenance and baseline hints.
3. Generate or review the seed label queue.
4. Apply labels into the normalized dataset.
5. Benchmark heuristics and train candidate models.

## Training direction

- keep extraction deterministic for amount, date, and transaction detection
- train only category prediction first
- compare every trainable model against `current-regex` and `taxonomy-first`
- treat the seed dataset as a bootstrapping set, not a production-quality benchmark
- save model metadata and evaluation artifacts in a form that both developers and LLM agents can inspect without rerunning training
- prefer model contracts that can be mirrored exactly inside the Android native module without a JS-thread dependency

## Native runtime contract

- the first app integration uses a LiteRT bundle inside the Android SMS native module
- the native model consumes deterministic hashed unigram and bigram features rather than raw strings
- Android feature extraction mirrors the Python export contract through shared metadata fields such as feature dimension, hash salt, token limits, and confidence threshold
- low-confidence native predictions fall back to the existing regex category suggestion in the app bootstrap flow
- the current Android gate is intentionally conservative: predictions under `0.55` confidence, or predictions of `Other`, do not replace the regex suggestion
- the embedding candidate is a better next Android-upgrade target because it keeps a small LiteRT contract and does not currently require Select TF ops
- the attention candidate currently exports with Select TF ops, so it would require runtime changes before Android can load it

## Public seed-source guidance

- reviewed public-source candidates and reuse notes are tracked in `docs/public-sources.md`
- there are not enough clearly reusable public transaction-SMS corpora to replace curated internal review
- treat public SMS samples as pattern seeds and legal-review inputs, not as a complete training set on their own

## Embedding recommendation

- embeddings are likely more helpful than plain TF-IDF once we need better generalization across unseen merchants and message wording
- the right first use is a frozen embedding encoder plus a lightweight classifier head
- embeddings are less compelling if the labels are still mostly heuristic-derived, because the model will mainly learn the same rule surface with higher complexity
- for product planning, embeddings should be evaluated offline first and only considered for Android inference if the accuracy gain is large enough to justify runtime cost