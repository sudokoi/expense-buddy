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

## Evaluation warning

- the current labeled seed dataset was initialized from the same taxonomy-first mapping policy
- a perfect taxonomy-first score on the current seed labels is therefore expected and should not be treated as a production-quality comparison
- use the taxonomy-first baseline as a sanity check and bootstrapping tool, not as the final benchmark to beat

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