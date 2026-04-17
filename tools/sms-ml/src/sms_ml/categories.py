from typing import Literal, TypeAlias

DEFAULT_EXPENSE_CATEGORIES = (
    "Food",
    "Transport",
    "Groceries",
    "Rent",
    "Utilities",
    "Entertainment",
    "Health",
    "Other",
)

ExpenseCategory: TypeAlias = Literal[
    "Food",
    "Transport",
    "Groceries",
    "Rent",
    "Utilities",
    "Entertainment",
    "Health",
    "Other",
]
