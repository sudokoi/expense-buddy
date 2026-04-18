from __future__ import annotations

import json
from pathlib import Path

from sms_ml.augmented_datasets import (
    AUGMENTED_SUMMARY_PATH,
    AUGMENTED_TRAIN_PATH,
    AUGMENTED_VAL_PATH,
    write_seed_augmented_dataset,
)
from sms_ml.datasets import read_jsonl
from sms_ml.models.seed_litert_embed import (
    evaluate_model,
    export_tflite_model,
    get_model_metadata,
    train_model,
    write_metadata,
)

MODEL_ID = "seed-litert-embed-augmented-v1"
WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_ROOT = WORKSPACE_ROOT / "artifacts" / "training" / MODEL_ID
METRICS_PATH = WORKSPACE_ROOT / "artifacts" / "training" / f"{MODEL_ID}-metrics.json"
MODEL_PATH = ARTIFACT_ROOT / "model.tflite"
METADATA_PATH = ARTIFACT_ROOT / "metadata.json"


def main() -> None:
    write_seed_augmented_dataset(train_percent=90)
    train_records = read_jsonl(AUGMENTED_TRAIN_PATH)
    val_records = read_jsonl(AUGMENTED_VAL_PATH)
    model = train_model(train_records)

    export_tflite_model(model, MODEL_PATH)
    write_metadata(METADATA_PATH, model_id=MODEL_ID)
    summary = json.loads(AUGMENTED_SUMMARY_PATH.read_text(encoding="utf-8"))

    payload = {
        "modelId": MODEL_ID,
        "approach": "hashed-sequence-embedding-avgpool-litert",
        "trainingScope": "merged seed plus additional source datasets (90/10 split)",
        "warnings": [
            "The seed labels are bootstrapped from heuristic rules.",
            "The additional synthetic datasets should be reviewed before final claims.",
        ],
        "datasetSummary": summary,
        "featureContract": get_model_metadata(model_id=MODEL_ID).to_dict(),
        "train": evaluate_model(model, train_records),
        "val": evaluate_model(model, val_records),
    }
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote augmented-data LiteRT embedding model bundle to {ARTIFACT_ROOT}")


if __name__ == "__main__":
    main()