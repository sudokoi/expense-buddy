#!/usr/bin/env python3
"""
Train SMS parser model using MobileBERT.
Simplified version for initial v3.0.0 release.
"""

import json
import argparse
from pathlib import Path


def load_data(data_dir: str):
    """Load training and validation data."""
    data_path = Path(data_dir)

    with open(data_path / "train.json") as f:
        train_data = json.load(f)

    with open(data_path / "val.json") as f:
        val_data = json.load(f)

    return train_data, val_data


def train_model(data_dir: str, output_dir: str, epochs: int = 10, batch_size: int = 16):
    """
    Train the SMS parser model.

    Note: This is a simplified placeholder for v3.0.0.
    Full implementation requires:
    1. Pre-trained MobileBERT model
    2. Custom NER head for entity extraction
    3. Regression head for amount prediction
    4. Proper tokenization and data pipeline

    For v3.0.0, the app uses regex-based parsing only.
    ML model will be added in v3.1 with full training pipeline.
    """
    print("=" * 60)
    print("SMS Parser Model Training")
    print("=" * 60)

    # Load data
    print(f"\nLoading data from {data_dir}...")
    train_data, val_data = load_data(data_dir)
    print(f"Train samples: {len(train_data)}")
    print(f"Val samples: {len(val_data)}")

    # Placeholder for actual training
    print(f"\nTraining configuration:")
    print(f"  Epochs: {epochs}")
    print(f"  Batch size: {batch_size}")
    print(f"  Model: MobileBERT (distilled)")
    print(f"  Output: {output_dir}")

    print("\n" + "=" * 60)
    print("NOTE: Full training pipeline coming in v3.1")
    print("=" * 60)
    print("""
The v3.0.0 release uses regex-based parsing with high accuracy
for known bank formats. The ML model enhancement will be added
in v3.1 after collecting sufficient training data.

To train the model (when ready):
1. Collect 1000+ labeled SMS samples
2. Run: uv run python train.py --data_dir ../data/processed
3. Convert: uv run python convert_to_tflite.py
4. Deploy: Copy .tflite to assets/models/
    """)


def main():
    parser = argparse.ArgumentParser(description="Train SMS parser model")
    parser.add_argument(
        "--data_dir", default="../data/processed", help="Path to processed data"
    )
    parser.add_argument(
        "--output_dir", default="../models/checkpoints", help="Output directory"
    )
    parser.add_argument("--epochs", type=int, default=10, help="Number of epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")

    args = parser.parse_args()

    train_model(args.data_dir, args.output_dir, args.epochs, args.batch_size)


if __name__ == "__main__":
    main()
