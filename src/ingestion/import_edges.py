
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from falkordb import FalkorDB
import os

load_dotenv()

ROOT = Path(__file__).resolve().parents[2]
EDGE_FILE = (
    ROOT
    / "data"
    / "raw"
    / "elliptic_bitcoin_dataset"
    / "elliptic_txs_edgelist.csv"
)

BATCH_SIZE = 2000


def connect_graph():
    db = FalkorDB(
        host=os.getenv("FALKORDB_HOST", "localhost"),
        port=int(os.getenv("FALKORDB_PORT", "6379")),
        password=os.getenv("FALKORDB_PASSWORD") or None,
    )
    return db.select_graph(os.getenv("FALKORDB_GRAPH", "fraudweave"))


def main():
    if not EDGE_FILE.exists():
        raise FileNotFoundError(f"Edge file not found: {EDGE_FILE}")

    graph = connect_graph()
    total = 0
    skipped = 0

    for chunk in pd.read_csv(
        EDGE_FILE,
        dtype={"txId1": str, "txId2": str},
        chunksize=BATCH_SIZE,
    ):
        edges = [
            {"source": str(source), "target": str(target)}
            for source, target in zip(chunk["txId1"], chunk["txId2"])
        ]

        result = graph.query(
            """
            UNWIND $edges AS edge
            MATCH (source:Transaction {tx_id: edge.source})
            MATCH (target:Transaction {tx_id: edge.target})
            MERGE (source)-[:TRANSACTION_FLOW]->(target)
            RETURN count(*) AS created_or_matched
            """,
            {"edges": edges},
        )

        matched = result.result_set[0][0] if result.result_set else 0
        total += matched
        skipped += len(edges) - matched

        print(
            f"Edges processed: {total:,} / 234,355 "
            f"| Unmatched endpoints: {skipped:,}"
        )

    verification = graph.query(
        """
        MATCH (:Transaction)-[r:TRANSACTION_FLOW]->(:Transaction)
        RETURN count(r) AS relationship_count
        """
    )

    print("\nRelationship import complete.")
    print("Matched edge rows:", total)
    print("Unmatched edge endpoints:", skipped)
    print("Graph relationship count:", verification.result_set)


if __name__ == "__main__":
    main()
