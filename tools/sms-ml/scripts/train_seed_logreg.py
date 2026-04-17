from pathlib import Path

from sms_ml.datasets import read_jsonl
from sms_ml.models.seed_logreg import (
    MODEL_ID,
    evaluate_model,
    save_model,
    train_model,
    write_training_metrics,
)


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    normalized_dir = ml_root / "data" / "normalized"

    train_records = read_jsonl(normalized_dir / "seed-train.jsonl")
    val_records = read_jsonl(normalized_dir / "seed-val.jsonl")

    model = train_model(train_records)
    train_metrics = evaluate_model(model, train_records)
    val_metrics = evaluate_model(model, val_records)

    save_model(ml_root / "models" / "generated" / f"{MODEL_ID}.pkl", model)
    write_training_metrics(
        ml_root / "artifacts" / "training" / f"{MODEL_ID}-metrics.json",
        train_metrics,
        val_metrics,
    )

    print(f"Trained {MODEL_ID}")
    print(f"Train accuracy: {train_metrics['accuracy']:.4f}")
    print(f"Validation accuracy: {val_metrics['accuracy']:.4f}")


if __name__ == "__main__":
    main()
