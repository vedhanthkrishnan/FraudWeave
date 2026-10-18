from pathlib import Path
import pandas as pd

DATA_DIR = Path("data/raw/elliptic_bitcoin_dataset")

files = {
    "Classes": DATA_DIR / "elliptic_txs_classes.csv",
    "Edges": DATA_DIR / "elliptic_txs_edgelist.csv",
    "Features": DATA_DIR / "elliptic_txs_features.csv",
}

for name, path in files.items():
    print(f"\n{'=' * 60}")
    print(f"{name}: {path.name}")
    print(f"File exists: {path.exists()}")

    if not path.exists():
        continue

    # Read only five rows for a quick structural inspection.
    sample = pd.read_csv(path, nrows=5)

    print(f"Columns: {len(sample.columns)}")
    print(f"Column names: {sample.columns.tolist()}")
    print("\nFirst 5 rows:")
    print(sample.to_string(index=False, max_cols=12))

print("\nDataset inspection complete.")