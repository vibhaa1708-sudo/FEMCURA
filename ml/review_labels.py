from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

INPUT_FILE = DATA_DIR / "passages_to_label.csv"
MASTER_FILE = DATA_DIR / "passages_for_ml_review.csv"
OUTPUT_FILE = DATA_DIR / "passages_pending_review.csv"

VERIFIED_COLUMNS = [
    "verified_policy_label",
    "verified_study_label",
]

ALLOWED_LABELS = {"yes", "no", "unclear"}


def main():
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Missing source: {INPUT_FILE}")

    if not MASTER_FILE.exists():
        raise FileNotFoundError(
            f"Missing master review file: {MASTER_FILE}"
        )

    source = pd.read_csv(INPUT_FILE).fillna("")
    master = pd.read_csv(MASTER_FILE).fillna("")

    required_source = {"filename", "page", "text", "label"}
    required_master = {
        "filename",
        "page",
        "text",
        *VERIFIED_COLUMNS,
    }

    if not required_source.issubset(source.columns):
        raise ValueError(
            f"Source columns missing: "
            f"{required_source - set(source.columns)}"
        )

    if not required_master.issubset(master.columns):
        raise ValueError(
            f"Master columns missing: "
            f"{required_master - set(master.columns)}"
        )

    # Identify passages using filename, page, and text.
    key_columns = ["filename", "page", "text"]

    if master.duplicated(key_columns).any():
        raise ValueError(
            "Duplicate passage keys found in master CSV. "
            "Resolve duplicates before continuing."
        )

    # Do not silently discard verified work.
    source_keys = set(
        map(tuple, source[key_columns].astype(str).to_numpy())
    )
    master_keys = set(
        map(tuple, master[key_columns].astype(str).to_numpy())
    )

    if not master_keys.issubset(source_keys):
        raise ValueError(
            "Master contains passages absent from source. "
            "No files were changed."
        )

    # Preserve existing verified labels while refreshing source passages.
    source_lookup = source.set_index(key_columns)

    for column in master.columns:
        if column not in source.columns and column not in VERIFIED_COLUMNS:
            # Preserve review metadata; don't overwrite it.
            continue

    # Determine which passages still need human review.
    pending_mask = pd.Series(False, index=master.index)

    for column in VERIFIED_COLUMNS:
        values = (
            master[column]
            .astype(str)
            .str.strip()
            .str.lower()
        )
        pending_mask |= ~values.isin(ALLOWED_LABELS)

    pending = master.loc[pending_mask].copy()

    # Never overwrite an existing pending-review file.
    if OUTPUT_FILE.exists():
        raise FileExistsError(
            f"{OUTPUT_FILE.name} already exists. "
            "Rename or move it before generating a new copy."
        )

    pending.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")

    print("Pending-review file created successfully.")
    print("Master passages:", len(master))
    print("Passages pending at least one verified label:", len(pending))
    print("Saved to:", OUTPUT_FILE)
    print("\nVerified-label counts:")

    for column in VERIFIED_COLUMNS:
        values = (
            master[column]
            .astype(str)
            .str.strip()
            .str.lower()
        )
        valid = values[values.isin(ALLOWED_LABELS)]
        print(f"\n{column}: {len(valid)}")
        print(valid.value_counts().to_string())

    print(
        "\nNote: This script exports passages for human review. "
        "It does not verify labels automatically."
    )


if __name__ == "__main__":
    main()
