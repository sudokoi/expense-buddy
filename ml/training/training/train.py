#!/usr/bin/env python3
"""
Train lightweight SMS parser model.

Uses a simple Bi-LSTM architecture instead of MobileBERT for:
- Faster training
- Smaller model size (~2MB vs 8MB)
- Good enough accuracy for SMS extraction
"""

import json
import argparse
from pathlib import Path
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input,
    Embedding,
    LSTM,
    Bidirectional,
    Dense,
    TimeDistributed,
    Dropout,
)
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
from sklearn.model_selection import train_test_split
import pickle

# Configuration
MAX_LENGTH = 128
VOCAB_SIZE = 5000
EMBEDDING_DIM = 128
LSTM_UNITS = 64
BATCH_SIZE = 32
EPOCHS = 10

# Label mapping for NER
NUM_LABELS = 7  # O, B-MERCHANT, I-MERCHANT, B-AMOUNT, I-AMOUNT, B-DATE, I-DATE


def load_data(data_dir: str):
    """Load training and validation data."""
    data_path = Path(data_dir)

    with open(data_path / "train.json") as f:
        train_data = json.load(f)

    with open(data_path / "val.json") as f:
        val_data = json.load(f)

    return train_data, val_data


def create_tokenizer(texts, vocab_size=VOCAB_SIZE):
    """Create and fit tokenizer."""
    tokenizer = Tokenizer(num_words=vocab_size, oov_token="<OOV>")
    tokenizer.fit_on_texts(texts)
    return tokenizer


def prepare_sequences(texts, tokenizer, max_length=MAX_LENGTH):
    """Convert texts to sequences."""
    sequences = tokenizer.texts_to_sequences(texts)
    padded = pad_sequences(sequences, maxlen=max_length, padding="post")
    return padded


def extract_entities(text, merchant, amount, date):
    """Extract entity labels from text."""
    tokens = text.lower().split()
    labels = [0] * len(tokens)  # Default: O (0)

    # Simple keyword matching
    merchant_words = merchant.lower().split()
    for i, token in enumerate(tokens):
        # Check for merchant
        if any(mw in token for mw in merchant_words):
            labels[i] = 1 if i == 0 or labels[i - 1] != 2 else 2  # B-MERCHANT or I-MERCHANT

        # Check for amount (numbers)
        if any(char.isdigit() for char in token):
            labels[i] = 3 if i == 0 or labels[i - 1] != 4 else 4  # B-AMOUNT or I-AMOUNT

        # Check for date patterns
        if any(char.isdigit() for char in token) and ("-" in token or "/" in token or "." in token):
            labels[i] = 5 if i == 0 or labels[i - 1] != 6 else 6  # B-DATE or I-DATE

    return labels


def create_model(vocab_size, max_length, num_labels):
    """Create Bi-LSTM model."""
    # Input
    input_layer = Input(shape=(max_length,), name="input")

    # Embedding
    x = Embedding(vocab_size, EMBEDDING_DIM, input_length=max_length)(input_layer)

    # Bi-LSTM layers
    x = Bidirectional(LSTM(LSTM_UNITS, return_sequences=True))(x)
    x = Dropout(0.3)(x)
    x = Bidirectional(LSTM(LSTM_UNITS // 2, return_sequences=True))(x)
    x = Dropout(0.3)(x)

    # Output layer
    output = TimeDistributed(Dense(num_labels, activation="softmax"))(x)

    model = Model(inputs=input_layer, outputs=output)
    model.compile(optimizer="adam", loss="sparse_categorical_crossentropy", metrics=["accuracy"])

    return model


def train_model(data_dir: str, output_dir: str, epochs: int = EPOCHS):
    """Train the SMS parser model."""
    print("=" * 60)
    print("SMS Parser Model Training (Lightweight Bi-LSTM)")
    print("=" * 60)

    # Load data
    print(f"\nLoading data from {data_dir}...")
    train_data, val_data = load_data(data_dir)
    print(f"Train samples: {len(train_data)}")
    print(f"Val samples: {len(val_data)}")

    # Prepare texts
    train_texts = [item["sms"] for item in train_data]
    val_texts = [item["sms"] for item in val_data]
    all_texts = train_texts + val_texts

    # Create tokenizer
    print("Creating tokenizer...")
    tokenizer = create_tokenizer(all_texts)

    # Save tokenizer
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    with open(output_path / "tokenizer.pkl", "wb") as f:
        pickle.dump(tokenizer, f)

    # Prepare sequences
    print("Preparing sequences...")
    X_train = prepare_sequences(train_texts, tokenizer)
    X_val = prepare_sequences(val_texts, tokenizer)

    # Prepare labels
    print("Preparing labels...")
    y_train = []
    for item in train_data:
        labels = extract_entities(item["sms"], item["merchant"], item["amount"], item["date"])
        # Pad to MAX_LENGTH
        labels = labels[:MAX_LENGTH] + [0] * (MAX_LENGTH - len(labels))
        y_train.append(labels[:MAX_LENGTH])

    y_val = []
    for item in val_data:
        labels = extract_entities(item["sms"], item["merchant"], item["amount"], item["date"])
        labels = labels[:MAX_LENGTH] + [0] * (MAX_LENGTH - len(labels))
        y_val.append(labels[:MAX_LENGTH])

    y_train = np.array(y_train)
    y_val = np.array(y_val)

    # Reshape for sparse_categorical_crossentropy
    y_train = np.expand_dims(y_train, -1)
    y_val = np.expand_dims(y_val, -1)

    print(f"X_train shape: {X_train.shape}")
    print(f"y_train shape: {y_train.shape}")

    # Create model
    print("\nCreating model...")
    model = create_model(VOCAB_SIZE, MAX_LENGTH, NUM_LABELS)
    model.summary()

    # Train
    print(f"\nTraining for {epochs} epochs...")
    history = model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=BATCH_SIZE,
        verbose=1,
    )

    # Save model
    model_path = output_path / "final"
    model_path.mkdir(exist_ok=True)

    print(f"\nSaving model to {model_path}")
    model.save(model_path / "sms_parser_model.h5")

    # Print final metrics
    final_loss = history.history["loss"][-1]
    final_acc = history.history["accuracy"][-1]
    final_val_loss = history.history["val_loss"][-1]
    final_val_acc = history.history["val_accuracy"][-1]

    print("\n" + "=" * 60)
    print("Training Results:")
    print("=" * 60)
    print(f"Train Loss: {final_loss:.4f}, Accuracy: {final_acc:.4f}")
    print(f"Val Loss: {final_val_loss:.4f}, Accuracy: {final_val_acc:.4f}")

    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)
    print(f"\nNext step: Convert to TFLite")
    print(f"  uv run python -m training.convert_to_tflite \\")
    print(f"    --checkpoint {model_path} \\")
    print(f"    --output ../models/final/sms_parser_model.tflite")


def main():
    parser = argparse.ArgumentParser(description="Train SMS parser model")
    parser.add_argument("--data_dir", default="../data/processed", help="Path to processed data")
    parser.add_argument("--output_dir", default="../models/checkpoints", help="Output directory")
    parser.add_argument("--epochs", type=int, default=EPOCHS, help="Number of epochs")

    args = parser.parse_args()

    train_model(args.data_dir, args.output_dir, args.epochs)


if __name__ == "__main__":
    main()
