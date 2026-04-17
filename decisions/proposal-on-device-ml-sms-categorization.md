# Proposal: On-Device ML SMS Categorization

**Date:** 2026-04-17  
**Status:** Research and planning draft  
**Author:** Planning draft via GitHub Copilot

---

## Goal

Explore a future Android-only, on-device ML categorization system for SMS import that:

- improves category suggestion quality beyond the shipped regex-first parser
- learns from user corrections without introducing a backend
- preserves the current review-first and local-only privacy boundaries

This proposal uses PR 43 only as historical context. It does not assume that the previous architecture, training pipeline, model format, or sync behavior should be revived.

## Non-goals

- replacing the existing regex import path in the near term
- on-device neural model retraining in the first ML release
- any cloud inference or backend-hosted personalization
- syncing raw SMS content or training examples off device

## Constraints

- SMS import remains Android-only
- raw SMS bodies stay local to the device
- imported expenses remain review-first
- the categorization system must tolerate offline use
- the system must fit the existing Expo and native-module architecture

## Platform baseline

The current app already targets a sufficiently modern Android baseline for classical on-device inference.

- The Android app module delegates `minSdkVersion` through Expo config in [android/app/build.gradle](android/app/build.gradle).
- The resolved generated Android manifest in the current workspace indicates `minSdkVersion` 24.
- This is above the floor for common classical runtimes such as LiteRT or TensorFlow Lite interpreter APIs.

Conclusion: a bundled local inference runtime does not require raising the app's current Android floor.

## Runtime options

### Option A: LiteRT or TensorFlow Lite in a native Android module

Use a Kotlin-native inference layer next to the existing SMS native module.

Pros:

- strong Android fit
- low runtime floor
- mature mobile inference path
- easy to keep inference off the JS thread
- good long-term path if native acceleration matters later

Cons:

- requires native model I/O handling and tokenizer integration
- adds model packaging and compatibility work

Assessment:

This is the default recommendation.

### Option B: ONNX Runtime Mobile in a native Android module

Use ONNX Runtime from Kotlin or Java if the training workflow strongly prefers ONNX export.

Pros:

- flexible model ecosystem
- viable Android integration path
- compatible with many modern text models

Cons:

- larger integration surface than necessary for a first Android-only prototype
- less aligned with the Google Android ML ecosystem

Assessment:

Reasonable alternative if model development is easier in ONNX than LiteRT.

### Option C: ML Kit GenAI or AICore-based APIs

Use device-provided generative models to classify SMS text.

Pros:

- minimal model packaging if supported

Cons:

- API 26+ and device-dependent availability
- tied to AICore and supported hardware
- unsuitable as the primary path for broad Android support
- harder to make deterministic and benchmarkable for narrow category classification

Assessment:

Not recommended for the main SMS categorization path.

## Recommended architecture

Use a hybrid system with three layers:

1. deterministic extraction and guardrails
2. a compact local ML category model
3. a lightweight local personalization layer

### Layer 1: Deterministic extraction and guardrails

Keep the shipped regex and sender rules for fields that are already explainable and high precision:

- amount extraction
- currency detection
- date normalization
- known sender heuristics
- transaction versus non-transaction filtering

This avoids asking the model to solve problems that rules already solve well.

### Layer 2: Base ML category model

Use a small text classifier to predict one of the app's default categories from:

- SMS body text
- sender identifier
- optional engineered features such as amount bucket or token flags

The base model should be trained offline and bundled with the app.

Recommended model-development approach:

- start from a pretrained compact text model or embedding model rather than training from scratch
- perform offline transfer learning or fine-tuning on labeled SMS samples
- export the final model to a mobile runtime format such as LiteRT or TensorFlow Lite
- keep the shipped on-device model inference-only in the first release

First-release scope:

- predict only shipped default categories
- produce confidence scores
- fall back to regex or `Other` at low confidence
- remain read-only on device

### Layer 3: Local personalization

Do not start with on-device retraining.

Instead, learn from user decisions through lightweight local adaptation:

- sender to category preferences
- merchant token to category preferences
- correction history weights
- optional per-user overrides that can win over the base model when confidence is high enough

This satisfies the product need to learn from user behavior without introducing unstable or battery-heavy model training.

## Training strategy

Yes, some offline training on sample SMS data is likely required if the goal is to beat regex-based categorization in a reliable way.

The recommended split is:

- offline transfer learning to create the shipped base model
- on-device local personalization to adapt to each user's patterns after install

This keeps the shipped system practical. The heavy learning happens before release, while the device only performs inference and lightweight preference updates.

### Recommended approach

Use transfer learning rather than training a text classifier from scratch.

Preferred path:

1. choose a compact pretrained text encoder or classifier that can be exported to mobile
2. fine-tune it offline on expense-category SMS examples
3. compress or quantize it for mobile inference
4. ship it as the base categorization model

This is the lowest-risk way to make the model "apt" for transaction SMS without needing a massive dataset.

### Data needed for training

The model will need labeled examples of SMS messages mapped to the app's shipped default categories.

Recommended training corpus composition:

- anonymized real transaction SMS samples
- template-derived synthetic variants to expand bank and merchant phrasing coverage
- negative examples such as OTP, promotional, account alerts, and credit-only messages
- multilingual or mixed-language examples only if they are in scope for the first release

Each sample should include, when available:

- SMS body
- sender ID
- target category
- transaction or non-transaction label

Optional engineered features for training and inference:

- amount bucket
- sender family or bank tag
- merchant token flags
- payment method hints such as UPI or card

### Data handling requirements

Training data should not casually reuse raw production SMS.

Use one of these paths:

- curated anonymized fixtures collected intentionally for development
- developer-only fixture capture tooling that strips or masks sensitive content before data enters the training set
- synthetic generation from known bank and merchant templates

Do not rely on synced raw SMS data from production devices.

### What to train first

Train only for category classification first.

Do not train the model to solve every part of SMS parsing. Keep these outside the model initially:

- amount extraction
- transaction date extraction
- payment method extraction
- duplicate detection
- review-state decisions

That keeps the ML task narrow and makes evaluation much more credible.

### Training loop

The executable loop should look like this:

1. build a labeled benchmark from anonymized SMS fixtures
2. measure current regex-only category accuracy as the baseline
3. train a compact transfer-learned model offline
4. compare regex-only, model-only, and hybrid results on a held-out test set
5. export the best candidate to mobile format
6. verify latency and memory on representative Android devices
7. ship behind a feature flag

### Avoiding bad evaluation

Do not randomly split near-duplicate template variants across train and test.

Instead:

- group splits by sender or message template family where possible
- keep a true holdout set from unseen template variants
- track per-category and per-sender failure patterns

Otherwise the offline metrics will look better than the real product behavior.

### Post-ship learning

User corrections after launch should feed the local personalization layer first, not immediate retraining.

If later you want the base model to improve from field data, do that through a separate deliberate process:

- collect new anonymized fixtures intentionally
- retrain offline
- ship a new model version in an app update

That is much safer than letting each device mutate the base model independently.

## Why not start with on-device retraining

On-device retraining is attractive in theory but high cost in practice.

Risks:

- harder to validate and debug
- more battery and storage pressure
- more difficult model version migration
- more difficult test reproducibility
- more complicated rollback behavior when a bad adaptation lands

Product-wise, local adaptive memory is likely to deliver most of the value earlier.

## Suggested data flow

1. Native SMS scanner reads candidate messages.
2. Rule-based parser extracts structured transaction fields.
3. If the SMS is eligible, native inference computes category scores.
4. Local personalization adjusts or overrides the base ranking.
5. The review queue shows the proposed category with confidence metadata.
6. User confirmation or correction is stored locally as a learning signal.
7. Personalization tables are updated locally.

## Evaluation plan

Do not begin with runtime integration. Begin with a benchmark.

Create an offline evaluation set made from:

- anonymized real SMS fixtures
- current regex outputs
- final user-reviewed category outcomes

Measure at least:

- top-1 category accuracy
- top-3 category recall
- low-confidence fallback rate
- review correction rate
- per-category confusion
- latency on representative Android devices

Success criterion for moving past prototype:

- materially lower correction rate than regex-only categorization
- no regression in privacy boundaries or review-first flow
- acceptable latency on low and mid-tier Android devices

## Suggested phases

### Phase 0: Evaluation harness

- define category label set
- build anonymized benchmark fixtures
- compare regex-only, model-only, and hybrid scoring offline

### Phase 1: Native inference spike

- add a Kotlin-native inference module
- integrate a bundled compact model
- return category scores to TypeScript behind a feature flag

### Phase 2: Hybrid review-first prototype

- combine rules plus model in the staged review flow
- expose confidence and fallback behavior
- store user corrections locally

### Phase 3: Personalization layer

- add sender and merchant adaptation
- evaluate whether this closes most of the gap without retraining

### Phase 4: Revisit true on-device training only if needed

- consider incremental fine-tuning only if the simpler personalization layer fails to deliver enough improvement

## Open questions

- What default category taxonomy should the model target in multilingual SMS cases?
- How much anonymized reviewed SMS data is available for offline benchmarking?
- Should personalization be purely local, or optionally sync only derived preferences without raw SMS content?
- What confidence threshold keeps the review queue helpful rather than noisy?
- Which low-end Android device should define the latency budget?

## Recommendation

Proceed with a fresh design rather than reviving PR 43.

Recommended first prototype:

- native Kotlin inference module
- LiteRT or TensorFlow Lite runtime
- bundled compact text classifier
- shipped regex extraction retained as guardrails
- local sender and merchant personalization instead of on-device retraining

This is the lowest-risk path that still gives the product a credible route to outperform regex-based categorization and learn from user decisions.