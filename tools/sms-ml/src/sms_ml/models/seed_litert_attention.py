from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, cast

import numpy as np

from sms_ml.categories import DEFAULT_EXPENSE_CATEGORIES, ExpenseCategory
from sms_ml.datasets import NormalizedSmsRecord
from sms_ml.models.seed_litert import build_feature_text, labeled_debit_records
from sms_ml.models.seed_litert_embed import (
    HASH_BUCKET_SIZE,
    HASH_SALT,
    MAX_SEQUENCE_LENGTH,
    MAX_TOKENS,
    encode_term_sequence,
)

MODEL_ID = "seed-litert-attention-v1"
LSTM_UNITS = 48
ATTENTION_UNITS = 32
DENSE_UNITS = 48
MIN_CONFIDENCE = 0.5


@dataclass(frozen=True)
class LiteRtAttentionModelMetadata:
    model_id: str
    approach: str
    labels: list[str]
    hash_bucket_size: int
    hash_salt: str
    max_tokens: int
    max_sequence_length: int
    lstm_units: int
    attention_units: int
    dense_units: int
    min_confidence: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_sequence_matrix(records: list[NormalizedSmsRecord]) -> np.ndarray:
    labeled_records = labeled_debit_records(records)
    if not labeled_records:
        raise ValueError("Need labeled debit records to build LiteRT attention inputs")

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
        output_dim=48,
        name="token_embedding",
    )(inputs)
    sequences = tf_any.keras.layers.LSTM(
        LSTM_UNITS,
        return_sequences=True,
        dropout=0.0,
        recurrent_dropout=0.0,
        name="sequence_encoder",
    )(embeddings)
    attention_hidden = tf_any.keras.layers.Dense(
        ATTENTION_UNITS,
        activation="tanh",
        name="attention_hidden",
    )(sequences)
    attention_scores = tf_any.keras.layers.Dense(
        1,
        activation=None,
        name="attention_scores",
    )(attention_hidden)
    attention_weights = tf_any.keras.layers.Softmax(
        axis=1,
        name="attention_weights",
    )(attention_scores)
    context = tf_any.keras.layers.Dot(
        axes=1,
        name="attention_context",
    )([attention_weights, sequences])
    context = tf_any.keras.layers.Flatten(name="attention_context_flat")(
        context
    )
    hidden = tf_any.keras.layers.Dense(
        DENSE_UNITS,
        activation="relu",
        name="hidden",
    )(context)
    hidden = tf_any.keras.layers.Dropout(0.15, name="dropout")(hidden)
    outputs = tf_any.keras.layers.Dense(
        label_count,
        activation="softmax",
        name="category",
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
        optimizer=tf_any.keras.optimizers.Adam(learning_rate=0.003),
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


def save_keras_model(model: Any, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save(path)


def load_saved_model(path: Path) -> Any:
    import tensorflow as tf

    tf_any = cast(Any, tf)
    return tf_any.keras.models.load_model(path)


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


def get_model_metadata() -> LiteRtAttentionModelMetadata:
    return LiteRtAttentionModelMetadata(
        model_id=MODEL_ID,
        approach="hashed-sequence-lstm-attention-litert",
        labels=list(DEFAULT_EXPENSE_CATEGORIES),
        hash_bucket_size=HASH_BUCKET_SIZE,
        hash_salt=HASH_SALT,
        max_tokens=MAX_TOKENS,
        max_sequence_length=MAX_SEQUENCE_LENGTH,
        lstm_units=LSTM_UNITS,
        attention_units=ATTENTION_UNITS,
        dense_units=DENSE_UNITS,
        min_confidence=MIN_CONFIDENCE,
    )


def export_tflite_model(model: Any, path: Path) -> None:
    import tensorflow as tf

    tf_any = cast(Any, tf)
    converter = tf_any.lite.TFLiteConverter.from_keras_model(model)
    converter.target_spec.supported_ops = [
        tf_any.lite.OpsSet.TFLITE_BUILTINS,
        tf_any.lite.OpsSet.SELECT_TF_OPS,
    ]
    converter._experimental_lower_tensor_list_ops = False
    converter.optimizations = [tf_any.lite.Optimize.DEFAULT]
    payload = cast(bytes, converter.convert())
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
        "approach": "hashed-sequence-lstm-attention-litert",
        "trainingScope": "labeled debit seed records",
        "warnings": [
            "The current seed labels are bootstrapped from heuristic rules.",
            "Use these metrics for tooling validation, not for product-level "
            "quality claims.",
            "This model currently exports with Select TF ops, so it is not "
            "drop-in Android runtime compatible yet.",
        ],
        "featureContract": get_model_metadata().to_dict(),
        "train": train_metrics,
        "val": val_metrics,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")