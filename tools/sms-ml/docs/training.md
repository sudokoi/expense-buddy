# Bootstrap Training

This document tracks the first trainable model path in the SMS ML workspace.

## Current model

- model ID: `seed-logreg-v1`
- feature pipeline: TF-IDF over raw SMS body text
- classifier: multinomial logistic regression
- training scope: labeled debit transactions only
- inference role: category suggestion only

## Why this model exists

- verify the end-to-end offline training and loading path
- provide a cheap baseline before moving to mobile-export-friendly neural models
- keep deterministic extraction separate from category prediction

## Commands

- `yarn ml:train:seed-logreg`
- `yarn ml:benchmark:logreg`

## Artifacts

- model file: `models/generated/seed-logreg-v1.pkl`
- training metrics: `artifacts/training/seed-logreg-v1-metrics.json`
- hybrid benchmark: `artifacts/benchmarks/seed-v1-logreg-hybrid.json`

## Current observed results

- train accuracy: `1.0`
- validation accuracy: `0.9393939393939394`
- hybrid category accuracy: `0.9881305637982196`

## Current caveats

- the model fits the training split perfectly, which is a strong sign that the seed dataset is too small and too rule-shaped to treat this as a production-quality estimate
- the hybrid benchmark keeps deterministic extraction, so its support rate is still limited by the regex extraction path
- merchant accuracy remains `0.0` because the hybrid model only replaces category prediction and does not improve merchant extraction
- several categories, including `Rent`, `Utilities`, and `Health`, currently have no labeled examples in the evaluated seed splits

## Interpretation warning

- the current labels are bootstrapped from heuristic rules
- this model is therefore mainly a tooling and integration milestone
- do not treat its offline accuracy as the final evidence for shipping ML categorization

## Embeddings

- yes, embeddings can be helpful for the category task because they generalize better than raw TF-IDF across merchant aliases, phrasing changes, and multilingual variation
- the most pragmatic next step is a frozen-embedding experiment with a small linear classifier, not end-to-end encoder fine-tuning
- use embeddings to improve category prediction only; keep amount, date, and transaction detection deterministic
- do not treat embeddings as an automatic shipping choice for Android until model size, latency, export format, and offline runtime fit are proven

## Recommended embedding experiment

1. start with an offline-only frozen embedding model
2. compare it against `seed-logreg-v1` on independently reviewed labels when available
3. keep the classifier head simple so the experiment measures representation quality rather than training complexity
4. only pursue mobile inference integration if the gain over TF-IDF is real on non-heuristic labels