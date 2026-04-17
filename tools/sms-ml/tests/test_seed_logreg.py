from sms_ml.datasets import NormalizedSmsRecord
from sms_ml.models.seed_logreg import evaluate_model, predict_category, train_model


def test_train_model_predicts_on_toy_examples() -> None:
    records = [
        NormalizedSmsRecord(
            record_id="1",
            source_dataset="sms_seed_v1",
            source_split="train",
            source_commit="cab99ec",
            source_path="seed-train.jsonl",
            source_index=1,
            sms_text="Rs. 100 spent at Zomato",
            merchant="Zomato",
            amount=100.0,
            currency="INR",
            transaction_date="2024-01-01",
            transaction_type="debit",
            is_transaction=True,
            bank="ICICI",
            target_category="Food",
            target_category_status="labeled",
            baseline_category_seed="Food",
        ),
        NormalizedSmsRecord(
            record_id="2",
            source_dataset="sms_seed_v1",
            source_split="train",
            source_commit="cab99ec",
            source_path="seed-train.jsonl",
            source_index=2,
            sms_text="Rs. 120 paid to Swiggy",
            merchant="Swiggy",
            amount=120.0,
            currency="INR",
            transaction_date="2024-01-01",
            transaction_type="debit",
            is_transaction=True,
            bank="ICICI",
            target_category="Food",
            target_category_status="labeled",
            baseline_category_seed="Food",
        ),
        NormalizedSmsRecord(
            record_id="3",
            source_dataset="sms_seed_v1",
            source_split="train",
            source_commit="cab99ec",
            source_path="seed-train.jsonl",
            source_index=3,
            sms_text="Rs. 80 paid to Uber",
            merchant="Uber",
            amount=80.0,
            currency="INR",
            transaction_date="2024-01-01",
            transaction_type="debit",
            is_transaction=True,
            bank="ICICI",
            target_category="Transport",
            target_category_status="labeled",
            baseline_category_seed="Transport",
        ),
        NormalizedSmsRecord(
            record_id="4",
            source_dataset="sms_seed_v1",
            source_split="train",
            source_commit="cab99ec",
            source_path="seed-train.jsonl",
            source_index=4,
            sms_text="Rs. 95 spent at Ola",
            merchant="Ola",
            amount=95.0,
            currency="INR",
            transaction_date="2024-01-01",
            transaction_type="debit",
            is_transaction=True,
            bank="ICICI",
            target_category="Transport",
            target_category_status="labeled",
            baseline_category_seed="Transport",
        ),
    ]

    model = train_model(records)

    assert predict_category(model, "Rs. 100 spent at Zomato") == "Food"
    metrics = evaluate_model(model, records)
    assert metrics["recordCount"] == 4
