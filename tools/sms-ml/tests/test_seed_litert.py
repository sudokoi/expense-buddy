from __future__ import annotations

import numpy as np

from sms_ml.models.seed_litert import (
    FEATURE_DIMENSION,
    build_feature_text,
    get_model_metadata,
    tokenize_text,
    vectorize_text,
)


def test_tokenize_text_normalizes_and_limits_tokens() -> None:
    assert tokenize_text("Swiggy paid via UPI on 11/04/2026") == [
        "swiggy",
        "paid",
        "via",
        "upi",
        "on",
        "11",
        "04",
        "2026",
    ]


def test_vectorize_text_is_deterministic_and_normalized() -> None:
    first = vectorize_text("uber trip paid via credit card")
    second = vectorize_text("uber trip paid via credit card")

    np.testing.assert_allclose(first, second)
    assert first.shape == (FEATURE_DIMENSION,)
    assert np.isclose(np.linalg.norm(first), 1.0)


def test_metadata_matches_current_contract() -> None:
    metadata = get_model_metadata()

    assert metadata.model_id == "seed-litert-v1"
    assert metadata.feature_dimension == FEATURE_DIMENSION
    assert metadata.labels[-1] == "Other"


def test_build_feature_text_joins_bank_merchant_and_body() -> None:
    from sms_ml.datasets import NormalizedSmsRecord

    record = NormalizedSmsRecord(
        record_id="seed-1",
        source_dataset="seed",
        source_split="train",
        source_commit="abc123",
        source_path="seed.json",
        source_index=0,
        sms_text="INR 250 paid to Uber",
        merchant="Uber",
        amount=250.0,
        currency="INR",
        transaction_date="2026-04-11T10:15:30.000Z",
        transaction_type="debit",
        is_transaction=True,
        bank="HDFC",
        target_category="Transport",
        target_category_status="labeled",
        baseline_category_seed="Transport",
    )

    assert build_feature_text(record) == "HDFC Uber INR 250 paid to Uber"
