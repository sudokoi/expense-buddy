from pathlib import Path

from sms_ml.datasets import NormalizedSmsRecord, read_jsonl, write_jsonl
from sms_ml.labeling import apply_labels, suggest_label, write_label_queue


def test_suggest_label_uses_mapping_policy() -> None:
    assert suggest_label("Zomato", "debited at Zomato")[0] == "Food"
    assert suggest_label("Uber", "debited at Uber")[0] == "Transport"
    assert suggest_label("BigBasket", "debited at BigBasket")[0] == "Groceries"
    assert suggest_label("Netflix", "debited at Netflix")[0] == "Entertainment"
    assert suggest_label("Apollo", "debited at Apollo Pharmacy")[0] == "Health"
    assert suggest_label("Shell", "petrol payment at Shell")[0] == "Transport"
    assert suggest_label("MakeMyTrip", "flight ticket booking")[0] == "Transport"
    assert suggest_label("Unknown Merchant", "unclear payment")[0] == "Other"


def test_write_label_queue_includes_only_debit_records(tmp_path: Path) -> None:
    normalized_dir = tmp_path / "normalized"
    labels_dir = tmp_path / "labels"

    write_jsonl(
        normalized_dir / "seed-train.jsonl",
        [
            NormalizedSmsRecord(
                record_id="sms_seed_v1-train-0000",
                source_dataset="sms_seed_v1",
                source_split="train",
                source_commit="cab99ec",
                source_path="x",
                source_index=0,
                sms_text="debited at Zomato",
                merchant="Zomato",
                amount=10.0,
                currency="INR",
                transaction_date="2024-01-01",
                transaction_type="debit",
                is_transaction=True,
                bank="HDFC",
                target_category=None,
                target_category_status="missing",
                baseline_category_seed="Food",
            ),
            NormalizedSmsRecord(
                record_id="sms_seed_v1-train-0001",
                source_dataset="sms_seed_v1",
                source_split="train",
                source_commit="cab99ec",
                source_path="x",
                source_index=1,
                sms_text="credited at Zomato",
                merchant="Zomato",
                amount=10.0,
                currency="INR",
                transaction_date="2024-01-01",
                transaction_type="credit",
                is_transaction=True,
                bank="HDFC",
                target_category=None,
                target_category_status="missing",
                baseline_category_seed=None,
            ),
        ],
    )
    write_jsonl(normalized_dir / "seed-val.jsonl", [])

    queue_path = write_label_queue(normalized_dir, labels_dir)

    lines = queue_path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert "sms_seed_v1-train-0000" in lines[1]
    assert ",Food," in lines[1]


def test_apply_labels_updates_records(tmp_path: Path) -> None:
    normalized_dir = tmp_path / "normalized"
    labels_dir = tmp_path / "labels"
    labels_dir.mkdir(parents=True, exist_ok=True)

    write_jsonl(
        normalized_dir / "seed-train.jsonl",
        [
            NormalizedSmsRecord(
                record_id="sms_seed_v1-train-0000",
                source_dataset="sms_seed_v1",
                source_split="train",
                source_commit="cab99ec",
                source_path="x",
                source_index=0,
                sms_text="debited at Zomato",
                merchant="Zomato",
                amount=10.0,
                currency="INR",
                transaction_date="2024-01-01",
                transaction_type="debit",
                is_transaction=True,
                bank="HDFC",
                target_category=None,
                target_category_status="missing",
                baseline_category_seed="Food",
            )
        ],
    )
    write_jsonl(normalized_dir / "seed-val.jsonl", [])
    (normalized_dir / "seed-summary.json").write_text(
        '{"sourceDataset":"sms_seed_v1","splits":{},"notes":[]}',
        encoding="utf-8",
    )
    (labels_dir / "seed-label-queue.csv").write_text(
        (
            "record_id,source_split,transaction_type,merchant,amount,currency,"
            "transaction_date,bank,baseline_category_seed,target_category,notes,"
            "sms_text\n"
            "sms_seed_v1-train-0000,train,debit,Zomato,10.0,INR,2024-01-01,"
            "HDFC,Food,Food,,debited at Zomato\n"
        ),
        encoding="utf-8",
    )

    apply_labels(normalized_dir, labels_dir / "seed-label-queue.csv")

    updated = read_jsonl(normalized_dir / "seed-train.jsonl")
    assert updated[0].target_category == "Food"
    assert updated[0].target_category_status == "labeled"
