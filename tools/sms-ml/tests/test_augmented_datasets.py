from __future__ import annotations

from pathlib import Path

from sms_ml.augmented_datasets import (
    AUGMENTED_DATASET_NAME,
    assign_split_metadata,
    build_augmented_output_paths,
    dedupe_records,
    split_augmented_records,
    write_seed_augmented_dataset,
)
from sms_ml.datasets import NormalizedSmsRecord, write_jsonl


def create_record(record_id: str, sms_text: str) -> NormalizedSmsRecord:
    return NormalizedSmsRecord(
        record_id=record_id,
        source_dataset="augmented-test",
        source_split="train",
        source_commit="test",
        source_path="additional/test.jsonl",
        source_index=0,
        sms_text=sms_text,
        merchant="Uber",
        amount=123.0,
        currency="INR",
        transaction_date="2026-04-18T10:00:00.000Z",
        transaction_type="debit",
        is_transaction=True,
        bank="HDFC",
        target_category="Transport",
        target_category_status="labeled",
        baseline_category_seed="Transport",
    )


def test_dedupe_records_removes_exact_duplicates() -> None:
    first = create_record("one", "Paid to Uber")
    duplicate = create_record("two", "Paid to Uber")
    unique = create_record("three", "Paid to Ola")

    deduped = dedupe_records([first, duplicate, unique])

    assert len(deduped) == 2


def test_split_augmented_records_is_deterministic_and_non_empty() -> None:
    records = [
        create_record(str(index), f"Paid to merchant {index}")
        for index in range(20)
    ]

    first_train, first_val = split_augmented_records(records, train_percent=90)
    second_train, second_val = split_augmented_records(records, train_percent=90)

    assert [record.sms_text for record in first_train] == [
        record.sms_text for record in second_train
    ]
    assert [record.sms_text for record in first_val] == [
        record.sms_text for record in second_val
    ]
    assert first_train
    assert first_val


def test_assign_split_metadata_updates_split_fields() -> None:
    records = [create_record("one", "Paid to Uber")]

    normalized = assign_split_metadata(records, "val")

    assert normalized[0].source_split == "val"
    assert normalized[0].source_index == 0
    assert (
        normalized[0].source_path
        == f"normalized/{AUGMENTED_DATASET_NAME}/val.jsonl"
    )


def test_write_seed_augmented_dataset_respects_normalized_dir(tmp_path: Path) -> None:
    normalized_dir = tmp_path / "normalized"
    additional_dir = tmp_path / "additional"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    additional_dir.mkdir(parents=True, exist_ok=True)

    seed_train_records = [
        create_record(f"seed-train-{index}", f"Train merchant {index}")
        for index in range(16)
    ]
    seed_val_records = [
        create_record(f"seed-val-{index}", f"Val merchant {index}")
        for index in range(16)
    ]
    additional_records = [
        create_record(f"additional-{index}", f"Additional merchant {index}")
        for index in range(8)
    ]

    write_jsonl(normalized_dir / "seed-train.jsonl", seed_train_records)
    write_jsonl(normalized_dir / "seed-val.jsonl", seed_val_records)
    write_jsonl(additional_dir / "extra.jsonl", additional_records)

    train_path, val_path, summary_path = write_seed_augmented_dataset(
        train_percent=90,
        normalized_dir=normalized_dir,
        additional_dir=additional_dir,
    )

    expected_train_path, expected_val_path, expected_summary_path = (
        build_augmented_output_paths(normalized_dir)
    )

    assert train_path == expected_train_path
    assert val_path == expected_val_path
    assert summary_path == expected_summary_path
    assert train_path.exists()
    assert val_path.exists()
    assert summary_path.exists()