#!/usr/bin/env python3
"""
Convert trained Keras model to TensorFlow Lite format.
"""

import argparse
import pickle
from pathlib import Path

import tensorflow as tf


def convert_to_tflite(checkpoint_path: str, output_path: str, tokenizer_path: str = None):
    """
    Convert Keras model to TFLite format.

    Args:
        checkpoint_path: Path to .h5 model file or checkpoint directory
        output_path: Output path for .tflite file
        tokenizer_path: Path to tokenizer pickle file (optional)
    """
    print("=" * 60)
    print("TFLite Model Conversion")
    print("=" * 60)

    checkpoint = Path(checkpoint_path)
    if checkpoint.is_dir():
        model_path = checkpoint / "sms_parser_model.h5"
    else:
        model_path = checkpoint

    print(f"\nModel: {model_path}")
    print(f"Output: {output_path}")

    # Load model
    print("\nLoading Keras model...")
    model = tf.keras.models.load_model(str(model_path))
    print(f"Input shape: {model.input_shape}")
    print(f"Output shape: {model.output_shape}")

    # Convert to TFLite
    print("\nConverting to TFLite...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    # Optimizations
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    # For Bi-LSTM models, we need to use SELECT_TF_OPS
    # This allows TensorFlow ops that aren't natively in TFLite
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,  # enable TensorFlow Lite ops
        tf.lite.OpsSet.SELECT_TF_OPS,  # enable TensorFlow ops
    ]

    # Disable experimental tensor list lowering (needed for LSTM)
    converter._experimental_lower_tensor_list_ops = False

    tflite_model = converter.convert()

    # Save
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "wb") as f:
        f.write(tflite_model)

    print(f"\nModel saved: {output_file}")
    print(f"Size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")

    # Also save tokenizer vocab for React Native
    if tokenizer_path:
        tokenizer_file = Path(tokenizer_path)
        if tokenizer_file.exists():
            print("\nPreparing tokenizer vocab...")
            with open(tokenizer_file, "rb") as f:
                tokenizer = pickle.load(f)

            # Save word index as JSON for React Native
            import json

            vocab_file = output_file.parent / "tokenizer_vocab.json"
            vocab_data = {
                "word_index": tokenizer.word_index,
                "max_len": getattr(tokenizer, "max_len", 128),
                "oov_token": tokenizer.oov_token,
            }

            with open(vocab_file, "w") as f:
                json.dump(vocab_data, f)

            print(f"Vocab saved: {vocab_file}")
            print(f"Vocab size: {len(tokenizer.word_index)} words")

    print("\n" + "=" * 60)
    print("Conversion complete!")
    print("=" * 60)
    print(f"\nOutput files:")
    print(f"  - Model: {output_file}")
    if tokenizer_path and Path(tokenizer_path).exists():
        print(f"  - Vocab: {output_file.parent / 'tokenizer_vocab.json'}")


def main():
    parser = argparse.ArgumentParser(description="Convert model to TFLite")
    parser.add_argument(
        "--checkpoint", required=True, help="Path to .h5 model or checkpoint directory"
    )
    parser.add_argument(
        "--output",
        default="ml/models/final/sms_parser_model.tflite",
        help="Output TFLite file path",
    )
    parser.add_argument(
        "--tokenizer",
        default="ml/models/checkpoints/tokenizer.pkl",
        help="Path to tokenizer pickle file",
    )

    args = parser.parse_args()
    convert_to_tflite(args.checkpoint, args.output, args.tokenizer)


if __name__ == "__main__":
    main()
