#!/usr/bin/env python3
"""
Export tokenizer vocabulary to JSON for React Native.

Reads the trained Keras tokenizer (pickle) and exports the word_index
to a JSON file that the TFLite parser can load at runtime.

Usage:
    uv run python -m training.export_vocab
    uv run python -m training.export_vocab --tokenizer path/to/tokenizer.pkl --output path/to/vocab.json
"""

import argparse
import json
import pickle
from pathlib import Path


def export_vocab(tokenizer_path: str, output_path: str) -> None:
    """
    Export tokenizer word_index to JSON.

    Args:
        tokenizer_path: Path to the pickled Keras Tokenizer
        output_path: Output path for the JSON vocab file
    """
    tokenizer_file = Path(tokenizer_path)

    if not tokenizer_file.exists():
        print(f"Tokenizer file not found: {tokenizer_file}")
        print("Run the training pipeline first, or use the default vocab.")
        return

    print(f"Loading tokenizer from {tokenizer_file}...")
    with open(tokenizer_file, "rb") as f:
        tokenizer = pickle.load(f)

    word_index = tokenizer.word_index

    # Ensure <PAD> is at index 0 (Keras tokenizer reserves 0 for padding)
    if "<PAD>" not in word_index:
        word_index = {"<PAD>": 0, **word_index}

    vocab_data = {
        "word_index": word_index,
    }

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(vocab_data, f, indent=2)

    print(f"Exported vocab: {len(word_index)} words -> {output_file}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export tokenizer vocab to JSON")
    parser.add_argument(
        "--tokenizer",
        default="../models/checkpoints/tokenizer.pkl",
        help="Path to tokenizer pickle file",
    )
    parser.add_argument(
        "--output",
        default="../../assets/models/tokenizer_vocab.json",
        help="Output JSON file path",
    )

    args = parser.parse_args()
    export_vocab(args.tokenizer, args.output)


if __name__ == "__main__":
    main()
