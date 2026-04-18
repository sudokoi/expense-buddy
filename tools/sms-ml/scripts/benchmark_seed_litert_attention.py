from __future__ import annotations

from pathlib import Path

from sms_ml.baselines.current_regex import predict_sms as predict_current_regex
from sms_ml.benchmarking import evaluate_records, write_report
from sms_ml.datasets import NormalizedSmsRecord, read_jsonl
from sms_ml.models.seed_litert import build_feature_text
from sms_ml.models.seed_litert_attention import (
    MODEL_ID,
    get_model_metadata,
    load_saved_model,
    predict_category,
)


class SeedLiteRtAttentionHybridPredictor:
    def __init__(self, model_path: Path) -> None:
        self.model = load_saved_model(model_path)
        self.metadata = get_model_metadata()

    def predict_sms(self, body: str):
        return predict_current_regex(body)

    def predict_record(self, record: NormalizedSmsRecord):
        baseline_prediction = predict_current_regex(record.sms_text)
        if not record.sms_text.strip():
            return baseline_prediction

        category, confidence = predict_category(self.model, build_feature_text(record))
        should_use_prediction = (
            confidence >= self.metadata.min_confidence and category != "Other"
        )
        return baseline_prediction.__class__(
            predictor_name="seed-litert-attention-hybrid",
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
    normalized_dir = ml_root / "data" / "normalized"
    model_path = ml_root / "artifacts" / "training" / MODEL_ID / "model.keras"
    artifacts_dir = ml_root / "artifacts" / "benchmarks"

    records = []
    for split_name in ("train", "val"):
        records.extend(read_jsonl(normalized_dir / f"seed-{split_name}.jsonl"))

    report = evaluate_records(records, SeedLiteRtAttentionHybridPredictor(model_path))
    output_path = artifacts_dir / "seed-v1-litert-attention-hybrid.json"
    write_report(output_path, report)
    print(f"Wrote benchmark report to {output_path}")


if __name__ == "__main__":
    main()