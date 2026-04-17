from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any, cast

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

from sms_ml.categories import DEFAULT_EXPENSE_CATEGORIES, ExpenseCategory
from sms_ml.datasets import NormalizedSmsRecord

MODEL_ID = "seed-logreg-v1"


def labeled_debit_records(
    records: list[NormalizedSmsRecord],
) -> list[NormalizedSmsRecord]:
    return [
        record
        for record in records
        if record.transaction_type == "debit" and record.target_category is not None
    ]


def build_feature_text(record: NormalizedSmsRecord) -> str:
    return record.sms_text.strip()


def create_pipeline() -> Any:
    return Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    lowercase=True,
                    ngram_range=(1, 2),
                    min_df=1,
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                LogisticRegression(
                    max_iter=2000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )


def train_model(records: list[NormalizedSmsRecord]) -> Any:
    labeled_records = labeled_debit_records(records)
    if len(labeled_records) < 2:
        raise ValueError("Need at least two labeled debit records to train a model")

    labels = {record.target_category for record in labeled_records}
    if len(labels) < 2:
        raise ValueError("Need at least two category labels to train a model")

    pipeline = create_pipeline()
    feature_texts = [build_feature_text(record) for record in labeled_records]
    targets = [
        cast(ExpenseCategory, record.target_category) for record in labeled_records
    ]
    pipeline.fit(feature_texts, targets)
    return pipeline


def predict_category(model: Any, sms_text: str) -> ExpenseCategory:
    prediction = model.predict([sms_text])[0]
    return cast(ExpenseCategory, prediction)


def evaluate_model(model: Any, records: list[NormalizedSmsRecord]) -> dict[str, object]:
    labeled_records = labeled_debit_records(records)
    if not labeled_records:
        raise ValueError("Need labeled debit records to evaluate a model")

    correct_predictions = 0
    per_category: dict[str, dict[str, int]] = {
        category: {"total": 0, "hits": 0} for category in DEFAULT_EXPENSE_CATEGORIES
    }
    sample_errors: list[dict[str, str]] = []

    for record in labeled_records:
        target = cast(ExpenseCategory, record.target_category)
        predicted = predict_category(model, record.sms_text)
        per_category[target]["total"] += 1
        if predicted == target:
            correct_predictions += 1
            per_category[target]["hits"] += 1
            continue
        if len(sample_errors) < 10:
            sample_errors.append(
                {
                    "recordId": record.record_id,
                    "targetCategory": target,
                    "predictedCategory": predicted,
                }
            )

    total = len(labeled_records)
    return {
        "recordCount": total,
        "accuracy": correct_predictions / total,
        "perCategory": per_category,
        "sampleErrors": sample_errors,
    }


def save_model(path: Path, model: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        pickle.dump(model, handle)


def load_model(path: Path) -> Any:
    with path.open("rb") as handle:
        return pickle.load(handle)


def write_training_metrics(
    path: Path,
    train_metrics: dict[str, object],
    val_metrics: dict[str, object],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "modelId": MODEL_ID,
        "approach": "tfidf-logistic-regression",
        "trainingScope": "labeled debit seed records",
        "warnings": [
            "The current seed labels are bootstrapped from heuristic rules.",
            "Use these metrics for tooling validation, not for product-level "
            "quality claims.",
        ],
        "train": train_metrics,
        "val": val_metrics,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
