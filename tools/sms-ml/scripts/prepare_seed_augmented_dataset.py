from __future__ import annotations

from sms_ml.augmented_datasets import write_seed_augmented_dataset


def main() -> None:
    train_path, val_path, summary_path = write_seed_augmented_dataset(train_percent=90)
    print(f"Wrote normalized merged train split to {train_path}")
    print(f"Wrote normalized merged val split to {val_path}")
    print(f"Wrote dataset summary to {summary_path}")


if __name__ == "__main__":
    main()