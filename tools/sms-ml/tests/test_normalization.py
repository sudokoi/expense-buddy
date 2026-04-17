from sms_ml.datasets import NormalizedSmsRecord
from sms_ml.seed_dataset import normalize_record


def test_normalize_record_sets_expected_fields() -> None:
    raw = {
        "sms": (
            "Rs. 47231.71 debited from A/c **6325 on 24-04-2024 at Zomato. "
            "Avl Bal: Rs. 86483.27."
        ),
        "merchant": "Zomato",
        "amount": 47231.71,
        "currency": "INR",
        "date": "24-04-2024",
        "type": "debit",
        "bank": "ICICI",
    }

    record = normalize_record(raw, "train", 1)

    assert isinstance(record, NormalizedSmsRecord)
    assert record.record_id == "sms_seed_v1-train-0001"
    assert record.transaction_type == "debit"
    assert record.target_category is None
    assert record.target_category_status == "missing"
    assert record.baseline_category_seed == "Food"
