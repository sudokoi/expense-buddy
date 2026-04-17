from pathlib import Path

from sms_ml.seed_dataset import write_normalized_seed_dataset


def main() -> None:
    ml_root = Path(__file__).resolve().parents[1]
    output_dir = write_normalized_seed_dataset(ml_root)
    print(f"Wrote normalized seed data to {output_dir}")


if __name__ == "__main__":
    main()
