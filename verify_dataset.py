from pathlib import Path
import pandas as pd

DATA_DIR = Path("data/raw/elliptic_bitcoin_dataset")

classes_path = DATA_DIR / "elliptic_txs_classes.csv"
edges_path = DATA_DIR / "elliptic_txs_edgelist.csv"
features_path = DATA_DIR / "elliptic_txs_features.csv"

print("=" * 60)
print("FRAUDWEAVE — DATASET VERIFICATION")
print("=" * 60)

# 1. Labels
classes = pd.read_csv(classes_path)
print("\n1. TRANSACTION LABELS")
print("Rows:", len(classes))
print(classes["class"].value_counts(dropna=False).to_string())

# 2. Edges
edges = pd.read_csv(edges_path)
print("\n2. TRANSACTION RELATIONSHIPS")
print("Rows:", len(edges))
print("Unique source transactions:", edges["txId1"].nunique())
print("Unique target transactions:", edges["txId2"].nunique())

# 3. Features — IMPORTANT: no header row
features_sample = pd.read_csv(
    features_path,
    header=None,
    nrows=5,
)

print("\n3. TRANSACTION FEATURES")
print("Columns:", features_sample.shape[1])
print("Sample rows:", len(features_sample))
print("First transaction ID:", features_sample.iloc[0, 0])
print("First time step:", features_sample.iloc[0, 1])
print("Numeric feature count:", features_sample.shape[1] - 2)
print("First five values:", features_sample.iloc[0, :5].tolist())

# Count feature rows in chunks without retaining the entire file.
feature_rows = 0

for chunk in pd.read_csv(
    features_path,
    header=None,
    usecols=[0],
    chunksize=50_000,
):
    feature_rows += len(chunk)

print("\n4. ROW COUNT CROSS-CHECK")
print("Feature rows:", feature_rows)
print("Class rows:", len(classes))
print("Edge rows:", len(edges))

print("\nVerification complete.")