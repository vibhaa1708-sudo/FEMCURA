
import pandas as pd

file_path = "ml/data/passages_for_ml_review.csv"
df = pd.read_csv(file_path)

policy_col = "verified_policy_label"
study_col = "verified_study_label"

allowed_labels = {"yes", "no", "unclear"}

print("Total passages:", len(df))

for column in [policy_col, study_col]:
    df[column] = df[column].astype("string").str.strip().str.lower()

    invalid = df[column].dropna()[~df[column].dropna().isin(allowed_labels)]

    print(f"\n{column}")
    print(df[column].value_counts(dropna=False))

    if len(invalid):
        print("Invalid labels found:", invalid.unique().tolist())
    else:
        print("Label format: OK")

print("\nMissing passage text:", df["text"].isna().sum())
print("Empty passage text:", df["text"].fillna("").str.strip().eq("").sum())

print("\nValidation complete.")
print("Note: Format validation does not establish scientific correctness.")
