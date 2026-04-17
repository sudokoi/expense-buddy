from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

SOURCE_COMMIT = "cab99ec"
SOURCE_FILES = {
    "train": "ml/data/processed/train.json",
    "val": "ml/data/processed/val.json",
}


def load_historical_json(repo_root: Path, git_path: str) -> list[dict[str, Any]]:
    result = subprocess.run(
        ["git", "show", f"{SOURCE_COMMIT}:{git_path}"],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(result.stdout)
    if not isinstance(payload, list):
        raise ValueError(f"Expected list payload for {git_path}")
    return payload


def infer_schema(records: list[dict[str, Any]]) -> dict[str, str]:
    first_record = records[0]
    return {key: type(value).__name__ for key, value in first_record.items()}


def main() -> None:
    workspace_root = Path(__file__).resolve().parents[3]
    ml_root = Path(__file__).resolve().parents[1]
    output_dir = ml_root / "data" / "reference"
    output_dir.mkdir(parents=True, exist_ok=True)

    exported: dict[str, list[dict[str, Any]]] = {}
    for split_name, git_path in SOURCE_FILES.items():
        records = load_historical_json(workspace_root, git_path)
        exported[split_name] = records
        target_path = output_dir / f"seed-{split_name}.json"
        target_path.write_text(json.dumps(records, indent=2), encoding="utf-8")

    summary = {
        "sourceCommit": SOURCE_COMMIT,
        "sourceFiles": SOURCE_FILES,
        "recordCounts": {name: len(records) for name, records in exported.items()},
        "schema": infer_schema(exported["train"]),
        "notes": [
            "Recovered from local git history as seed data for the ML workspace.",
            "The records appear synthetic or anonymized rather than raw personal SMS.",
        ],
        "preview": (exported["train"] + exported["val"])[:10],
    }
    summary_path = output_dir / "seed-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(f"Imported train samples to {output_dir / 'seed-train.json'}")
    print(f"Imported val samples to {output_dir / 'seed-val.json'}")
    print(f"Wrote summary to {summary_path}")


if __name__ == "__main__":
    main()
