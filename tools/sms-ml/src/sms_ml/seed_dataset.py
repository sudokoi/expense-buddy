from __future__ import annotations

import json
from collections.abc import Mapping
from pathlib import Path
from typing import cast

from sms_ml.baselines.current_regex import predict_sms
from sms_ml.datasets import (
    NormalizedSmsRecord,
    TransactionType,
    load_reference_json,
    summarize_records,
    write_jsonl,
)

DATASET_NAME = "sms_seed_v1"
SOURCE_COMMIT = "cab99ec"
SOURCE_FILES = {
    "train": "ml/data/processed/train.json",
    "val": "ml/data/processed/val.json",
}


def normalize_record(
    raw: Mapping[str, object], split_name: str, index: int
) -> NormalizedSmsRecord:
    sms_text = str(raw["sms"])
    baseline_prediction = predict_sms(sms_text)
    raw_transaction_type = str(raw["type"]).lower()
    transaction_type: TransactionType | None = None
    if raw_transaction_type in {"debit", "credit"}:
        transaction_type = cast(TransactionType, raw_transaction_type)

    baseline_seed = (
        baseline_prediction.category
        if transaction_type == "debit" and baseline_prediction.category is not None
        else None
    )

    amount_value = raw["amount"]
    if not isinstance(amount_value, (float, int, str)):
        raise TypeError("Seed dataset amount must be float, int, or string")

    return NormalizedSmsRecord(
        record_id=f"{DATASET_NAME}-{split_name}-{index:04d}",
        source_dataset=DATASET_NAME,
        source_split=split_name,
        source_commit=SOURCE_COMMIT,
        source_path=SOURCE_FILES[split_name],
        source_index=index,
        sms_text=sms_text,
        merchant=str(raw["merchant"]),
        amount=float(amount_value),
        currency=str(raw["currency"]),
        transaction_date=str(raw["date"]),
        transaction_type=transaction_type,
        is_transaction=True,
        bank=str(raw["bank"]),
        target_category=None,
        target_category_status="missing",
        baseline_category_seed=baseline_seed,
    )


def write_normalized_seed_dataset(ml_root: Path) -> Path:
    reference_dir = ml_root / "data" / "reference"
    normalized_dir = ml_root / "data" / "normalized"
    normalized_dir.mkdir(parents=True, exist_ok=True)

    summary_splits: dict[str, object] = {}
    summary: dict[str, object] = {
        "sourceDataset": DATASET_NAME,
        "sourceCommit": SOURCE_COMMIT,
        "splits": summary_splits,
        "notes": [
            "The seed dataset does not contain true expense-category labels.",
            "target_category remains null until manual labeling is added.",
            "baseline_category_seed comes from the current regex heuristic and is "
            "not ground truth.",
        ],
    }

    for split_name in ("train", "val"):
        raw_records = load_reference_json(reference_dir / f"seed-{split_name}.json")
        normalized_records = [
            normalize_record(raw_record, split_name, index)
            for index, raw_record in enumerate(raw_records)
        ]
        write_jsonl(normalized_dir / f"seed-{split_name}.jsonl", normalized_records)
        summary_splits[split_name] = summarize_records(normalized_records)

    summary_path = normalized_dir / "seed-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return normalized_dir
