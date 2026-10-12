
"""
FEMCURA - Experimental ML Training Pipeline

Uses AI-assisted draft labels for a prototype experiment.
Labels are not independently verified ground truth.
This prototype is not clinically validated.
"""

from pathlib import Path

import joblib
import pandas as pd

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "passages_for_ml_review.csv"
MODEL_DIR = BASE_DIR / "models"

TEXT_COLUMN_CANDIDATES = [
    "text",
    "passage_text",
    "passage",
]

LABEL_COLUMNS = [
    "verified_policy_label",
    "verified_study_label",
]

VALID_LABELS = {"yes", "no", "unclear"}


# --------------------------------------------------
# FIND PASSAGE TEXT COLUMN
# --------------------------------------------------

def find_text_column(df):
    for column in TEXT_COLUMN_CANDIDATES:
        if column in df.columns:
            return column

    raise ValueError(
        "Passage text column not found. "
        f"Available columns: {list(df.columns)}"
    )


# --------------------------------------------------
# PREPARE DATA
# --------------------------------------------------

def prepare_data(df, text_column, label_column):
    data = df[[text_column, label_column]].copy()

    data[text_column] = (
        data[text_column]
        .fillna("")
        .astype(str)
        .str.strip()
    )

    data[label_column] = (
        data[label_column]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.lower()
    )

    data = data[
        (data[text_column] != "")
        & data[label_column].isin(VALID_LABELS)
    ].copy()

    return data


# --------------------------------------------------
# CREATE MODEL
# --------------------------------------------------

def create_model():
    return Pipeline([
        (
            "tfidf",
            TfidfVectorizer(
                lowercase=True,
                max_features=10000,
                ngram_range=(1, 2),
                sublinear_tf=True,
            ),
        ),
        (
            "classifier",
            LogisticRegression(
                max_iter=1000,
                class_weight="balanced",
                random_state=42,
            ),
        ),
    ])


# --------------------------------------------------
# TRAIN ONE CLASSIFIER
# --------------------------------------------------

def train_classifier(df, text_column, label_column):
    print("\n" + "=" * 55)
    print(f"Training task: {label_column}")
    print("=" * 55)

    data = prepare_data(df, text_column, label_column)

    if data.empty:
        print("SKIPPED: No usable labeled passages.")
        return

    X = data[text_column]
    y = data[label_column]

    print(f"Usable passages: {len(data)}")
    print("\nLabel distribution:")
    print(y.value_counts().to_string())

    if y.nunique() < 2:
        print("SKIPPED: At least two classes are required.")
        return

    class_counts = y.value_counts()
    can_evaluate = (
        len(data) >= 10
        and class_counts.min() >= 2
    )

    # Initialize evaluation variables before branching.
    X_test = None
    y_test = None

    if can_evaluate:
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X,
                y,
                test_size=0.2,
                random_state=42,
                stratify=y,
            )
        except ValueError as error:
            print(f"Holdout split unavailable: {error}")
            X_train, y_train = X, y
            X_test, y_test = None, None
            can_evaluate = False
    else:
        X_train, y_train = X, y

    model = create_model()
    model.fit(X_train, y_train)

    # Evaluate only when a valid test set exists.
    if can_evaluate and X_test is not None and y_test is not None:
        predictions = model.predict(X_test)

        accuracy = accuracy_score(y_test, predictions)

        print(
            "\nHoldout accuracy "
            f"(agreement with draft labels): {accuracy:.3f}"
        )

        print("\nClassification report:")
        print(
            classification_report(
                y_test,
                predictions,
                zero_division=0,
            )
        )
    else:
        print(
            "\nEvaluation skipped: insufficient examples "
            "for a reliable holdout split."
        )

    # Save the trained model.
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODEL_DIR / f"{label_column}.joblib"
    joblib.dump(model, model_path)

    print(f"\nModel saved to: {model_path}")


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def main():
    print("=" * 55)
    print("FEMCURA - EXPERIMENTAL TRAINING")
    print("=" * 55)
    print("WARNING: Training labels are AI-assisted drafts.")
    print("This experiment is not clinically validated.")

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"\nDataset not found:\n{DATA_PATH}\n"
            "Check that passages_for_ml_review.csv exists "
            "inside ml/data/."
        )

    df = pd.read_csv(DATA_PATH)

    print(f"\nDataset: {DATA_PATH}")
    print(f"Total rows: {len(df)}")

    text_column = find_text_column(df)
    print(f"Text column: {text_column}")

    for label_column in LABEL_COLUMNS:
        if label_column not in df.columns:
            raise ValueError(
                f"Missing required column: {label_column}\n"
                f"Available columns: {list(df.columns)}"
            )

    for label_column in LABEL_COLUMNS:
        train_classifier(df, text_column, label_column)

    print("\n" + "=" * 55)
    print("TRAINING RUN FINISHED")
    print(f"Model folder: {MODEL_DIR}")
    print("=" * 55)


if __name__ == "__main__":
    main()
