from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from pathlib import Path

from sms_ml.datasets import (
    NormalizedSmsRecord,
    read_jsonl,
    summarize_records,
    write_jsonl,
)

ADDITIONAL_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "additional"
NORMALIZED_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "normalized"
AUGMENTED_DATASET_NAME = "seed_augmented_v1"
AUGMENTED_TRAIN_PATH = NORMALIZED_DATA_DIR / "seed-augmented-train.jsonl"
AUGMENTED_VAL_PATH = NORMALIZED_DATA_DIR / "seed-augmented-val.jsonl"
AUGMENTED_SUMMARY_PATH = NORMALIZED_DATA_DIR / "seed-augmented-summary.json"


def build_augmented_output_paths(
    normalized_dir: Path = NORMALIZED_DATA_DIR,
) -> tuple[Path, Path, Path]:
    return (
        normalized_dir / AUGMENTED_TRAIN_PATH.name,
        normalized_dir / AUGMENTED_VAL_PATH.name,
        normalized_dir / AUGMENTED_SUMMARY_PATH.name,
    )


def list_additional_jsonl_files(
    additional_dir: Path = ADDITIONAL_DATA_DIR,
) -> list[Path]:
    if not additional_dir.exists():
        return []
    return sorted(path for path in additional_dir.glob("*.jsonl"))


def record_identity(record: NormalizedSmsRecord) -> str:
    return "\0".join(
        [
            record.sms_text.strip(),
            record.bank or "",
            record.merchant or "",
            str(record.amount),
            record.currency or "",
            record.transaction_type or "",
            str(record.is_transaction),
            record.target_category or "",
        ]
    )


def dedupe_records(records: list[NormalizedSmsRecord]) -> list[NormalizedSmsRecord]:
    unique_by_identity: dict[str, NormalizedSmsRecord] = {}
    for record in records:
        unique_by_identity.setdefault(record_identity(record), record)
    return list(unique_by_identity.values())


def load_additional_records(
    additional_dir: Path = ADDITIONAL_DATA_DIR,
) -> list[NormalizedSmsRecord]:
    records: list[NormalizedSmsRecord] = []
    for path in list_additional_jsonl_files(additional_dir):
        records.extend(read_jsonl(path))
    return dedupe_records(records)


def load_seed_records(
    normalized_dir: Path = NORMALIZED_DATA_DIR,
) -> list[NormalizedSmsRecord]:
    records: list[NormalizedSmsRecord] = []
    for split_name in ("train", "val"):
        records.extend(read_jsonl(normalized_dir / f"seed-{split_name}.jsonl"))
    return dedupe_records(records)


def split_augmented_records(
    records: list[NormalizedSmsRecord], train_percent: int = 90
) -> tuple[list[NormalizedSmsRecord], list[NormalizedSmsRecord]]:
    if train_percent <= 0 or train_percent >= 100:
        raise ValueError("train_percent must be between 1 and 99")

    train_records: list[NormalizedSmsRecord] = []
    val_records: list[NormalizedSmsRecord] = []
    for record in records:
        digest = hashlib.sha256(record_identity(record).encode("utf-8")).digest()
        bucket = digest[0]
        if bucket < round(256 * train_percent / 100):
            train_records.append(record)
        else:
            val_records.append(record)

    if not train_records or not val_records:
        raise ValueError(
            "Augmented record split must produce non-empty train and val sets"
        )

    return train_records, val_records


def assign_split_metadata(
    records: list[NormalizedSmsRecord], split_name: str
) -> list[NormalizedSmsRecord]:
    return [
        replace(
            record,
            source_split=split_name,
            source_index=index,
            source_path=f"normalized/{AUGMENTED_DATASET_NAME}/{split_name}.jsonl",
        )
        for index, record in enumerate(records)
    ]


def prepare_seed_augmented_dataset(
    train_percent: int = 90,
    normalized_dir: Path = NORMALIZED_DATA_DIR,
    additional_dir: Path = ADDITIONAL_DATA_DIR,
) -> tuple[list[NormalizedSmsRecord], list[NormalizedSmsRecord], dict[str, object]]:
    seed_records = load_seed_records(normalized_dir)
    additional_records = load_additional_records(additional_dir)
    combined_records = dedupe_records(seed_records + additional_records)
    train_records, val_records = split_augmented_records(
        combined_records,
        train_percent=train_percent,
    )
    normalized_train_records = assign_split_metadata(train_records, "train")
    normalized_val_records = assign_split_metadata(val_records, "val")

    summary: dict[str, object] = {
        "dataset": AUGMENTED_DATASET_NAME,
        "trainPercent": train_percent,
        "sourceCounts": {
            "seedRecords": len(seed_records),
            "additionalRecords": len(additional_records),
            "combinedDedupedRecords": len(combined_records),
        },
        "splits": {
            "train": summarize_records(normalized_train_records),
            "val": summarize_records(normalized_val_records),
        },
    }
    return normalized_train_records, normalized_val_records, summary


def write_seed_augmented_dataset(
    train_percent: int = 90,
    normalized_dir: Path = NORMALIZED_DATA_DIR,
    additional_dir: Path = ADDITIONAL_DATA_DIR,
) -> tuple[Path, Path, Path]:
    train_records, val_records, summary = prepare_seed_augmented_dataset(
        train_percent=train_percent,
        normalized_dir=normalized_dir,
        additional_dir=additional_dir,
    )
    normalized_dir.mkdir(parents=True, exist_ok=True)
    train_path, val_path, summary_path = build_augmented_output_paths(normalized_dir)
    write_jsonl(train_path, train_records)
    write_jsonl(val_path, val_records)
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return train_path, val_path, summary_path