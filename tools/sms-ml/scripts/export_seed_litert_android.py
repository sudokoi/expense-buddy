from __future__ import annotations

import shutil
from pathlib import Path

MODEL_ID = "seed-litert-embed-augmented-v1"

REPO_ROOT = Path(__file__).resolve().parents[3]
ARTIFACT_ROOT = REPO_ROOT / "tools" / "sms-ml" / "artifacts" / "training" / MODEL_ID
ANDROID_ASSET_ROOT = (
    REPO_ROOT
    / "modules"
    / "expense-buddy-sms-import"
    / "android"
    / "src"
    / "main"
    / "assets"
    / "sms_ml"
    / MODEL_ID
)


def copy_required_file(file_name: str) -> None:
    source_path = ARTIFACT_ROOT / file_name
    if not source_path.exists():
        raise FileNotFoundError(
            f"Missing {source_path}. Run yarn ml:train:seed-litert-embed:augmented first."
        )

    ANDROID_ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source_path, ANDROID_ASSET_ROOT / file_name)


def main() -> None:
    copy_required_file("model.tflite")
    copy_required_file("metadata.json")
    print(f"Copied {MODEL_ID} Android assets to {ANDROID_ASSET_ROOT}")


if __name__ == "__main__":
    main()
