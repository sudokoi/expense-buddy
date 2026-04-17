from __future__ import annotations

import csv
import json
from dataclasses import replace
from pathlib import Path
from typing import cast

from sms_ml.categories import DEFAULT_EXPENSE_CATEGORIES, ExpenseCategory
from sms_ml.category_mapping import suggest_category
from sms_ml.datasets import (
    NormalizedSmsRecord,
    read_jsonl,
    summarize_records,
    write_jsonl,
)

LABEL_QUEUE_HEADERS = [
    "record_id",
    "source_split",
    "transaction_type",
    "merchant",
    "amount",
    "currency",
    "transaction_date",
    "bank",
    "baseline_category_seed",
    "target_category",
    "notes",
    "sms_text",
]


def suggest_label(merchant: str, sms_text: str) -> tuple[ExpenseCategory, str]:
    return suggest_category(merchant, sms_text)


def write_label_queue(normalized_dir: Path, labels_dir: Path) -> Path:
    labels_dir.mkdir(parents=True, exist_ok=True)
    queue_path = labels_dir / "seed-label-queue.csv"

    rows: list[dict[str, str]] = []
    for split_name in ("train", "val"):
        for record in read_jsonl(normalized_dir / f"seed-{split_name}.jsonl"):
            if record.transaction_type != "debit":
                continue
            suggested_category, suggested_note = suggest_label(
                record.merchant or "",
                record.sms_text,
            )
            rows.append(
                {
                    "record_id": record.record_id,
                    "source_split": record.source_split,
                    "transaction_type": record.transaction_type or "",
                    "merchant": record.merchant or "",
                    "amount": "" if record.amount is None else str(record.amount),
                    "currency": record.currency or "",
                    "transaction_date": record.transaction_date or "",
                    "bank": record.bank or "",
                    "baseline_category_seed": record.baseline_category_seed or "",
                    "target_category": record.target_category or suggested_category,
                    "notes": suggested_note,
                    "sms_text": record.sms_text,
                }
            )

    with queue_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=LABEL_QUEUE_HEADERS)
        writer.writeheader()
        writer.writerows(rows)

    return queue_path


def apply_labels(normalized_dir: Path, labels_csv_path: Path) -> Path:
    with labels_csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        label_rows = [row for row in reader if row.get("target_category", "").strip()]

    valid_categories = set(DEFAULT_EXPENSE_CATEGORIES)
    labels_by_id: dict[str, str] = {}
    for row in label_rows:
        record_id = row["record_id"].strip()
        category = row["target_category"].strip()
        if category not in valid_categories:
            raise ValueError(f"Invalid category '{category}' for record {record_id}")
        labels_by_id[record_id] = category

    summary_splits: dict[str, object] = {}
    for split_name in ("train", "val"):
        records = read_jsonl(normalized_dir / f"seed-{split_name}.jsonl")
        updated_records: list[NormalizedSmsRecord] = []
        for record in records:
            category = labels_by_id.get(record.record_id)
            if category is None:
                updated_records.append(record)
                continue
            typed_category = cast(ExpenseCategory, category)
            updated_records.append(
                replace(
                    record,
                    target_category=typed_category,
                    target_category_status="labeled",
                )
            )
        write_jsonl(normalized_dir / f"seed-{split_name}.jsonl", updated_records)
        summary_splits[split_name] = summarize_records(updated_records)

    summary_path = normalized_dir / "seed-summary.json"
    existing_summary = json.loads(summary_path.read_text(encoding="utf-8"))
    existing_summary["splits"] = summary_splits
    existing_summary["notes"] = [
        "The seed dataset started without true expense-category labels.",
        "target_category becomes labeled only after manual review in "
        "seed-label-queue.csv.",
        "baseline_category_seed comes from the current regex heuristic and is "
        "not ground truth.",
    ]
    summary_path.write_text(json.dumps(existing_summary, indent=2), encoding="utf-8")
    return summary_path
