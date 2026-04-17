from sms_ml.baselines.current_regex import predict_sms
from sms_ml.benchmarking import evaluate_records
from sms_ml.datasets import NormalizedSmsRecord


class CurrentRegexPredictor:
    def predict_sms(self, body: str):
        return predict_sms(body)


def test_evaluate_records_counts_matches() -> None:
    records = [
        NormalizedSmsRecord(
            record_id="a",
            source_dataset="sms_seed_v1",
            source_split="train",
            source_commit="cab99ec",
            source_path="ml/data/processed/train.json",
            source_index=0,
            sms_text=(
                "Rs. 47231.71 debited from A/c **6325 on 24-04-2024 at Zomato. "
                "Avl Bal: Rs. 86483.27."
            ),
            merchant="Zomato",
            amount=47231.71,
            currency="INR",
            transaction_date="24-04-2024",
            transaction_type="debit",
            is_transaction=True,
            bank="ICICI",
            target_category=None,
            target_category_status="missing",
            baseline_category_seed="Food",
        ),
        NormalizedSmsRecord(
            record_id="b",
            source_dataset="sms_seed_v1",
            source_split="train",
            source_commit="cab99ec",
            source_path="ml/data/processed/train.json",
            source_index=1,
            sms_text=(
                "$8149.73 credited at Paytm on 09/03/2024. Card ending in 2429. "
                "Balance: $26071.3."
            ),
            merchant="Paytm",
            amount=8149.73,
            currency="USD",
            transaction_date="09/03/2024",
            transaction_type="credit",
            is_transaction=True,
            bank="HDFC",
            target_category=None,
            target_category_status="missing",
            baseline_category_seed=None,
        ),
    ]

    report = evaluate_records(records, CurrentRegexPredictor())

    assert report.total_records == 2
    assert report.debit_records == 1
    assert report.credit_records == 1
    assert report.supported_predictions == 1
    assert report.transaction_type_hits == 2
    assert report.merchant_hits == 0
    assert report.amount_hits == 1
    assert report.currency_hits == 1
