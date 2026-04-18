from __future__ import annotations

from pathlib import Path

from sms_ml.augmented_datasets import (
    AUGMENTED_TRAIN_PATH,
    AUGMENTED_VAL_PATH,
    write_seed_augmented_dataset,
)
from sms_ml.baselines.current_regex import predict_sms as predict_current_regex
from sms_ml.benchmarking import evaluate_records, write_report
from sms_ml.datasets import NormalizedSmsRecord, read_jsonl
from sms_ml.models.seed_litert import build_feature_text
from sms_ml.models.seed_litert_embed import (
    get_model_metadata,
    load_tflite_interpreter,
    predict_tflite_category,
)

MODEL_ID = "seed-litert-embed-augmented-v1"


class SeedLiteRtEmbeddingAugmentedHybridPredictor:
    def __init__(self, model_path: Path) -> None:
        self.interpreter = load_tflite_interpreter(model_path)
        self.metadata = get_model_metadata(model_id=MODEL_ID)

    def predict_sms(self, body: str):
        return predict_current_regex(body)

    def predict_record(self, record: NormalizedSmsRecord):
        baseline_prediction = predict_current_regex(record.sms_text)
        if not record.sms_text.strip():
            return baseline_prediction

        category, confidence = predict_tflite_category(
            self.interpreter,
            build_feature_text(record),
        )
        should_use_prediction = (
            confidence >= self.metadata.min_confidence and category != "Other"
        )
        return baseline_prediction.__class__(
            predictor_name="seed-litert-embed-augmented-hybrid",
            is_supported_transaction=baseline_prediction.is_supported_transaction,
            transaction_type=baseline_prediction.transaction_type,
            merchant=baseline_prediction.merchant,
            amount=baseline_prediction.amount,
            currency=baseline_prediction.currency,
            category=(
                category if should_use_prediction else baseline_prediction.category
            ),
        )


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    model_path = ml_root / "artifacts" / "training" / MODEL_ID / "model.tflite"
    artifacts_dir = ml_root / "artifacts" / "benchmarks"

    write_seed_augmented_dataset(train_percent=90)
    records = read_jsonl(AUGMENTED_TRAIN_PATH) + read_jsonl(AUGMENTED_VAL_PATH)

    report = evaluate_records(
        records,
        SeedLiteRtEmbeddingAugmentedHybridPredictor(model_path),
    )
    output_path = artifacts_dir / "seed-v1-litert-embed-augmented-hybrid.json"
    write_report(output_path, report)
    print(f"Wrote benchmark report to {output_path}")


if __name__ == "__main__":
    main()