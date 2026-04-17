from __future__ import annotations

import hashlib
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, cast

import numpy as np

from sms_ml.categories import DEFAULT_EXPENSE_CATEGORIES, ExpenseCategory
from sms_ml.datasets import NormalizedSmsRecord

MODEL_ID = "seed-litert-v1"
FEATURE_DIMENSION = 2048
HASH_SALT = "sms-ml-seed-litert-v1"
MAX_TOKENS = 256
MIN_TOKEN_LENGTH = 2
MAX_TOKEN_LENGTH = 32
MIN_CONFIDENCE = 0.55
TOKEN_PATTERN = re.compile(r"[a-z0-9]{2,32}")
NGRAM_SEPARATOR = "__"


@dataclass(frozen=True)
class LiteRtModelMetadata:
    model_id: str
    approach: str
    labels: list[str]
    feature_dimension: int
    hash_salt: str
    min_token_length: int
    max_token_length: int
    max_tokens: int
    ngram_separator: str
    min_confidence: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def labeled_debit_records(
    records: list[NormalizedSmsRecord],
) -> list[NormalizedSmsRecord]:
    return [
        record
        for record in records
        if record.transaction_type == "debit" and record.target_category is not None
    ]


def build_feature_text(record: NormalizedSmsRecord) -> str:
    return " ".join(
        part.strip()
        for part in (record.bank or "", record.merchant or "", record.sms_text)
        if part and part.strip()
    )


def tokenize_text(text: str) -> list[str]:
    normalized = text.lower()
    return TOKEN_PATTERN.findall(normalized)[:MAX_TOKENS]


def iter_terms(tokens: list[str]) -> list[str]:
    terms = list(tokens)
    terms.extend(
        f"{tokens[index]}{NGRAM_SEPARATOR}{tokens[index + 1]}"
        for index in range(len(tokens) - 1)
    )
    return terms


def stable_hash_index(term: str, feature_dimension: int = FEATURE_DIMENSION) -> int:
    digest = hashlib.sha256(f"{HASH_SALT}\0{term}".encode("utf-8")).digest()
    return int.from_bytes(digest[:4], byteorder="big", signed=False) % feature_dimension


def vectorize_text(text: str, feature_dimension: int = FEATURE_DIMENSION) -> np.ndarray:
    features = np.zeros(feature_dimension, dtype=np.float32)
    for term in iter_terms(tokenize_text(text)):
        features[stable_hash_index(term, feature_dimension)] += 1.0

    norm = float(np.linalg.norm(features))
    if norm > 0:
        features /= norm
    return features


def build_feature_matrix(records: list[NormalizedSmsRecord]) -> np.ndarray:
    labeled_records = labeled_debit_records(records)
    if not labeled_records:
        raise ValueError("Need labeled debit records to build LiteRT features")

    return np.stack(
        [vectorize_text(build_feature_text(record)) for record in labeled_records]
    )


def encode_labels(records: list[NormalizedSmsRecord]) -> np.ndarray:
    labeled_records = labeled_debit_records(records)
    return np.array(
        [
            DEFAULT_EXPENSE_CATEGORIES.index(cast(ExpenseCategory, record.target_category))
            for record in labeled_records
        ],
        dtype=np.int32,
    )


def create_model(label_count: int) -> Any:
    import tensorflow as tf

    tf.keras.utils.set_random_seed(42)
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(FEATURE_DIMENSION,), name="features"),
            tf.keras.layers.Dense(label_count, activation="softmax", name="category"),
        ]
    )


def compute_class_weights(labels: np.ndarray) -> dict[int, float]:
    values, counts = np.unique(labels, return_counts=True)
    total = float(labels.shape[0])
    class_count = float(values.shape[0])
    return {
        int(value): total / (class_count * float(count))
        for value, count in zip(values, counts, strict=True)
    }


def train_model(records: list[NormalizedSmsRecord]) -> Any:
    import tensorflow as tf

    labeled_records = labeled_debit_records(records)
    if len(labeled_records) < 2:
        raise ValueError("Need at least two labeled debit records to train LiteRT")

    labels = {record.target_category for record in labeled_records}
    if len(labels) < 2:
        raise ValueError("Need at least two category labels to train LiteRT")

    features = build_feature_matrix(records)
    targets = encode_labels(records)
    model = create_model(len(DEFAULT_EXPENSE_CATEGORIES))
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.02),
        loss=tf.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    model.fit(
        features,
        targets,
        epochs=30,
        batch_size=min(16, len(labeled_records)),
        verbose=0,
        class_weight=compute_class_weights(targets),
    )
    return model


def predict_category(model: Any, sms_text: str) -> tuple[ExpenseCategory, float]:
    features = np.expand_dims(vectorize_text(sms_text), axis=0)
    probabilities = cast(np.ndarray, model.predict(features, verbose=0))[0]
    index = int(np.argmax(probabilities))
    return cast(ExpenseCategory, DEFAULT_EXPENSE_CATEGORIES[index]), float(
        probabilities[index]
    )


def evaluate_model(model: Any, records: list[NormalizedSmsRecord]) -> dict[str, object]:
    labeled_records = labeled_debit_records(records)
    if not labeled_records:
        raise ValueError("Need labeled debit records to evaluate LiteRT")

    correct_predictions = 0
    per_category: dict[str, dict[str, int]] = {
        category: {"total": 0, "hits": 0} for category in DEFAULT_EXPENSE_CATEGORIES
    }
    sample_errors: list[dict[str, str | float]] = []

    for record in labeled_records:
        target = cast(ExpenseCategory, record.target_category)
        predicted, confidence = predict_category(model, build_feature_text(record))
        per_category[target]["total"] += 1
        if predicted == target:
            correct_predictions += 1
            per_category[target]["hits"] += 1
            continue
        if len(sample_errors) < 10:
            sample_errors.append(
                {
                    "recordId": record.record_id,
                    "targetCategory": target,
                    "predictedCategory": predicted,
                    "confidence": confidence,
                }
            )

    total = len(labeled_records)
    return {
        "recordCount": total,
        "accuracy": correct_predictions / total,
        "perCategory": per_category,
        "sampleErrors": sample_errors,
    }


def get_model_metadata() -> LiteRtModelMetadata:
    return LiteRtModelMetadata(
        model_id=MODEL_ID,
        approach="hashed-bow-litert-softmax",
        labels=list(DEFAULT_EXPENSE_CATEGORIES),
        feature_dimension=FEATURE_DIMENSION,
        hash_salt=HASH_SALT,
        min_token_length=MIN_TOKEN_LENGTH,
        max_token_length=MAX_TOKEN_LENGTH,
        max_tokens=MAX_TOKENS,
        ngram_separator=NGRAM_SEPARATOR,
        min_confidence=MIN_CONFIDENCE,
    )


def export_tflite_model(model: Any, path: Path) -> None:
    import tensorflow as tf

    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    payload = converter.convert()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def write_metadata(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(get_model_metadata().to_dict(), indent=2),
        encoding="utf-8",
    )


def write_training_metrics(
    path: Path,
    train_metrics: dict[str, object],
    val_metrics: dict[str, object],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "modelId": MODEL_ID,
        "approach": "hashed-bow-litert-softmax",
        "trainingScope": "labeled debit seed records",
        "warnings": [
            "The current seed labels are bootstrapped from heuristic rules.",
            "Use these metrics for tooling validation, not for product-level quality claims.",
        ],
        "featureContract": get_model_metadata().to_dict(),
        "train": train_metrics,
        "val": val_metrics,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")