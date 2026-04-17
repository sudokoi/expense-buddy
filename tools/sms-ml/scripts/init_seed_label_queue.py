from pathlib import Path

from sms_ml.labeling import write_label_queue


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    queue_path = write_label_queue(
        ml_root / "data" / "normalized",
        ml_root / "data" / "labels",
    )
    print(f"Wrote label queue to {queue_path}")


if __name__ == "__main__":
    main()
