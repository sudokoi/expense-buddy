from pathlib import Path

from sms_ml.labeling import apply_labels


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    summary_path = apply_labels(
        ml_root / "data" / "normalized",
        ml_root / "data" / "labels" / "seed-label-queue.csv",
    )
    print(f"Updated normalized summary at {summary_path}")


if __name__ == "__main__":
    main()
