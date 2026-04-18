from __future__ import annotations

from sms_ml.models.seed_litert_attention import (
    ATTENTION_UNITS,
    DENSE_UNITS,
    LSTM_UNITS,
    get_model_metadata,
)


def test_attention_metadata_matches_contract() -> None:
    metadata = get_model_metadata()

    assert metadata.model_id == "seed-litert-attention-v1"
    assert metadata.lstm_units == LSTM_UNITS
    assert metadata.attention_units == ATTENTION_UNITS
    assert metadata.dense_units == DENSE_UNITS
    assert metadata.labels[-1] == "Other"