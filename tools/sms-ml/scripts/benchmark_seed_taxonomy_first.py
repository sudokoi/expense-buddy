from pathlib import Path

from sms_ml.baselines.taxonomy_first import predict_sms
from sms_ml.benchmarking import evaluate_records, write_report
from sms_ml.datasets import read_jsonl


class TaxonomyFirstPredictor:
    def predict_sms(self, body: str):
        return predict_sms(body)


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    normalized_dir = ml_root / "data" / "normalized"
    artifacts_dir = ml_root / "artifacts" / "benchmarks"

    records = []
    for split_name in ("train", "val"):
        records.extend(read_jsonl(normalized_dir / f"seed-{split_name}.jsonl"))

    report = evaluate_records(records, TaxonomyFirstPredictor())
    output_path = artifacts_dir / "seed-v1-taxonomy-first.json"
    write_report(output_path, report)
    print(f"Wrote benchmark report to {output_path}")


if __name__ == "__main__":
    main()
