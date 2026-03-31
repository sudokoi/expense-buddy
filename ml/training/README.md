# SMS Parser Training

Python ML training pipeline for the Expense Buddy SMS import feature.

## Quick Start

```bash
# Navigate to training directory
cd ml/training

# Install UV (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Setup environment and install dependencies
uv sync

# Activate virtual environment
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate  # Windows
```

## Development Commands

```bash
# Format code
black .

# Lint code
ruff check .
ruff check . --fix  # Auto-fix issues

# Type checking
mypy training/

# Run tests
pytest

# Run specific test
pytest tests/test_data_loader.py -v

# Run with coverage
pytest --cov=training --cov-report=html
```

## Training Pipeline

### 1. Prepare Data
```bash
uv run python -m training.prepare_data
```

Generates synthetic training data (450 samples) + loads real samples.
Output: `data/processed/train.json` and `data/processed/val.json`

### 2. Train Model
```bash
uv run python -m training.train \
  --data_dir data/processed \
  --output_dir models/checkpoints \
  --epochs 10 \
  --batch_size 16
```

### 3. Convert to TFLite
```bash
uv run python -m training.convert_to_tflite \
  --checkpoint models/checkpoints/best \
  --output models/final/sms_parser_model.tflite
```

### 4. Deploy
Copy the generated model to the React Native app:
```bash
cp models/final/sms_parser_model.tflite ../../assets/models/
```

## Project Structure

```
training/
├── pyproject.toml          # Project configuration (UV, ruff, black, pytest)
├── README.md               # This file
├── training/               # Python package
│   ├── __init__.py
│   ├── prepare_data.py     # Data preparation
│   ├── train.py            # Training script
│   ├── convert_to_tflite.py # TFLite conversion
│   └── model.py            # Model architecture (future)
├── tests/                  # Test suite
│   ├── __init__.py
│   ├── test_data_loader.py
│   └── test_model.py
└── data/                   # Data directory
    ├── raw/                # Real SMS samples
    ├── processed/          # Training/validation sets
    └── synthetic/          # Generated samples
```

## Code Quality

This project uses:
- **UV**: Fast Python package manager
- **Black**: Code formatting (line length: 100)
- **Ruff**: Linting (replaces flake8, isort, pydocstyle)
- **MyPy**: Type checking
- **Pytest**: Testing with coverage

### Pre-commit Checks

Before committing, run:
```bash
# Format code
black .

# Check linting
ruff check .

# Type check
mypy training/

# Run tests
pytest
```

## Environment Variables

Create `.env` file for local development:
```bash
# Training configuration
TRAINING_EPOCHS=10
BATCH_SIZE=16
LEARNING_RATE=2e-5

# Model configuration
MODEL_NAME=google/mobilebert-uncased
MAX_INPUT_LENGTH=256

# Paths
DATA_DIR=data/processed
OUTPUT_DIR=models/checkpoints
```

## VS Code Setup

Recommended extensions:
- Python (Microsoft)
- Ruff (Astral Software)
- Black Formatter (Microsoft)
- MyPy Type Checker (Matthieu Lapeyre)

Settings (`.vscode/settings.json`):
```json
{
  "python.defaultInterpreterPath": "./.venv/bin/python",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "ms-python.black-formatter",
  "ruff.organizeImports": true,
  "ruff.fixAll": true
}
```

## Troubleshooting

### UV not found
```bash
# Reinstall UV
curl -LsSf https://astral.sh/uv/install.sh | sh
# Or on Windows
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Import errors
Make sure you're in the training directory and have activated the virtual environment:
```bash
cd ml/training
source .venv/bin/activate
```

### Out of memory during training
Reduce batch size:
```bash
uv run python -m training.train --batch_size 8
```

## Contributing

1. Create a new branch for your changes
2. Make your changes
3. Run formatting, linting, and tests
4. Submit a PR

## License

Same as parent project (AGPL-3.0-only)
