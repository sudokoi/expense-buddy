# SMS Transaction Parser - ML Training Pipeline

This directory contains the machine learning training pipeline for the SMS transaction parser.

## Prerequisites

Install UV (fast Python package manager):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Architecture

The ML model uses a **MobileBERT** base with custom heads for:

- Merchant name extraction (NER)
- Amount prediction (regression)
- Date extraction (sequence tagging)
- Confidence scoring (binary classification)

## Model Specifications

- **Base Model**: MobileBERT (distilled)
- **Size**: ~8MB (INT8 quantized)
- **Input**: SMS text (max 256 characters)
- **Output**: Structured transaction data
- **Inference Time**: 50-100ms on mobile CPU

## Directory Structure

```
ml/
├── training/
│   ├── train.py              # Main training script
│   ├── model.py              # Model architecture
│   ├── data_loader.py        # Data loading utilities
│   ├── convert_to_tflite.py  # TFLite conversion
│   └── pyproject.toml        # UV dependencies
├── data/
│   ├── raw/                  # Raw SMS samples
│   ├── processed/            # Processed training data
│   └── synthetic/            # Generated synthetic data
└── models/
    ├── checkpoints/          # Training checkpoints
    └── final/                # Final TFLite models
```

## Training Data

### Sources

1. **Public Datasets**: ~50 samples from GitHub repos
2. **Synthetic Data**: ~450 samples generated from patterns
3. **User Contributions**: Collected via app (with consent)

### Data Format

```json
{
  "sms": "Rs. 1500 spent at Swiggy on 15-02-2024",
  "merchant": "Swiggy",
  "amount": 1500.0,
  "currency": "INR",
  "date": "2024-02-15",
  "type": "debit",
  "bank": "HDFC"
}
```

## Training Pipeline

### 1. Setup Environment

```bash
cd ml/training
uv sync
```

### 2. Prepare Data

```bash
uv run python prepare_data.py
# Generates: data/processed/train.json, data/processed/val.json
```

### 3. Train Model

```bash
uv run python train.py \
  --data_dir ../data/processed \
  --output_dir ../models/checkpoints \
  --epochs 10 \
  --batch_size 16
```

### 4. Convert to TFLite

```bash
uv run python convert_to_tflite.py \
  --checkpoint ../models/checkpoints/best \
  --output ../models/final/sms_parser_model.tflite
```

### 5. Deploy

Copy the generated `.tflite` file to:

```
assets/models/sms_parser_model.tflite
```

## Model Performance Targets

- **Accuracy**: >90% on validation set
- **F1 Score**: >0.85 for entity extraction
- **Inference Time**: <100ms on mid-range Android
- **Model Size**: <10MB

## Continuous Learning

The app supports continuous learning through:

1. Local feedback collection (opt-in)
2. Periodic model updates via app updates
3. Federated learning (future)

## Privacy

- All training data is anonymized
- No PII (Personally Identifiable Information) stored
- User consent required for data collection
- Local training only (no cloud)
