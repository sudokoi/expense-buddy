from __future__ import annotations

import re
from dataclasses import dataclass

from sms_ml.categories import DEFAULT_EXPENSE_CATEGORIES, ExpenseCategory


@dataclass(frozen=True)
class SmsPrediction:
    predictor_name: str
    is_supported_transaction: bool
    transaction_type: str | None
    merchant: str | None
    amount: float | None
    currency: str | None
    category: ExpenseCategory | None


AMOUNT_PATTERN = re.compile(
    r"(?:INR|RS\.?|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)",
    re.I,
)
DEBIT_KEYWORDS = re.compile(
    r"debited|spent|withdrawn|paid|purchase|txn|transaction|upi",
    re.I,
)
CREDIT_ONLY_KEYWORDS = re.compile(r"credited|received", re.I)
MERCHANT_PATTERN = re.compile(
    r"\b(?:at|to|merchant)\s+([A-Za-z0-9&._\-/ ]{2,40})",
    re.I,
)
OTHER_CATEGORY = "Other"

CATEGORY_RULES: list[tuple[ExpenseCategory, re.Pattern[str]]] = [
    (
        "Food",
        re.compile(
            r"swiggy|zomato|restaurant|restro|cafe|coffee|pizza|burger|biryani|dining|eatery|bakery|food",
            re.I,
        ),
    ),
    (
        "Transport",
        re.compile(
            r"uber|ola|rapido|metro|rail|train|irctc|bus|cab|taxi|petrol|diesel|fuel|parking|toll|travel",
            re.I,
        ),
    ),
    (
        "Groceries",
        re.compile(
            r"grocery|groceries|supermarket|hypermarket|bigbasket|blinkit|"
            r"zepto|instamart|fresh|dmart|reliance fresh",
            re.I,
        ),
    ),
    (
        "Rent",
        re.compile(r"\brent\b|landlord|lease|tenancy|apartment rent|house rent", re.I),
    ),
    (
        "Utilities",
        re.compile(
            r"electricity|water bill|utility bill|gas bill|broadband|wifi|"
            r"internet bill|mobile bill|recharge|airtel|jio|vi\b|bsnl",
            re.I,
        ),
    ),
    (
        "Entertainment",
        re.compile(
            r"netflix|spotify|prime video|hotstar|bookmyshow|movie|cinema|"
            r"theatre|gaming|playstation|xbox",
            re.I,
        ),
    ),
    (
        "Health",
        re.compile(
            r"hospital|clinic|pharmacy|medical|medicine|diagnostic|lab|apollo|practo|medplus|health",
            re.I,
        ),
    ),
]


def parse_amount(body: str) -> float | None:
    match = AMOUNT_PATTERN.search(body)
    if not match:
        return None
    return float(match.group(1).replace(",", ""))


def infer_merchant(body: str) -> str | None:
    match = MERCHANT_PATTERN.search(body)
    if not match:
        return None
    return re.sub(r"\s+", " ", match.group(1)).strip()


def infer_category(body: str, merchant: str | None) -> ExpenseCategory:
    normalized_content = f"{merchant or ''} {body}".strip().lower()
    if not normalized_content:
        return OTHER_CATEGORY
    for category, pattern in CATEGORY_RULES:
        if pattern.search(normalized_content):
            return category
    if OTHER_CATEGORY in DEFAULT_EXPENSE_CATEGORIES:
        return OTHER_CATEGORY
    return DEFAULT_EXPENSE_CATEGORIES[0]


def predict_sms(body: str) -> SmsPrediction:
    content = body.strip()
    if not content:
        return SmsPrediction("current-regex", False, None, None, None, None, None)

    has_debit = DEBIT_KEYWORDS.search(content) is not None
    has_credit = CREDIT_ONLY_KEYWORDS.search(content) is not None
    merchant = infer_merchant(content)
    category = infer_category(content, merchant)

    transaction_type: str | None = None
    if has_credit and not has_debit:
        transaction_type = "credit"
    elif has_debit:
        transaction_type = "debit"

    if not has_debit or has_credit:
        return SmsPrediction(
            predictor_name="current-regex",
            is_supported_transaction=False,
            transaction_type=transaction_type,
            merchant=merchant,
            amount=None,
            currency=None,
            category=category,
        )

    amount = parse_amount(content)
    return SmsPrediction(
        predictor_name="current-regex",
        is_supported_transaction=amount is not None,
        transaction_type="debit",
        merchant=merchant,
        amount=amount,
        currency="INR" if amount is not None else None,
        category=category,
    )
