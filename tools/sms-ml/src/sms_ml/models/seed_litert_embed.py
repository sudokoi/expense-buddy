from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, cast

import numpy as np

from sms_ml.categories import DEFAULT_EXPENSE_CATEGORIES, ExpenseCategory
from sms_ml.datasets import NormalizedSmsRecord
from sms_ml.models.seed_litert import (
    MAX_TOKEN_LENGTH,
    MIN_TOKEN_LENGTH,
    NGRAM_SEPARATOR,
    build_feature_text,
    iter_terms,
    labeled_debit_records,
    tokenize_text,
)

MODEL_ID = "seed-litert-embed-v1"
HASH_BUCKET_SIZE = 8192
HASH_SALT = "sms-ml-seed-litert-embed-v1"
MAX_SEQUENCE_LENGTH = 96
MAX_TOKENS = 256
EMBEDDING_DIMENSION = 48
HIDDEN_UNITS = 64
MIN_CONFIDENCE = 0.5


@dataclass(frozen=True)
class LiteRtEmbeddingModelMetadata:
    model_id: str
    approach: str
    labels: list[str]
    hash_bucket_size: int
    hash_salt: str
    min_token_length: int
    max_token_length: int
    max_tokens: int
    max_sequence_length: int
    ngram_separator: str
    embedding_dimension: int
    min_confidence: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def stable_hash_bucket(term: str, hash_bucket_size: int = HASH_BUCKET_SIZE) -> int:
    digest = hashlib.sha256(f"{HASH_SALT}\0{term}".encode()).digest()
    return int.from_bytes(digest[:4], byteorder="big", signed=False) % hash_bucket_size


def encode_term_sequence(text: str) -> np.ndarray:
    sequence = np.zeros(MAX_SEQUENCE_LENGTH, dtype=np.int32)
    terms = iter_terms(tokenize_text(text))[:MAX_SEQUENCE_LENGTH]
    for index, term in enumerate(terms):
        sequence[index] = stable_hash_bucket(term) + 1
    return sequence


def build_sequence_matrix(records: list[NormalizedSmsRecord]) -> np.ndarray:
    labeled_records = labeled_debit_records(records)
    if not labeled_records:
        raise ValueError("Need labeled debit records to build LiteRT embedding inputs")

    return np.stack(
        [encode_term_sequence(build_feature_text(record)) for record in labeled_records]
    )


def encode_labels(records: list[NormalizedSmsRecord]) -> np.ndarray:
    labeled_records = labeled_debit_records(records)
    return np.array(
        [
            DEFAULT_EXPENSE_CATEGORIES.index(
                cast(ExpenseCategory, record.target_category)
            )
            for record in labeled_records
        ],
        dtype=np.int32,
    )


def create_model(label_count: int) -> Any:
    import tensorflow as tf

    tf_any = cast(Any, tf)
    tf_any.keras.utils.set_random_seed(42)
    inputs = tf_any.keras.Input(
        shape=(MAX_SEQUENCE_LENGTH,), dtype="int32", name="token_ids"
    )
    embeddings = tf_any.keras.layers.Embedding(
        input_dim=HASH_BUCKET_SIZE + 1,
        output_dim=EMBEDDING_DIMENSION,
        mask_zero=True,
        name="token_embedding",
    )(inputs)
    pooled = tf_any.keras.layers.GlobalAveragePooling1D(name="token_pool")(embeddings)
    hidden = tf_any.keras.layers.Dense(
        HIDDEN_UNITS, activation="relu", name="hidden"
    )(pooled)
    hidden = tf_any.keras.layers.Dropout(0.15, name="dropout")(hidden)
    outputs = tf_any.keras.layers.Dense(
        label_count, activation="softmax", name="category"
    )(hidden)
    return tf_any.keras.Model(inputs=inputs, outputs=outputs)


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

    tf_any = cast(Any, tf)
    labeled_records = labeled_debit_records(records)
    if len(labeled_records) < 2:
        raise ValueError("Need at least two labeled debit records to train LiteRT")

    labels = {record.target_category for record in labeled_records}
    if len(labels) < 2:
        raise ValueError("Need at least two category labels to train LiteRT")

    features = build_sequence_matrix(records)
    targets = encode_labels(records)
    model = create_model(len(DEFAULT_EXPENSE_CATEGORIES))
    model.compile(
        optimizer=tf_any.keras.optimizers.Adam(learning_rate=0.004),
        loss=tf_any.keras.losses.SparseCategoricalCrossentropy(),
        metrics=["accuracy"],
    )
    model.fit(
        features,
        targets,
        epochs=45,
        batch_size=min(16, len(labeled_records)),
        verbose=0,
        class_weight=compute_class_weights(targets),
    )
    return model


def predict_category(model: Any, sms_text: str) -> tuple[ExpenseCategory, float]:
    features = np.expand_dims(encode_term_sequence(sms_text), axis=0)
    probabilities = cast(np.ndarray, model.predict(features, verbose=0))[0]
    index = int(np.argmax(probabilities))
    return DEFAULT_EXPENSE_CATEGORIES[index], float(probabilities[index])


def load_tflite_interpreter(path: Path) -> Any:
    import tensorflow as tf

    tf_any = cast(Any, tf)
    interpreter = tf_any.lite.Interpreter(model_path=str(path))
    interpreter.allocate_tensors()
    return interpreter


def predict_tflite_category(
    interpreter: Any, sms_text: str
) -> tuple[ExpenseCategory, float]:
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    features = np.expand_dims(encode_term_sequence(sms_text), axis=0).astype(np.int32)
    interpreter.set_tensor(input_details["index"], features)
    interpreter.invoke()
    probabilities = cast(np.ndarray, interpreter.get_tensor(output_details["index"]))[0]
    index = int(np.argmax(probabilities))
    return DEFAULT_EXPENSE_CATEGORIES[index], float(probabilities[index])


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


def get_model_metadata(model_id: str = MODEL_ID) -> LiteRtEmbeddingModelMetadata:
    return LiteRtEmbeddingModelMetadata(
        model_id=model_id,
        approach="hashed-sequence-embedding-avgpool-litert",
        labels=list(DEFAULT_EXPENSE_CATEGORIES),
        hash_bucket_size=HASH_BUCKET_SIZE,
        hash_salt=HASH_SALT,
        min_token_length=MIN_TOKEN_LENGTH,
        max_token_length=MAX_TOKEN_LENGTH,
        max_tokens=MAX_TOKENS,
        max_sequence_length=MAX_SEQUENCE_LENGTH,
        ngram_separator=NGRAM_SEPARATOR,
        embedding_dimension=EMBEDDING_DIMENSION,
        min_confidence=MIN_CONFIDENCE,
    )


def export_tflite_model(model: Any, path: Path) -> None:
    import tensorflow as tf

    tf_any = cast(Any, tf)
    converter = tf_any.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf_any.lite.Optimize.DEFAULT]
    payload = cast(bytes, converter.convert())
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)


def write_metadata(path: Path, model_id: str = MODEL_ID) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(get_model_metadata(model_id=model_id).to_dict(), indent=2),
        encoding="utf-8",
    )


def write_training_metrics(
    path: Path,
    train_metrics: dict[str, object],
    val_metrics: dict[str, object],
    model_id: str = MODEL_ID,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "modelId": model_id,
        "approach": "hashed-sequence-embedding-avgpool-litert",
        "trainingScope": "labeled debit seed records",
        "warnings": [
            "The current seed labels are bootstrapped from heuristic rules.",
            "Use these metrics for tooling validation, not for product-level "
            "quality claims.",
        ],
        "featureContract": get_model_metadata(model_id=model_id).to_dict(),
        "train": train_metrics,
        "val": val_metrics,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")