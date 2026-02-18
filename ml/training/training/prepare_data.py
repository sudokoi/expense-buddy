#!/usr/bin/env python3
"""
Prepare training data for SMS parser.
Combines real samples with synthetic data augmentation.
"""

import json
import random
import os
from pathlib import Path
from typing import List, Dict

# Template SMS patterns for different banks/regions
SMS_TEMPLATES = {
    "indian": [
        "Rs. {amount} {type} from A/c {account} on {date} at {merchant}. Avl Bal: Rs. {balance}.",
        "{type} of Rs. {amount} made at {merchant} on {date}. Card ending {card}. Avl Bal: Rs. {balance}.",
        "Your A/c {account} {type} Rs. {amount} on {date} at {merchant}. Balance: Rs. {balance}.",
        "INR {amount} {type} via {method} to {merchant} on {date}. Ref: {ref}.",
    ],
    "us": [
        "${amount} {type} at {merchant} on {date}. Card ending in {card}. Balance: ${balance}.",
        "You made a ${amount} transaction at {merchant} on {date}. Available: ${balance}.",
        "{type}: ${amount} at {merchant} on {date} with card ...{card}.",
    ],
    "eu": [
        "€{amount} {type} at {merchant} on {date}. Card: ****{card}. Balance: €{balance}.",
        "Transaction: €{amount} to {merchant} on {date} via {method}.",
    ],
    "jp": [
        "¥{amount} {type} at {merchant} on {date}. Balance: ¥{balance}.",
        "ご利用¥{amount} at {merchant} on {date}. Available: ¥{balance}.",
    ],
}

# Sample data for generation
MERCHANTS = [
    "Amazon",
    "Swiggy",
    "Zomato",
    "Flipkart",
    "Netflix",
    "Spotify",
    "Uber",
    "Ola",
    "Paytm",
    "PhonePe",
    "Google Pay",
    "Starbucks",
    "McDonald's",
    "KFC",
    "Pizza Hut",
    "Domino's",
    "BigBasket",
    "Grofers",
    "Myntra",
    "AJIO",
    "Nykaa",
    "BookMyShow",
    "MakeMyTrip",
    "Whole Foods",
    "Target",
    "Walmart",
    "Costco",
    "Best Buy",
    "Shell",
    "BP",
    "Exxon",
    "Chevron",
]

PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"]

BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "Chase", "Bank of America", "Revolut"]


def generate_random_amount(min_val: float = 10, max_val: float = 50000) -> float:
    """Generate random transaction amount."""
    return round(random.uniform(min_val, max_val), 2)


def generate_random_date() -> str:
    """Generate random date in various formats."""
    day = random.randint(1, 28)
    month = random.randint(1, 12)
    year = random.randint(2023, 2024)

    formats = [
        f"{day:02d}-{month:02d}-{year}",
        f"{day:02d}/{month:02d}/{year}",
        f"{year}-{month:02d}-{day:02d}",
    ]
    return random.choice(formats)


def generate_synthetic_sample(region: str = "indian") -> Dict:
    """Generate a single synthetic SMS sample."""
    template = random.choice(SMS_TEMPLATES[region])

    amount = generate_random_amount()
    merchant = random.choice(MERCHANTS)
    date = generate_random_date()
    tx_type = random.choice(["debited", "credited", "spent", "withdrawn"])
    account = f"**{random.randint(1000, 9999)}"
    card = f"{random.randint(1000, 9999)}"
    balance = generate_random_amount(1000, 100000)
    method = random.choice(PAYMENT_METHODS)
    ref = f"{random.randint(100000000000, 999999999999)}"

    sms = template.format(
        amount=amount,
        merchant=merchant,
        date=date,
        type=tx_type,
        account=account,
        card=card,
        balance=balance,
        method=method,
        ref=ref,
    )

    return {
        "sms": sms,
        "merchant": merchant,
        "amount": amount,
        "currency": "INR"
        if region == "indian"
        else ("USD" if region == "us" else ("EUR" if region == "eu" else "JPY")),
        "date": date,
        "type": "debit" if tx_type in ["debited", "spent", "withdrawn"] else "credit",
        "bank": random.choice(BANKS),
    }


def generate_synthetic_dataset(n_samples: int = 450) -> List[Dict]:
    """Generate synthetic training data."""
    samples = []
    regions = ["indian"] * 200 + ["us"] * 150 + ["eu"] * 50 + ["jp"] * 50

    for region in regions[:n_samples]:
        samples.append(generate_synthetic_sample(region))

    return samples


def load_real_samples() -> List[Dict]:
    """Load real SMS samples from files."""
    real_samples = []

    # Check if real samples exist
    raw_dir = Path("../data/raw")
    if raw_dir.exists():
        for file in raw_dir.glob("*.json"):
            with open(file) as f:
                data = json.load(f)
                real_samples.extend(data if isinstance(data, list) else [data])

    # If no real samples, use these hardcoded examples
    if not real_samples:
        real_samples = [
            {
                "sms": "Rs.1,500.00 debited from a/c **1234 on 15-02-2024. Avl Bal: Rs.25,430.50. Swiggy - Food Order",
                "merchant": "Swiggy",
                "amount": 1500.0,
                "currency": "INR",
                "date": "15-02-2024",
                "type": "debit",
                "bank": "HDFC",
            },
            {
                "sms": "Thank you for using your ICICI Bank Credit Card ending 5678 for INR 2,499 at AMAZON on 14-02-2024",
                "merchant": "Amazon",
                "amount": 2499.0,
                "currency": "INR",
                "date": "14-02-2024",
                "type": "debit",
                "bank": "ICICI",
            },
            {
                "sms": "Rs.500 withdrawn from ATM on 13-02-2024",
                "merchant": "ATM Withdrawal",
                "amount": 500.0,
                "currency": "INR",
                "date": "13-02-2024",
                "type": "debit",
                "bank": "SBI",
            },
            {
                "sms": "You made a $45.99 transaction at STARBUCKS on 02/15/2024",
                "merchant": "Starbucks",
                "amount": 45.99,
                "currency": "USD",
                "date": "15-02-2024",
                "type": "debit",
                "bank": "Chase",
            },
            {
                "sms": "€25.00 paid to UBER on 15-02-2024",
                "merchant": "Uber",
                "amount": 25.0,
                "currency": "EUR",
                "date": "15-02-2024",
                "type": "debit",
                "bank": "Revolut",
            },
        ]

    return real_samples


def split_dataset(data: List[Dict], train_ratio: float = 0.8) -> tuple:
    """Split dataset into train and validation."""
    random.shuffle(data)
    train_size = int(len(data) * train_ratio)
    return data[:train_size], data[train_size:]


def main():
    """Main data preparation function."""
    print("Loading real samples...")
    real_samples = load_real_samples()
    print(f"Loaded {len(real_samples)} real samples")

    print("Generating synthetic samples...")
    synthetic_samples = generate_synthetic_dataset(450)
    print(f"Generated {len(synthetic_samples)} synthetic samples")

    # Combine datasets
    all_samples = real_samples + synthetic_samples
    print(f"Total samples: {len(all_samples)}")

    # Split into train/val
    train_data, val_data = split_dataset(all_samples, train_ratio=0.8)
    print(f"Train: {len(train_data)}, Val: {len(val_data)}")

    # Create output directory
    output_dir = Path("../data/processed")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Save datasets
    with open(output_dir / "train.json", "w") as f:
        json.dump(train_data, f, indent=2)

    with open(output_dir / "val.json", "w") as f:
        json.dump(val_data, f, indent=2)

    print(f"Saved datasets to {output_dir}")


if __name__ == "__main__":
    main()
