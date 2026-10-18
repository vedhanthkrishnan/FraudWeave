
import argparse
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from falkordb import FalkorDB

load_dotenv()

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "raw" / "elliptic_bitcoin_dataset"

BATCH_SIZE = 250


def transaction_id(value):
    """Normalize dataset IDs without losing integer precision."""
    return str(int(value))


def connect_graph():
    import os

    db = FalkorDB(
        host=os.getenv("FALKORDB_HOST", "localhost"),
        port=int(os.getenv("FALKORDB_PORT", "6379")),
        password=os.getenv("FALKORDB_PASSWORD") or None,
    )
    return db.select_graph(os.getenv("FALKORDB_GRAPH", "fraudweave"))


def load_labels():
    path = DATA_DIR / "elliptic_txs_classes.csv"
    classes = pd.read_csv(path, dtype={"txId": str})

    label_names = {
        "1": "illicit_labelled",
        "2": "licit_labelled",
        "unknown": "unknown",
    }

    return {
        transaction_id(tx_id): label_names.get(str(label), "unknown")
        for tx_id, label in zip(classes["txId"], classes["class"])
    }


def import_nodes(graph, limit=None):
    features_path = DATA_DIR / "elliptic_txs_features.csv"
    labels = load_labels()
    imported = 0

    reader = pd.read_csv(
        features_path,
        header=None,
        chunksize=BATCH_SIZE,
        nrows=limit,
    )

    for chunk in reader:
        rows = []

        for values in chunk.itertuples(index=False, name=None):
            tx_id = transaction_id(values[0])
            step = int(values[1])

            # The first two columns are ID and time step.
            features = {
                f"f{i:03d}": float(value)
                for i, value in enumerate(values[2:])
            }

            rows.append({
                "tx_id": tx_id,
                "time_step": step,
                "label": labels.get(tx_id, "unknown"),
                "features": features,
            })

        graph.query(
            """
            UNWIND $rows AS row
            MERGE (t:Transaction {tx_id: row.tx_id})
            SET t.time_step = row.time_step,
                t.label = row.label
            SET t += row.features
            """,
            {"rows": rows},
        )

        imported += len(rows)
        print(f"Transactions processed: {imported:,}")

    return imported


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--limit",
        type=int,
        default=1000,
        help="Maximum transactions to import; use 0 for all transactions.",
    )
    args = parser.parse_args()

    if args.limit < 0:
        parser.error("--limit must be zero or a positive integer")

    if not (DATA_DIR / "elliptic_txs_features.csv").exists():
        raise FileNotFoundError(
            f"Dataset not found at {DATA_DIR}. "
            "Check the extracted CSV folder."
        )

    graph = connect_graph()

    # Create an index to speed up lookups by transaction ID.
    try:
        graph.query(
            "CREATE INDEX FOR (t:Transaction) ON (t.tx_id)"
        )
        print("Transaction ID index created.")
    except Exception as exc:
        # An existing index is okay; other errors should be visible.
        print(f"Index notice: {exc}")

    print("Importing transaction nodes...")
    count = import_nodes(
        graph,
        limit=args.limit or None,
    )

    result = graph.query(
        """
        MATCH (t:Transaction)
        RETURN count(t) AS total,
               count(t.tx_id) AS ids,
               count(t.f000) AS feature_values
        """
    )

    print("\nImport verification:")
    print("Rows processed in this run:", count)
    print("Graph totals [nodes, IDs, first-feature values]:")
    print(result.result_set)
    print("\nNode import finished. Relationships are not imported yet.")


if __name__ == "__main__":
    main()
