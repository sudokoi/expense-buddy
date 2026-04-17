from __future__ import annotations

from sms_ml.baselines.current_regex import (
    CREDIT_ONLY_KEYWORDS,
    DEBIT_KEYWORDS,
    SmsPrediction,
    infer_merchant,
    parse_amount,
)
from sms_ml.category_mapping import suggest_category


def predict_sms(body: str) -> SmsPrediction:
    content = body.strip()
    if not content:
        return SmsPrediction("taxonomy-first", False, None, None, None, None, None)

    has_debit = DEBIT_KEYWORDS.search(content) is not None
    has_credit = CREDIT_ONLY_KEYWORDS.search(content) is not None
    merchant = infer_merchant(content)
    category, _ = suggest_category(merchant, content)

    transaction_type: str | None = None
    if has_credit and not has_debit:
        transaction_type = "credit"
    elif has_debit:
        transaction_type = "debit"

    if not has_debit or has_credit:
        return SmsPrediction(
            predictor_name="taxonomy-first",
            is_supported_transaction=False,
            transaction_type=transaction_type,
            merchant=merchant,
            amount=None,
            currency=None,
            category=category,
        )

    amount = parse_amount(content)
    return SmsPrediction(
        predictor_name="taxonomy-first",
        is_supported_transaction=amount is not None,
        transaction_type="debit",
        merchant=merchant,
        amount=amount,
        currency="INR" if amount is not None else None,
        category=category,
    )
