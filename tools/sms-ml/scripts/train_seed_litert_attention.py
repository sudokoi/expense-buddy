from __future__ import annotations

from pathlib import Path

from sms_ml.datasets import read_jsonl
from sms_ml.models.seed_litert_attention import (
    MODEL_ID,
    evaluate_model,
    export_tflite_model,
    save_keras_model,
    train_model,
    write_metadata,
    write_training_metrics,
)

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
TRAIN_PATH = WORKSPACE_ROOT / "data" / "normalized" / "seed-train.jsonl"
VAL_PATH = WORKSPACE_ROOT / "data" / "normalized" / "seed-val.jsonl"
ARTIFACT_ROOT = WORKSPACE_ROOT / "artifacts" / "training" / MODEL_ID
METRICS_PATH = WORKSPACE_ROOT / "artifacts" / "training" / f"{MODEL_ID}-metrics.json"
MODEL_PATH = ARTIFACT_ROOT / "model.tflite"
KERAS_MODEL_PATH = ARTIFACT_ROOT / "model.keras"
METADATA_PATH = ARTIFACT_ROOT / "metadata.json"


def main() -> None:
    train_records = read_jsonl(TRAIN_PATH)
    val_records = read_jsonl(VAL_PATH)
    model = train_model(train_records)
    write_training_metrics(
        METRICS_PATH,
        train_metrics=evaluate_model(model, train_records),
        val_metrics=evaluate_model(model, val_records),
    )
    save_keras_model(model, KERAS_MODEL_PATH)
    export_tflite_model(model, MODEL_PATH)
    write_metadata(METADATA_PATH)
    print(f"Wrote LiteRT attention model bundle to {ARTIFACT_ROOT}")


if __name__ == "__main__":
    main()