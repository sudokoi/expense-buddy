from __future__ import annotations

from sms_ml.categories import ExpenseCategory

FOOD_HINTS = (
    "zomato",
    "swiggy",
    "kfc",
    "mcdonald",
    "domino",
    "pizza hut",
    "starbucks",
    "restaurant",
    "cafe",
    "coffee",
    "food order",
)

TRANSPORT_HINTS = (
    "uber",
    "ola",
    "rapido",
    "metro",
    "train",
    "rail",
    "irctc",
    "bus",
    "taxi",
    "cab",
)

GROCERY_HINTS = (
    "zepto",
    "instamart",
    "blinkit",
    "bigbasket",
    "grofers",
    "grocery",
    "groceries",
    "supermarket",
    "dmart",
)

ENTERTAINMENT_HINTS = (
    "netflix",
    "bookmyshow",
    "spotify",
    "prime video",
    "hotstar",
    "cinema",
    "movie",
)

UTILITY_HINTS = (
    "electricity bill",
    "electricity",
    "power bill",
    "water bill",
    "gas bill",
    "internet bill",
    "wifi",
    "broadband",
)

HEALTH_HINTS = (
    "apollo",
    "medicine",
    "medicines",
    "medical",
    "pharmacy",
    "hospital",
    "clinic",
    "health",
)

FUEL_HINTS = (
    "petroleum",
    "petrol",
    "diesel",
    "fuel",
    "hp",
    "bp",
    "shell",
    "chevron",
    "exxon",
)

TRAVEL_HINTS = (
    "makemytrip",
    "airline",
    "flight",
    "train ticket",
    "bus ticket",
    "redbus",
    "indigo",
    "air india",
    "spicejet",
    "vistara",
)


def suggest_category(
    merchant: str | None,
    sms_text: str,
) -> tuple[ExpenseCategory, str]:
    normalized = f"{merchant or ''} {sms_text}".lower()

    if any(hint in normalized for hint in FOOD_HINTS):
        return "Food", "Suggested from food-related merchant or message text."

    if any(hint in normalized for hint in GROCERY_HINTS):
        return "Groceries", "Suggested from grocery-related merchant or message text."

    if any(hint in normalized for hint in ENTERTAINMENT_HINTS):
        return (
            "Entertainment",
            "Suggested from entertainment-related merchant or message text.",
        )

    if any(hint in normalized for hint in UTILITY_HINTS):
        return "Utilities", "Suggested from utility-related bill or message text."

    if any(hint in normalized for hint in HEALTH_HINTS):
        return "Health", "Suggested from health-related merchant or message text."

    if any(hint in normalized for hint in FUEL_HINTS):
        return (
            "Transport",
            "Suggested from fuel-related merchant or message text; collapsed "
            "to Transport because Fuel is not in the shipped taxonomy.",
        )

    if any(hint in normalized for hint in TRAVEL_HINTS):
        return (
            "Transport",
            "Suggested from travel-ticket merchant or message text; "
            "collapsed to Transport because Travel is not in the shipped taxonomy.",
        )

    if any(hint in normalized for hint in TRANSPORT_HINTS):
        return (
            "Transport",
            "Suggested from transport-related merchant or message text.",
        )

    return "Other", "Defaulted to Other because the label was not certain."
