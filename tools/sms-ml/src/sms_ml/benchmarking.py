from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Protocol

from sms_ml.baselines.current_regex import SmsPrediction
from sms_ml.datasets import NormalizedSmsRecord


class Predictor(Protocol):
    def predict_sms(self, body: str) -> SmsPrediction: ...


@dataclass(frozen=True)
class BenchmarkReport:
    predictor_name: str
    total_records: int
    debit_records: int
    credit_records: int
    supported_predictions: int
    transaction_type_hits: int
    merchant_hits: int
    amount_hits: int
    currency_hits: int
    labeled_category_records: int
    category_hits: int

    def to_dict(self) -> dict[str, object]:
        total = self.total_records or 1
        labeled_total = self.labeled_category_records or 1
        payload = asdict(self)
        payload["metrics"] = {
            "supportRate": self.supported_predictions / total,
            "transactionTypeAccuracy": self.transaction_type_hits / total,
            "merchantAccuracy": self.merchant_hits / total,
            "amountAccuracy": self.amount_hits / total,
            "currencyAccuracy": self.currency_hits / total,
            "categoryAccuracy": (
                None
                if self.labeled_category_records == 0
                else self.category_hits / labeled_total
            ),
        }
        return payload


def evaluate_records(
    records: list[NormalizedSmsRecord], predictor: Predictor
) -> BenchmarkReport:
    if not records:
        raise ValueError("Cannot benchmark an empty record set")

    first_prediction = predictor.predict_sms(records[0].sms_text)
    supported_predictions = 0
    transaction_type_hits = 0
    merchant_hits = 0
    amount_hits = 0
    currency_hits = 0
    labeled_category_records = 0
    category_hits = 0
    debit_records = 0
    credit_records = 0

    for record in records:
        prediction = predictor.predict_sms(record.sms_text)
        if record.transaction_type == "debit":
            debit_records += 1
        if record.transaction_type == "credit":
            credit_records += 1
        if prediction.is_supported_transaction:
            supported_predictions += 1
        if prediction.transaction_type == record.transaction_type:
            transaction_type_hits += 1
        if prediction.merchant == record.merchant:
            merchant_hits += 1
        if prediction.amount == record.amount:
            amount_hits += 1
        if prediction.currency == record.currency:
            currency_hits += 1
        if record.target_category is not None:
            labeled_category_records += 1
            if prediction.category == record.target_category:
                category_hits += 1

    return BenchmarkReport(
        predictor_name=first_prediction.predictor_name,
        total_records=len(records),
        debit_records=debit_records,
        credit_records=credit_records,
        supported_predictions=supported_predictions,
        transaction_type_hits=transaction_type_hits,
        merchant_hits=merchant_hits,
        amount_hits=amount_hits,
        currency_hits=currency_hits,
        labeled_category_records=labeled_category_records,
        category_hits=category_hits,
    )


def write_report(path: Path, report: BenchmarkReport) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
