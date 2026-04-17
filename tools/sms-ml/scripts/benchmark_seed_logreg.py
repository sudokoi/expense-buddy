from pathlib import Path

from sms_ml.baselines.current_regex import predict_sms as predict_current_regex
from sms_ml.benchmarking import evaluate_records, write_report
from sms_ml.datasets import read_jsonl
from sms_ml.models.seed_logreg import MODEL_ID, load_model, predict_category


class SeedLogregHybridPredictor:
    def __init__(self, model_path: Path) -> None:
        self.model = load_model(model_path)

    def predict_sms(self, body: str):
        baseline_prediction = predict_current_regex(body)
        if not body.strip():
            return baseline_prediction
        return baseline_prediction.__class__(
            predictor_name="seed-logreg-hybrid",
            is_supported_transaction=baseline_prediction.is_supported_transaction,
            transaction_type=baseline_prediction.transaction_type,
            merchant=baseline_prediction.merchant,
            amount=baseline_prediction.amount,
            currency=baseline_prediction.currency,
            category=predict_category(self.model, body),
        )


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    normalized_dir = ml_root / "data" / "normalized"
    model_path = ml_root / "models" / "generated" / f"{MODEL_ID}.pkl"
    artifacts_dir = ml_root / "artifacts" / "benchmarks"

    records = []
    for split_name in ("train", "val"):
        records.extend(read_jsonl(normalized_dir / f"seed-{split_name}.jsonl"))

    report = evaluate_records(records, SeedLogregHybridPredictor(model_path))
    output_path = artifacts_dir / "seed-v1-logreg-hybrid.json"
    write_report(output_path, report)
    print(f"Wrote benchmark report to {output_path}")


if __name__ == "__main__":
    main()
