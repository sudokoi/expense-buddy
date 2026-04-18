from __future__ import annotations

import numpy as np

from sms_ml.models.seed_litert_embed import (
    HASH_BUCKET_SIZE,
    MAX_SEQUENCE_LENGTH,
    encode_term_sequence,
    get_model_metadata,
)


def test_encode_term_sequence_is_deterministic_and_padded() -> None:
    first = encode_term_sequence("uber trip paid via credit card")
    second = encode_term_sequence("uber trip paid via credit card")

    np.testing.assert_array_equal(first, second)
    assert first.shape == (MAX_SEQUENCE_LENGTH,)
    assert first.dtype == np.int32
    assert np.count_nonzero(first) > 0
    assert np.max(first) <= HASH_BUCKET_SIZE


def test_encode_term_sequence_uses_zero_padding_for_short_inputs() -> None:
    sequence = encode_term_sequence("upi")

    assert sequence[0] > 0
    assert sequence[-1] == 0


def test_metadata_matches_embedding_contract() -> None:
    metadata = get_model_metadata()

    assert metadata.model_id == "seed-litert-embed-v1"
    assert metadata.hash_bucket_size == HASH_BUCKET_SIZE
    assert metadata.labels[-1] == "Other"