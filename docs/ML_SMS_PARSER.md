# ML SMS Parser Architecture

## Overview

The SMS Import feature uses an **ML-only parsing approach** powered by an on-device TensorFlow Lite Bi-LSTM model. All transaction extraction from SMS messages happens locally on the device using `react-native-fast-tflite`.

```
┌─────────────────────────────────────────────────────────────┐
│                    ML PARSER FLOW                            │
└─────────────────────────────────────────────────────────────┘
                        │
    SMS Received        ▼
         │    ┌──────────────────┐
         └───▶│  ML Model (TFLite)│
              │  Bi-LSTM Parser  │
              └──────────────────┘
                        │
              ┌─────────┴─────────┐
              │                   │
     High Confidence        Low Confidence
        (≥ 0.7)               (< 0.7)
              │                   │
              ▼                   ▼
    ┌──────────────────┐  ┌──────────────────┐
    │   Review Queue   │  │     Skipped      │
    │  (User Review)   │  │  (Not Imported)  │
    └──────────────────┘  └──────────────────┘
```

## Why ML-Only?

- **Generalization**: Handles unseen SMS formats from any bank or region
- **Universal**: Works across languages and financial institutions
- **Improves over time**: The learning engine refines merchant categorization from user feedback
- **On-device**: All inference runs locally, no data leaves the device
- **Single path**: One parsing pipeline simplifies debugging and maintenance

## Implementation Details

### Confidence Threshold

| Confidence | Action                                  |
| ---------- | --------------------------------------- |
| ≥ 0.7      | Transaction added to review queue       |
| < 0.7      | Message skipped (not a transaction SMS) |

### Code Example

```typescript
import { mlParser } from "./services/sms-import/ml/ml-parser"

// Initialize (loads TFLite model)
await mlParser.initialize()

// Parse SMS
const result = await mlParser.parse(smsText, "sms")

if (result.parsed) {
  console.log(`Parsed via ${result.method}:`)
  console.log(`  Merchant: ${result.parsed.merchant}`)
  console.log(`  Amount: ${result.parsed.amount}`)
  console.log(`  Confidence: ${result.confidence}`)
} else {
  // Confidence too low or model unavailable
  console.log("Could not parse transaction from SMS")
}
```

## Performance

### Benchmarks

| Device            | ML Inference |
| ----------------- | ------------ |
| High-end Android  | 60ms         |
| Mid-range Android | 90ms         |
| Low-end Android   | 150ms        |

### Optimization Strategies

1. **Lazy Loading**: ML model loads on first SMS or app startup
2. **Caching**: Parsed results cached for 24h
3. **Batch Processing**: Inbox scanner processes multiple SMS together
4. **Warmup**: Model runs a dummy inference on init to prime the pipeline

## Machine Learning Model

### Architecture

```
Input: SMS Text (max 256 tokens)
    ↓
Tokenization: Word-level (vocab) + character-level (OOV fallback)
    ↓
Bi-LSTM Model:
  - Embedding layer
  - Bidirectional LSTM
  - Dense output heads
    ↓
Task Heads:
  - NER: Merchant name extraction
  - Regression: Amount prediction
  - Date: Transaction date extraction
  - Confidence: Prediction scoring
    ↓
Output: Structured transaction data
```

### Model Specifications

- **Architecture**: Bi-LSTM
- **Size**: ~8MB (INT8 quantized TFLite)
- **Input**: 256 tokens max
- **Output**: 7 values (merchant indices, amount, date, confidence)
- **Inference**: 60-150ms on CPU
- **Library**: react-native-fast-tflite

### Tokenization

The model uses a two-tier tokenization strategy:

1. **Word-level**: Known words from `assets/models/tokenizer_vocab.json` are mapped to integer token IDs
2. **Character-level fallback**: Out-of-vocabulary (OOV) words use character code encoding

The reverse vocabulary lookup converts token IDs back to readable text for entity extraction.

### Training Data

**Sources:**

1. **Public Datasets**: ~50 samples (Hugging Face, GitHub)
2. **Synthetic Data**: ~450 samples (generated from patterns)
3. **User Contributions**: Opt-in collection (future)

**Regions Covered:**

- 🇮🇳 India (200 samples): HDFC, ICICI, SBI, Axis, Kotak
- 🇺🇸 US (150 samples): Chase, BofA, Wells Fargo, Citi
- 🇪🇺 EU (50 samples): Revolut, N26, ING
- 🇯🇵 Japan (50 samples): MUFG, SMBC, Mizuho

## Training the Model

### Prerequisites

```bash
# Install UV (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Setup environment
cd ml/training
uv sync
```

### Data Preparation

```bash
# Generate synthetic data + load real samples
uv run python prepare_data.py

# Output:
# - data/processed/train.json (400 samples)
# - data/processed/val.json (100 samples)
```

### Training

```bash
# Train Bi-LSTM model
uv run python train.py \
  --data_dir ../data/processed \
  --output_dir ../models/checkpoints \
  --epochs 10 \
  --batch_size 16
```

### Vocab Export

```bash
# Export tokenizer vocabulary for on-device use
uv run python export_vocab.py
# Output: assets/models/tokenizer_vocab.json
```

### Conversion

```bash
# Convert to TFLite with INT8 quantization
uv run python convert_to_tflite.py \
  --checkpoint ../models/checkpoints/best \
  --output ../models/final/sms_parser_model.tflite
```

### Deployment

```bash
# Copy to app assets
cp ml/models/final/sms_parser_model.tflite assets/models/

# Rebuild app
yarn android
```

## Testing

```bash
# Test TFLite parser and tokenizer
yarn test services/sms-import/ml/tflite-parser.test.ts
yarn test services/sms-import/ml/tflite-tokenizer.property.test.ts

# Test ML parser wrapper
yarn test services/sms-import/ml/ml-parser.test.ts

# Test message ID generation
yarn test services/sms-import/ml/message-id.property.test.ts
```

## Privacy & Security

- **On-Device**: All ML inference happens locally
- **No Cloud**: No SMS data sent to servers
- **Opt-In**: User consent required for data collection
- **Anonymized**: Training data hashed and stripped of PII

## Troubleshooting

### ML Model Not Loading

```typescript
// Check if ML is available
if (mlParser.isMLAvailable()) {
  console.log("ML model loaded")
} else {
  console.log("ML model not available, SMS parsing disabled")
}
```

### Low Accuracy

1. Check confidence scores in the review queue
2. Correct misclassified imports (feeds the learning engine)
3. Collect more training samples for underrepresented banks
4. Retrain model with new data

## Resources

- **Library**: [react-native-fast-tflite](https://github.com/mrousavy/react-native-fast-tflite)
- **Training**: See `ml/training/` directory
- **Datasets**: Hugging Face, GitHub SMS parsers
