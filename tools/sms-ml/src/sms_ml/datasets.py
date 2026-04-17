from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal, cast

from sms_ml.categories import ExpenseCategory

TransactionType = Literal["debit", "credit"]
LabelStatus = Literal["missing", "labeled"]


@dataclass(frozen=True)
class NormalizedSmsRecord:
    record_id: str
    source_dataset: str
    source_split: str
    source_commit: str
    source_path: str
    source_index: int
    sms_text: str
    merchant: str | None
    amount: float | None
    currency: str | None
    transaction_date: str | None
    transaction_type: TransactionType | None
    is_transaction: bool
    bank: str | None
    target_category: ExpenseCategory | None
    target_category_status: LabelStatus
    baseline_category_seed: ExpenseCategory | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def write_jsonl(path: Path, records: list[NormalizedSmsRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = "\n".join(
        json.dumps(record.to_dict(), ensure_ascii=False) for record in records
    )
    path.write_text(f"{payload}\n" if payload else "", encoding="utf-8")


def read_jsonl(path: Path) -> list[NormalizedSmsRecord]:
    records: list[NormalizedSmsRecord] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        payload = json.loads(line)
        records.append(NormalizedSmsRecord(**payload))
    return records


def summarize_records(records: list[NormalizedSmsRecord]) -> dict[str, Any]:
    return {
        "recordCount": len(records),
        "debitCount": sum(record.transaction_type == "debit" for record in records),
        "creditCount": sum(record.transaction_type == "credit" for record in records),
        "labeledCategoryCount": sum(
            record.target_category is not None for record in records
        ),
        "baselineSeedCount": sum(
            record.baseline_category_seed is not None for record in records
        ),
    }


def load_reference_json(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Expected list payload in {path}")
    return cast(list[dict[str, Any]], payload)
