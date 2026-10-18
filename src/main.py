
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from src.database.db import check_database, get_graph
from src.investigation import router, neighbors, guarded

app = FastAPI(
    title="FraudWeave API",
    description=(
        "Bitcoin transaction graph investigation "
        "and risk intelligence API."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def home():
    return {
        "project": "FraudWeave",
        "status": "online",
        "message": "Bitcoin transaction intelligence API is running.",
    }


@app.get("/api/health")
def health_check():
    database = check_database()

    return {
        "status": "healthy" if database.get("connected") else "degraded",
        "service": "FraudWeave API",
        "database": database,
        "mode": "development",
    }


@app.get("/api/stats")
def get_stats():
    """Return live statistics from the transaction graph."""
    try:
        graph = get_graph()

        node_result = graph.query(
            """
            MATCH (t:Transaction)
            RETURN count(t) AS total_transactions
            """
        )

        edge_result = graph.query(
            """
            MATCH ()-[r:TRANSACTION_FLOW]->()
            RETURN count(r) AS total_relationships
            """
        )

        label_result = graph.query(
            """
            MATCH (t:Transaction)
            RETURN t.label AS label, count(t) AS total
            ORDER BY label
            """
        )

        labels = {
            str(label): int(count)
            for label, count in label_result.result_set
        }

        total_transactions = int(node_result.result_set[0][0])
        total_relationships = int(edge_result.result_set[0][0])

        return {
            "status": "success",
            "source": "FalkorDB",
            "total_transactions": total_transactions,
            "total_relationships": total_relationships,
            "labels": labels,
            "label_note": (
                "Labels are from the Elliptic research dataset; "
                "they are not independent proof of wrongdoing."
            ),
        }

    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not retrieve graph statistics: {exc}",
        ) from exc


@app.get("/api/transactions/{tx_id}")
def get_transaction(tx_id: str):
    """Look up a transaction and its stored features."""
    try:
        graph = get_graph()

        result = graph.query(
            """
            MATCH (t:Transaction {tx_id: $tx_id})
            RETURN t
            LIMIT 1
            """,
            {"tx_id": tx_id},
        )

        if not result.result_set:
            raise HTTPException(
                status_code=404,
                detail="Transaction not found in the imported dataset.",
            )

        node = result.result_set[0][0]
        properties = dict(node.properties)

        return {
            "status": "success",
            "transaction": properties,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not retrieve transaction: {exc}",
        ) from exc


@app.get("/api/transactions/{tx_id}/neighbors")
def get_transaction_neighbors(
    tx_id: str,
    limit: int = Query(default=20, ge=1, le=100),
):
    """Bound each directional query before returning connected transactions."""
    with guarded():
        return neighbors(tx_id, limit)
